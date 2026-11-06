# Agent instructions — agent-file-checker

Use this CLI to prove file writes landed on disk before wiring imports or claiming work done.

## Commands

Run from the **consumer project** root (the repo you are editing), with the package installed or invoked via path:

```bash
npx agent-file-checker verify <path> --expect '<literal substring>' [--expect '...']
npx agent-file-checker write  <path> --expect '<literal substring>'   # contents on stdin
npx agent-file-checker verify-changed [--root <dir>]
```

Or if installed locally:

```bash
node node_modules/agent-file-checker/bin/agent-file-checker.js verify ...
```

## Required workflow

1. **After creating or changing an exported module:** use `write` with `--expect` for each public export you will import next, **or** use your normal write tool then immediately run `verify` with those `--expect` strings.
2. **Do not** treat a Write/Edit tool success alone as proof the file is on disk.
3. **Before editing importers or saying a multi-file task is done:** run `verify-changed`.
4. Do **not** use a full Docker/image rebuild as the verify step.

## Examples

```bash
# Write + verify in one step
npx agent-file-checker write src/utils/foo.ts \
  --expect 'export function foo' <<'EOF'
export function foo() {
  return true;
}
EOF

# Or verify after a native editor write
npx agent-file-checker verify src/utils/foo.ts --expect 'export function foo'

# End of multi-file work
npx agent-file-checker verify-changed --root src
```

Exit code `0` means pass; non-zero means stop and fix before continuing.
