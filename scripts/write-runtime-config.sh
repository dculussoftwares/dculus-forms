#!/usr/bin/env bash
# Writes <dist>/config.js (window.__APP_CONFIG__) from the VITE_* variables in the environment.
# Usage: VITE_API_URL=... write-runtime-config.sh <dist-dir> [REQUIRED_KEY ...]
set -euo pipefail

dist="${1:?usage: write-runtime-config.sh <dist-dir> [REQUIRED_KEY ...]}"
shift

[ -d "$dist" ] || { echo "❌ $dist is not a directory" >&2; exit 1; }

config=$(jq -nc 'env | with_entries(select((.key | startswith("VITE_")) and (.value | length > 0)))')

for key in "$@"; do
  if [ "$(jq -r --arg k "$key" 'has($k)' <<< "$config")" != "true" ]; then
    echo "❌ Required runtime config '$key' is empty" >&2
    exit 1
  fi
done

printf 'window.__APP_CONFIG__ = %s;\n' "$config" > "$dist/config.js"
# Keys only: values may include non-public deployment details.
echo "✅ Wrote $dist/config.js with keys: $(jq -r 'keys | join(", ")' <<< "$config")"
