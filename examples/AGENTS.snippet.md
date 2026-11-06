## File write verification (agent-file-checker)

After creating or changing exported modules, prove the file is on disk before wiring imports:

```bash
npx agent-file-checker write <path> --expect '<export or unique string>'   # stdin = file body
# or after a normal write:
npx agent-file-checker verify <path> --expect '<export or unique string>'
```

Before finishing multi-file work:

```bash
npx agent-file-checker verify-changed --root src
```

Do not treat editor/agent Write success alone as proof the file landed. Exit code must be 0.
