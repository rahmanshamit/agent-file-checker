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

# post-edit check unit: missing new_string
node -e '
const fs = require("fs");
const path = require("path");
const { checkPostEdit } = require(process.argv[1]);
const p = path.join(process.cwd(), "src/hello.ts");
const ok = checkPostEdit({ filePath: p, newString: "export function hello" });
if (!ok.ok) { console.error("expected pass"); process.exit(1); }
const bad = checkPostEdit({ filePath: p, newString: "export function nope_not_here" });
if (bad.ok) { console.error("expected fail"); process.exit(1); }
console.log("post-edit-check: ok");
' "$ROOT/src/post-edit-check.js"

# Cursor adapter: simulate StrReplace success that did not land
CURSOR_MISS=$(node -e '
const p = require("path").join(process.cwd(), "src/hello.ts");
process.stdout.write(JSON.stringify({
  tool_name: "StrReplace",
  tool_input: { path: p, old_string: "hello", new_string: "export function definitely_missing_xyz" }
}));
')
OUT=$(printf '%s' "$CURSOR_MISS" | node "$ROOT/hooks/cursor/post-tool-use.js")
echo "$OUT" | node -e '
const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
if (!d.additional_context || !/disk verify failed/.test(d.additional_context)) {
  console.error("cursor hook expected additional_context failure", d);
  process.exit(1);
}
console.log("cursor hook: ok");
'

# Claude adapter: Edit miss -> decision block
CLAUDE_MISS=$(node -e '
const p = require("path").join(process.cwd(), "src/hello.ts");
process.stdout.write(JSON.stringify({
  tool_name: "Edit",
  tool_input: { file_path: p, old_string: "hello", new_string: "export function definitely_missing_xyz" }
}));
')
OUT=$(printf '%s' "$CLAUDE_MISS" | node "$ROOT/hooks/claude-code/post-tool-use.js")
echo "$OUT" | node -e '
const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
if (d.decision !== "block" || !/disk verify failed/.test(d.reason || "")) {
  console.error("claude hook expected decision block", d);
  process.exit(1);
}
console.log("claude-code hook: ok");
'

# setup-hooks --cursor merges hooks.json (use linked package path via npm pack simulation)
mkdir -p node_modules
ln -sfn "$ROOT" node_modules/agent-file-checker
"${CLI[@]}" setup-hooks --cursor --claude-code
test -f .cursor/hooks.json
test -f .claude/settings.json
grep -q 'agent-file-checker/hooks/cursor/post-tool-use' .cursor/hooks.json
grep -q 'agent-file-checker/hooks/claude-code/post-tool-use' .claude/settings.json
echo "setup-hooks adapters: ok"

echo "smoke: all checks passed"
