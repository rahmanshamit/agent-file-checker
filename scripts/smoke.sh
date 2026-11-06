#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI=(node "$ROOT/bin/agent-file-checker.js")
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

cd "$TMP"
git init -q
git config user.email "smoke@example.com"
git config user.name "Smoke"

# write + verify pass
printf '%s\n' 'export function hello() { return 1; }' | \
  "${CLI[@]}" write src/hello.ts --expect 'export function hello'

"${CLI[@]}" verify src/hello.ts --expect 'export function hello'

# verify fail: missing expect
if "${CLI[@]}" verify src/hello.ts --expect 'export function missing' 2>/dev/null; then
  echo "expected verify to fail for missing expect" >&2
  exit 1
fi

# verify-changed should see untracked file
"${CLI[@]}" verify-changed --root src

# empty file should fail verify-changed
: > src/empty.ts
if "${CLI[@]}" verify-changed --root src 2>/dev/null; then
  echo "expected verify-changed to fail on empty file" >&2
  exit 1
fi
rm src/empty.ts

echo "smoke: all checks passed"
