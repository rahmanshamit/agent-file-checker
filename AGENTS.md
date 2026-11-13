# Agent instructions — agent-file-checker

Use this CLI (and installed host hooks) to prove file writes landed on disk before wiring imports or claiming work done.

**Who runs it:** the coding agent — not the human. After Write/Edit of a module others will import, the agent must run `verify` with `--expect` for those symbols (or rely on host auto-hooks for write≠disk, then still `verify --expect` for export intent). Exit non-zero means stop and fix; do not claim done.

## Commands

Run from the **consumer project** root (the repo you are editing), with the package installed:

```bash
npx agent-file-checker verify <path> --expect '<literal substring>' [--expect '...']
npx agent-file-checker write  <path> --expect '<literal substring>'   # contents on stdin
npx agent-file-checker verify-changed [--root <dir>]
npx agent-file-checker setup-hooks [--git] [--cursor] [--claude-code] [--all]
```

## Auto-triggers

If the project ran `setup-hooks --cursor` or `--claude-code` (or `--all`):

- **Cursor:** after `Write` / `StrReplace`, a hook checks disk. On failure you receive `additional_context` — treat Write success as false; fix and re-check.
- **Claude Code:** after `Edit` / `Write`, a hook checks disk. On failure the hook **blocks** with a reason — fix disk before continuing.

Do not ignore those messages.

## Required workflow

1. **After creating or changing an exported module:** rely on the host hook when installed; for explicit proof use `verify` with `--expect` for each public export you will import next, **or** use `write` with those `--expect` strings.
2. **Do not** treat a Write/Edit tool success alone as proof the file is on disk.
3. **Before editing importers or saying a multi-file task is done:** run `verify-changed` if hooks only covered per-edit checks.
4. Do **not** use a full Docker/image rebuild as the verify step.

## Examples

```bash
npx agent-file-checker write src/utils/foo.ts \
  --expect 'export function foo' <<'EOF'
export function foo() {
  return true;
}
EOF

npx agent-file-checker verify src/utils/foo.ts --expect 'export function foo'

npx agent-file-checker verify-changed --root src
```

Exit code `0` means pass; non-zero means stop and fix before continuing.
