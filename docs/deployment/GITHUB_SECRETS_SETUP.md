# GitHub Secrets Setup

Cloud deployment no longer happens from this repository. Infrastructure (Terraform), deployment workflows
and their credentials live in a separate private infrastructure repository, so this repo holds no cloud
credentials.

This repo's workflows only need:

- `GITHUB_TOKEN` (automatic): build and push the backend image to GHCR, create releases.
- `AI_PRIMARY_*` / `AI_FAST_*`: AI evaluation workflow.
- `NPM_TOKEN`: publishing `@dculus/form-renderer`.

To self-host, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).
