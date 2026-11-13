## File write verification (agent-file-checker)

The **agent** runs these checks (not the human). Prefer installed auto-hooks (`setup-hooks --cursor` / `--claude-code` / `--all`) for write≠disk after Write/Edit.

For export-heavy modules, also prove the symbols you will import next:

```bash
npx agent-file-checker write <path> --expect '<export or unique string>'   # stdin = file body
# or after a normal write:
npx agent-file-checker verify <path> --expect '<export or unique string>'
```

Before finishing multi-file work:

```bash
npx agent-file-checker verify-changed --root src
```

Do not treat editor/agent Write success alone as proof the file landed. Exit code must be 0. If a hook reports disk verify failed, fix before continuing.
