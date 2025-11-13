#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: auto-release-tag.sh [--level <patch|minor|major>] [--message <commit message>]

Creates a commit (if there are staged or unstaged changes), bumps the git tag
according to the requested level, and pushes both the branch and the new tag to origin.
If no commit message is provided, a default "Release vX.Y.Z" message is used.
EOF
}

release_level="patch"
commit_message=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --level)
      release_level="${2:-}"
      if [[ -z "$release_level" ]]; then
        usage
        exit 1
      fi
      shift 2
      ;;
    --message|-m)
      commit_message="${2:-}"
      if [[ -z "$commit_message" ]]; then
        usage
        exit 1
      fi
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

last_tag=$(git tag --sort=-v:refname | head -n 1 || true)
if [[ -z "$last_tag" ]]; then
  major=1
  minor=0
  patch=0
else
  if [[ ! $last_tag =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    printf 'Last tag %s is not in vMAJOR.MINOR.PATCH format\n' "$last_tag" >&2
    exit 1
  fi
  major=${BASH_REMATCH[1]}
  minor=${BASH_REMATCH[2]}
  patch=${BASH_REMATCH[3]}
fi

case "$release_level" in
  patch)
    patch=$((patch + 1))
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  major)
    major=$((major + 1))
    minor=0
    patch=0
    ;;
  *)
    printf 'Unknown release level: %s (use patch, minor, or major)\n' "$release_level" >&2
    exit 1
    ;;
esac

new_tag="v${major}.${minor}.${patch}"

if git rev-parse "$new_tag" >/dev/null 2>&1; then
  printf 'Tag %s already exists. Aborting.\n' "$new_tag" >&2
  exit 1
fi

branch=$(git rev-parse --abbrev-ref HEAD)

status=$(git status --porcelain)
if [[ -n "$status" ]]; then
  git add --all
  message=${commit_message:-"Release ${new_tag}"}
  git commit -m "$message"
else
  if [[ -n "$commit_message" ]]; then
    printf 'No changes to commit; ignoring provided commit message.\n'
  fi
fi

if [[ -z ${commit_message:-} ]]; then
  commit_message="Release ${new_tag}"
fi

git tag -a "$new_tag" -m "Release ${new_tag}"

git push origin "$branch"
git push origin "$new_tag"

printf 'Created and pushed %s on branch %s.\n' "$new_tag" "$branch"
