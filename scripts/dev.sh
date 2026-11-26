#!/usr/bin/env bash
# Runs a package.json script, optionally inside a local wrapper.
#
# To use a wrapper (for example one that opens database access and closes it again on exit),
# set DEV_DB_WRAPPER in apps/backend/.env to the path of an executable. It is called as:
#   <wrapper> run <command...>
# Without that setting this is the same as running the pnpm script directly.
set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:?Usage: scripts/dev.sh <pnpm-script>}"
wrapper=""
if [ -f apps/backend/.env ]; then
  wrapper="$(sed -n 's/^DEV_DB_WRAPPER=//p' apps/backend/.env | tail -n 1 | tr -d "\"'\r")"
fi

if [ -z "$wrapper" ]; then
  exec pnpm run "$target"
fi
if [ ! -x "$wrapper" ]; then
  echo "DEV_DB_WRAPPER is not an executable file: $wrapper" >&2
  exit 1
fi
exec "$wrapper" run pnpm run "$target"
