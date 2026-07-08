#!/bin/bash
#
# One-time setup for a freshly created git worktree of dculus-forms.
#
# Worktrees share the repo's git history but NOT its gitignored files
# (.env, node_modules, generated Prisma client, built package dist/ dirs).
# This script copies/builds what's missing so `pnpm dev` works.
#
# Usage (run from anywhere inside the worktree):
#   ./scripts/setup-worktree.sh
#   ./scripts/setup-worktree.sh --force   # overwrite existing .env files too

set -e

FORCE=false
if [ "$1" = "--force" ]; then
  FORCE=true
fi

WORKTREE_ROOT="$(git rev-parse --show-toplevel)"
cd "$WORKTREE_ROOT"

# The main checkout is always the first entry from `git worktree list`.
MAIN_ROOT="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"

if [ "$MAIN_ROOT" = "$WORKTREE_ROOT" ]; then
  echo "This is the main checkout, not a worktree — nothing to do."
  exit 0
fi

echo "Main checkout:  $MAIN_ROOT"
echo "This worktree:  $WORKTREE_ROOT"
echo

echo "==> Copying .env files from the main checkout"
for app in backend form-app form-viewer admin-app; do
  src="$MAIN_ROOT/apps/$app/.env"
  dest="$WORKTREE_ROOT/apps/$app/.env"

  if [ ! -f "$src" ]; then
    echo "  skip $app: no .env in main checkout"
    continue
  fi

  if [ -f "$dest" ] && [ "$FORCE" != "true" ]; then
    echo "  skip $app: .env already exists (use --force to overwrite)"
    continue
  fi

  cp "$src" "$dest"
  echo "  copied $app/.env"
done
echo

if [ ! -d "$WORKTREE_ROOT/node_modules" ]; then
  echo "==> Installing dependencies (node_modules missing)"
  pnpm install
  echo
fi

echo "==> Building workspace packages (@dculus/types, @dculus/utils, @dculus/ui, @dculus/plugins)"
pnpm --filter @dculus/types --filter @dculus/utils --filter @dculus/ui --filter @dculus/plugins build
echo

echo "==> Generating Prisma client"
pnpm db:generate
echo

echo "Setup complete. You can now run: pnpm dev"
