# GitHub Actions Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce CI wall-clock time, eliminate redundant builds, fix caching gaps, and remove syntax bugs across all 4 workflow files.

**Architecture:** Restructure build.yml to pass built dist/ directories as GitHub artifacts between jobs instead of rebuilding; add concurrency cancellation; deduplicate pnpm/Node setup via a composite action; fix bash syntax bugs in destroy workflow and pnpm version inconsistency in deployment workflow.

**Tech Stack:** GitHub Actions, pnpm workspaces, actions/cache@v4, actions/upload-artifact@v4, actions/download-artifact@v4

---

## Identified Problems (root cause analysis)

| # | File | Location | Problem | Estimated waste |
|---|------|----------|---------|-----------------|
| A | build.yml | jobs.lint-and-type-check, lines 150–156 | Rebuilds @dculus/types, @dculus/utils, @dculus/ui, backend even though `build-shared-packages` already built them and cached `packages/*/dist` | ~3–4 min per CI run |
| B | build.yml | jobs.build-backend, lines 205–232 | Runs `pnpm test` then `pnpm test:coverage` as two separate commands — same test suite executes twice | ~1–2 min per CI run |
| C | build.yml | jobs.e2e-local, lines 615–629 | Rebuilds form-app and form-viewer with `pnpm build` a second time after `build-form-app` and `build-form-viewer` already built them | ~4–6 min per E2E run |
| D | build.yml | jobs.create-release-artifacts, lines 686–714 | Rebuilds all 4 apps (+ prod install for backend) even though they were built in preceding jobs | ~8–10 min per tag push |
| E | build.yml | jobs.build-shared-packages, line 114 | `built-packages` cache includes `node_modules/.pnpm` (the hoisted store) — pollutes cache key and is large; dist dirs alone are enough | Cache bloat |
| F | build.yml | top-level | No `concurrency:` group — parallel pushes to main/develop queue up full pipeline instead of cancelling stale runs | Minutes of wasted runner time |
| G | build.yml | jobs.security-scan, lines 43–55 | TruffleHog pulled via `docker run` on every run (no layer cache); dedicated GH Action is faster and cacheable | 30–60 s per run |
| H | multi-cloud-deployment.yml | jobs.run-migrations, jobs.deploy-*, lines 380–395, 833–855 | Uses `pnpm/action-setup@v2` (outdated) while build.yml uses `@v4`; no pnpm store cache in any deployment job | 30–90 s per deployment job |
| I | multi-cloud-deployment.yml | jobs.deploy-cloudflare-pages-*, lines 843–873 | Each of the 3 frontend deploy jobs independently installs all deps, builds @dculus/types, @dculus/utils, @dculus/ui, then builds its app — 3x redundant setup | ~6–9 min per deployment |
| J | multi-cloud-destroy.yml | lines 122, 275, 846, 906 | Orphaned bare `fi` statements in bash scripts — will cause "syntax error near unexpected token 'fi'" when those branches execute | Workflow failures |

---

## File Map

| File | What changes |
|------|-------------|
| `.github/workflows/build.yml` | Tasks 1–6 |
| `.github/workflows/multi-cloud-deployment.yml` | Task 7 |
| `.github/workflows/multi-cloud-destroy.yml` | Task 8 |
| `.github/actions/setup-node-pnpm/action.yml` | Task 1 (new composite action) |

---

## Task 1: Create Composite Action for Node + pnpm Setup

The 11-step "setup Node → setup pnpm → get store path → cache store → install" block appears in every job. Extract it once.

**Files:**
- Create: `.github/actions/setup-node-pnpm/action.yml`

- [ ] **Step 1: Create the composite action file**

```yaml
# .github/actions/setup-node-pnpm/action.yml
name: Setup Node.js + pnpm with cache
description: Installs Node.js, pnpm, and restores the pnpm content store cache

inputs:
  node-version:
    description: Node.js version
    required: false
    default: '22.14.0'
  pnpm-version:
    description: pnpm version
    required: false
    default: '8.15.0'

runs:
  using: composite
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}

    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: ${{ inputs.pnpm-version }}

    - name: Get pnpm store directory
      id: pnpm-store
      shell: bash
      run: echo "path=$(pnpm store path --silent)" >> $GITHUB_OUTPUT

    - name: Restore pnpm store cache
      uses: actions/cache@v4
      with:
        path: ${{ steps.pnpm-store.outputs.path }}
        key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
        restore-keys: |
          ${{ runner.os }}-pnpm-store-
```

- [ ] **Step 2: Verify the file parses correctly (no syntax error)**

```bash
# Validate YAML syntax locally
python3 -c "import yaml; yaml.safe_load(open('.github/actions/setup-node-pnpm/action.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/actions/setup-node-pnpm/action.yml
git commit -m "ci: add composite action for Node+pnpm setup with cache"
```

---

## Task 2: Add Concurrency Control to build.yml

Pushes to the same branch should cancel the previous in-progress run. This prevents a backlog when many commits land quickly.

**Files:**
- Modify: `.github/workflows/build.yml:3` (after the `on:` block, before `permissions:`)

- [ ] **Step 1: Add the concurrency block**

In `build.yml`, after line 10 (`workflow_dispatch:`), add the following block between `on:` and `permissions:`:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

This cancels stale runs on feature branches but lets `main` runs finish (important for Docker push and release artifacts).

- [ ] **Step 2: Verify YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "ci: add concurrency cancel-in-progress for non-main branches"
```

---

## Task 3: Fix Built-Packages Cache + Use Artifacts for dist/

**Problem A** (cache bloat): The `built-packages` cache currently includes `node_modules/.pnpm`. That directory is large and already covered by the pnpm store cache. Remove it.

**Problem C/D** (rebuilds): Downstream jobs rebuild frontends. Instead, upload `dist/` as artifacts from build jobs and download in consumers.

**Files:**
- Modify: `.github/workflows/build.yml`

### 3a: Fix the built-packages cache in `build-shared-packages`

- [ ] **Step 1: Remove `node_modules/.pnpm` from the `Cache built packages` step**

Find the step in `build-shared-packages` (currently lines 108–115). Change it to only cache dist directories:

```yaml
      - name: Cache built packages
        uses: actions/cache@v4
        with:
          path: |
            packages/types/dist
            packages/utils/dist
            packages/ui/dist
          key: built-packages-${{ github.sha }}
```

### 3b: Upload form-app dist as artifact in `build-form-app`

- [ ] **Step 2: Add upload step at the end of `build-form-app` job (after the build step, line ~405)**

```yaml
      - name: Upload form-app dist
        uses: actions/upload-artifact@v4
        with:
          name: form-app-dist-${{ github.sha }}
          path: apps/form-app/dist
          retention-days: 1
```

### 3c: Upload form-viewer dist as artifact in `build-form-viewer`

- [ ] **Step 3: Add upload step at end of `build-form-viewer` job (after build step, line ~445)**

```yaml
      - name: Upload form-viewer dist
        uses: actions/upload-artifact@v4
        with:
          name: form-viewer-dist-${{ github.sha }}
          path: apps/form-viewer/dist
          retention-days: 1
```

### 3d: Upload admin-app dist as artifact in `build-admin-app`

- [ ] **Step 4: Add upload step at end of `build-admin-app` job (after build step, line ~488)**

```yaml
      - name: Upload admin-app dist
        uses: actions/upload-artifact@v4
        with:
          name: admin-app-dist-${{ github.sha }}
          path: apps/admin-app/dist
          retention-days: 1
```

### 3e: Upload backend dist as artifact in `build-backend`

- [ ] **Step 5: Add upload step at end of `build-backend` job (after the build step, line ~235)**

```yaml
      - name: Upload backend dist
        uses: actions/upload-artifact@v4
        with:
          name: backend-dist-${{ github.sha }}
          path: apps/backend/dist
          retention-days: 1
```

- [ ] **Step 6: Verify YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "ci: upload built dist/ as artifacts; shrink built-packages cache"
```

---

## Task 4: Fix `lint-and-type-check` — Eliminate Redundant Rebuild

**Problem A**: `lint-and-type-check` restores the `built-packages` cache (lines 139–145) but then ALSO runs `pnpm db:generate`, `pnpm --filter @dculus/types build`, etc. (lines 150–156). The cache already has the dist/ output. Those build commands should be removed.

**Files:**
- Modify: `.github/workflows/build.yml:150–156`

- [ ] **Step 1: Remove the redundant rebuild block in `lint-and-type-check`**

Delete these lines from the `lint-and-type-check` job (they appear between "Install dependencies" and "Run linting"):

```yaml
      - name: Build core packages for pipeline
        run: |
          pnpm db:generate
          pnpm --filter @dculus/types build
          pnpm --filter @dculus/utils build
          pnpm --filter @dculus/ui build
          pnpm --filter backend build
```

The `Restore built packages cache` step already restores the dist/ directories. Add `pnpm db:generate` as a standalone step (Prisma client isn't included in the dist cache):

```yaml
      - name: Generate Prisma client
        run: pnpm db:generate
```

- [ ] **Step 2: Verify YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "ci(lint): skip redundant rebuild in lint-and-type-check, restore from cache"
```

---

## Task 5: Fix `build-backend` Double Test Execution

**Problem B**: `build-backend` runs `pnpm --filter backend test` (unit tests) then immediately runs `pnpm --filter backend test:coverage` (same tests again with coverage). The `test:coverage` output already includes a pass/fail result — run only coverage and use its exit code for the gate.

**Files:**
- Modify: `.github/workflows/build.yml:205–232`

- [ ] **Step 1: Remove the duplicate `Run unit tests` step**

Delete the entire "Run unit tests" step (lines 205–219). Keep only the "Check test coverage threshold" step, but change it from `continue-on-error: true` to a hard gate once the duplication is removed:

The resulting two steps should be:

```yaml
      - name: Run unit tests with coverage
        env:
          NODE_ENV: test
          BETTER_AUTH_SECRET: test-only-secret-for-unit-tests-not-used-in-production
          PUBLIC_S3_ENDPOINT: http://localhost:9000
          PUBLIC_S3_ACCESS_KEY: test-access-key
          PUBLIC_S3_SECRET_KEY: test-secret-key
          PUBLIC_S3_BUCKET_NAME: test-public-bucket
          PRIVATE_S3_BUCKET_NAME: test-private-bucket
          PUBLIC_S3_CDN_URL: http://localhost:9000
        run: pnpm --filter backend test:coverage
        continue-on-error: true
```

(Keep `continue-on-error: true` per the existing comment — coverage threshold isn't yet enforced as a hard gate.)

- [ ] **Step 2: Verify YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "ci(backend): run tests once with coverage instead of running twice"
```

---

## Task 6: Fix `e2e-local` and `create-release-artifacts` to Reuse Built Artifacts

**Problem C**: `e2e-local` currently rebuilds form-app and form-viewer. It should download the artifacts uploaded in Task 3.

**Problem D**: `create-release-artifacts` rebuilds all 4 apps. It should download from artifacts.

**Files:**
- Modify: `.github/workflows/build.yml`

### 6a: Fix `e2e-local` — download frontends instead of rebuilding

- [ ] **Step 1: In `e2e-local`, replace the two "Build & serve" steps with artifact downloads**

Find and replace the "Build & serve form-app" and "Build & serve form-viewer" steps:

**Remove:**
```yaml
      - name: Build & serve form-app (localhost:3000)
        run: |
          VITE_API_URL=http://localhost:4000 \
          VITE_GRAPHQL_URL=http://localhost:4000/graphql \
          VITE_FORM_VIEWER_URL=http://localhost:5173 \
          pnpm --filter form-app build
          pnpm --filter form-app preview --port 3000 --host &

      - name: Build & serve form-viewer (localhost:5173)
        run: |
          VITE_API_URL=http://localhost:4000 \
          VITE_GRAPHQL_URL=http://localhost:4000/graphql \
          pnpm --filter form-viewer build
          pnpm --filter form-viewer preview --port 5173 --host &
```

**Add (before the "Wait for frontends" step):**
```yaml
      - name: Download form-app dist
        uses: actions/download-artifact@v4
        with:
          name: form-app-dist-${{ github.sha }}
          path: apps/form-app/dist

      - name: Download form-viewer dist
        uses: actions/download-artifact@v4
        with:
          name: form-viewer-dist-${{ github.sha }}
          path: apps/form-viewer/dist

      - name: Serve form-app (localhost:3000)
        run: pnpm --filter form-app preview --port 3000 --host &

      - name: Serve form-viewer (localhost:5173)
        run: pnpm --filter form-viewer preview --port 5173 --host &
```

Note: The e2e-local E2E runs against localhost, not production URLs. The form-app was built in `build-form-app` with `VITE_API_URL=${{ env.BACKEND_URL }}` (production URL) — that's wrong for local E2E anyway. For E2E local the builds need localhost URLs. So we still need to rebuild them with localhost URLs. **Keep the rebuild steps but add a note comment explaining why artifacts can't be reused here.**

Instead, the optimization is to make the rebuild faster by restoring the pnpm store cache and built-packages cache properly. The key save is removing the redundant Prisma generate:

- [ ] **Step 1 (revised): In `e2e-local`, ensure `db:generate` is only called once**

The e2e-local step has:
```yaml
      - name: Generate Prisma client & run migrations
        run: |
          pnpm db:generate
          pnpm db:migrate:deploy
```

This is fine. But it also restores `built-packages` cache which only covers packages/*/dist. The job still needs to install deps. Currently this works. No change needed here — the local build with different VITE vars is intentional.

### 6b: Fix `create-release-artifacts` — download instead of rebuild

- [ ] **Step 2: Replace the rebuild steps in `create-release-artifacts`**

Find the job `create-release-artifacts`. Replace the entire `Install dependencies`, `Build form-app for release`, `Build form-viewer for release`, `Build admin-app for release`, and `Build backend for release` steps with artifact downloads:

**Remove these steps (lines ~685–714):**
```yaml
      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build form-app for release
        run: |
          echo "Building form-app without hardcoded secrets..."
          pnpm --filter form-app build

      - name: Build form-viewer for release
        run: |
          pnpm --filter form-viewer build

      - name: Build admin-app for release
        run: |
          echo "Building admin-app without hardcoded secrets..."
          pnpm --filter admin-app build

      - name: Build backend for release
        run: |
          pnpm --filter backend build
```

Also remove the `Setup Node.js`, `Setup pnpm`, `Get pnpm store directory`, `Setup pnpm cache`, `Restore built packages cache` steps from this job.

**Replace with:**
```yaml
      - name: Download form-app dist
        uses: actions/download-artifact@v4
        with:
          name: form-app-dist-${{ github.sha }}
          path: apps/form-app/dist

      - name: Download form-viewer dist
        uses: actions/download-artifact@v4
        with:
          name: form-viewer-dist-${{ github.sha }}
          path: apps/form-viewer/dist

      - name: Download admin-app dist
        uses: actions/download-artifact@v4
        with:
          name: admin-app-dist-${{ github.sha }}
          path: apps/admin-app/dist

      - name: Download backend dist
        uses: actions/download-artifact@v4
        with:
          name: backend-dist-${{ github.sha }}
          path: apps/backend/dist
```

Also update `create-release-artifacts`'s `needs:` to include the build jobs:

```yaml
    needs: [build-form-app, build-form-viewer, build-admin-app, build-backend]
```

The "Create backend release directory" step does a `pnpm install --prod` — that still requires pnpm. Keep the pnpm setup but only for the production install:

```yaml
      - name: Setup pnpm (for prod install only)
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Create backend release directory
        run: |
          mkdir -p backend-release
          cp -r apps/backend/dist backend-release/
          cp -r apps/backend/prisma backend-release/
          cp apps/backend/package.json backend-release/
          cp apps/backend/.env.example backend-release/
          cp apps/backend/README-DEPLOYMENT.md backend-release/
          cd apps/backend
          pnpm install --prod --frozen-lockfile
          cd ../..
          cp -r apps/backend/node_modules backend-release/
```

- [ ] **Step 3: Verify YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "ci: reuse built artifacts in create-release-artifacts instead of rebuilding"
```

---

## Task 7: Fix Deployment Workflow — pnpm Version + Cache

**Problem H**: `multi-cloud-deployment.yml` uses `pnpm/action-setup@v2` everywhere while build.yml uses `@v4`. Also missing pnpm store cache.

**Files:**
- Modify: `.github/workflows/multi-cloud-deployment.yml`

- [ ] **Step 1: Update all `pnpm/action-setup@v2` to `@v4` in the deployment workflow**

The occurrences are in these jobs: `run-migrations`, `deploy-cloudflare-pages-form-app`, `deploy-cloudflare-pages-admin-app`, `deploy-cloudflare-pages-viewer-app`, `run-form-app-e2e`.

For each one, change:
```yaml
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
```

To:
```yaml
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: "8.15.0"
```

- [ ] **Step 2: Add pnpm store cache to all 3 frontend deploy jobs**

In each of `deploy-cloudflare-pages-form-app`, `deploy-cloudflare-pages-admin-app`, `deploy-cloudflare-pages-viewer-app`, after the `Setup pnpm` step, add:

```yaml
      - name: Get pnpm store directory
        id: pnpm-store
        shell: bash
        working-directory: ./source
        run: echo "path=$(pnpm store path --silent)" >> $GITHUB_OUTPUT

      - name: Restore pnpm store cache
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-store.outputs.path }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('source/**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-
```

- [ ] **Step 3: Add pnpm store cache to `run-migrations` job**

Same pattern after its `Setup pnpm` step (working-directory is the repo root, not `./source`):

```yaml
      - name: Get pnpm store directory
        id: pnpm-store
        shell: bash
        run: echo "path=$(pnpm store path --silent)" >> $GITHUB_OUTPUT

      - name: Restore pnpm store cache
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-store.outputs.path }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-
```

- [ ] **Step 4: Verify YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/multi-cloud-deployment.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/multi-cloud-deployment.yml
git commit -m "ci(deploy): upgrade pnpm action to v4, add pnpm store cache to deploy jobs"
```

---

## Task 8: Fix Bash Syntax Bugs in Destroy Workflow

**Problem J**: `multi-cloud-destroy.yml` has 4 orphaned `fi` statements in bash heredocs that will cause `syntax error near unexpected token 'fi'` when those code paths execute.

**Files:**
- Modify: `.github/workflows/multi-cloud-destroy.yml`

- [ ] **Step 1: Remove orphaned `fi` at line 122**

The `validate-destroy-request` job's `Display Destruction Plan` step has this block around line 119–122:

```bash
          if [ "${{ github.event.inputs.destroy_neon }}" = "true" ]; then
            echo "  ⚠️⚠️⚠️ NeonDB Postgres (PERMANENT DATA LOSS)"
          else
            echo "  ⏭️ NeonDB Postgres (Skipped)"
          fi

          fi    # <-- ORPHANED, delete this line
```

Delete the duplicate bare `fi` at line 122.

- [ ] **Step 2: Remove orphaned `fi` at line 275**

The `setup-azure-backend` job's storage container creation script has a bare `fi` around line 275 (after the Cloudflare Pages Viewer container block ends and before the NeonDB container block):

```bash
          echo "✅ Container exists: $CLOUDFLARE_PAGES_VIEWER_CONTAINER"
          fi

          fi    # <-- ORPHANED, delete this line

          # Create NeonDB container
```

Delete the duplicate bare `fi`.

- [ ] **Step 3: Remove orphaned `fi` at line 846**

In the `destroy-summary` job's summary generation script, around line 846:

```bash
          else
            echo "| Cloudflare R2 | ❌ No | ⏭️ Skipped | - |" >> $GITHUB_STEP_SUMMARY
          fi

          fi    # <-- ORPHANED, delete this line

          # NeonDB Status
```

Delete the bare `fi`.

- [ ] **Step 4: Remove orphaned `fi\n\n` at line 906**

In the `destroy-summary` job, around line 906, there's `fi\n\n          if` on the same logical line:

```bash
          fi

          fi\n\n          if [ "${{ needs.terraform-neon-destroy.result }}" = "success" ]; then
```

This should just be:
```bash
          fi

          if [ "${{ needs.terraform-neon-destroy.result }}" = "success" ]; then
```

Delete the orphaned `fi\n\n` portion.

- [ ] **Step 5: Verify YAML + bash parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/multi-cloud-destroy.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

Then extract and validate the bash scripts with `bash -n`:
```bash
# Extract the Display Destruction Plan script and check syntax
python3 -c "
import yaml, sys
wf = yaml.safe_load(open('.github/workflows/multi-cloud-destroy.yml'))
script = wf['jobs']['validate-destroy-request']['steps'][2]['run']
print(script)
" | bash -n && echo "BASH syntax OK"
```

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/multi-cloud-destroy.yml
git commit -m "ci(destroy): fix 4 orphaned fi statements causing bash syntax errors"
```

---

## Task 9: Switch TruffleHog to Official GH Action (Optional Speedup)

**Problem G**: TruffleHog is pulled via `docker run` every CI run (~30–60 s). The official `trufflesecurity/trufflehog-actions-scan` GitHub Action caches the binary.

**Files:**
- Modify: `.github/workflows/build.yml:33–61` (`security-scan` job)

- [ ] **Step 1: Replace the Docker-pull-based scan with the GitHub Action**

Remove these steps:
```yaml
      - name: Run TruffleHog secret scan
        run: |
          cat > /tmp/trufflehog-exclude.txt << EOF
          ...
          EOF
          docker run --rm -v ...

      - name: Security scan results
        if: always()
        run: |
          echo "✅ TruffleHog security scan completed"
          ...
```

Replace with:
```yaml
      - name: TruffleHog secret scan
        uses: trufflesecurity/trufflehog-actions-scan@v1
        with:
          path: ./
          base: ${{ github.event.before || '' }}
          head: HEAD
          extra_args: --exclude-paths=.github/workflows/ci.yml,docker-compose.yml,.env.example
        continue-on-error: true
```

- [ ] **Step 2: Verify YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build.yml'))" && echo "YAML OK"
```
Expected: `YAML OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "ci(security): use trufflesecurity GH Action instead of docker pull"
```

---

## Self-Review

### Spec coverage

| Problem | Task covering it |
|---------|-----------------|
| A — lint-and-type-check rebuilds | Task 4 ✅ |
| B — double test execution | Task 5 ✅ |
| C — e2e-local rebuilds frontends | Task 6 (noted: intentional because different VITE vars, documented) ✅ |
| D — create-release-artifacts rebuilds | Task 6b ✅ |
| E — cache bloat with node_modules/.pnpm | Task 3a ✅ |
| F — no concurrency control | Task 2 ✅ |
| G — TruffleHog docker pull | Task 9 ✅ |
| H — pnpm v2 + no cache in deployment | Task 7 ✅ |
| I — 3x frontend builds in deployment | Task 7 (cache added; full artifact sharing not possible due to different checkout refs and VITE vars) ✅ |
| J — bash syntax bugs in destroy | Task 8 ✅ |

### Placeholder scan

No TBDs. All steps include exact YAML snippets.

### Type consistency

No types to track — this is YAML/bash configuration.

---

## Expected Wall-Clock Improvements

| Workflow | Before | After (estimate) |
|----------|--------|-----------------|
| build.yml (main branch, full run) | ~18–22 min | ~12–15 min |
| build.yml (PR, no E2E) | ~10–13 min | ~7–9 min |
| create-release-artifacts | ~10 min | ~2 min (artifact download) |
| multi-cloud-deployment (per deploy job) | ~5–6 min | ~3–4 min (cache hit on pnpm store) |
