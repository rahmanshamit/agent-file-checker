# agent-file-checker

Agent-agnostic CLI: **prove a file write landed on disk** before dependents or “done.”

Coding agents sometimes report a successful write when the file is missing, empty, or missing the exports they later import. This tool is a fast check (existence + literal `--expect` strings + optional git changed-file scan). No full project build required.

## Why this exists

### Failure mode

1. Agent (or tool) reports a write/edit as successful.
2. Nothing re-checks the file on disk before the next step.
3. Agent imports symbols or claims “done” from that assumed state.
4. Build / `tsc` / runtime fails — often much later.

This is not “the model invented an API from the internet.” It is **local consistency failure**: the session treats “Write returned OK” as “disk matches intent,” then continues.

Typical shape we hit in practice:

- Controller imports `filterVesselIdsByYearAndSanctions` / `hasYearOrSanctionsFilters`.
- Those exports were planned for a util file and assumed written.
- On disk the util file still only had the older parser — no those exports.
- `tsc` / Docker build failed with `TS2305: Module has no exported member …`.

A harness that allowed parallel “write file” + “wire imports” without a disk check made that easy. Soft rules (“please verify after write”) are not enough; this CLI makes the check an **exit code** any agent can run.

### Public reports (same class of bug, other products)

**Claude Code**

- [Subagents report tasks complete without verifying writes](https://github.com/anthropics/claude-code/issues/46755) — claims files fixed/created; disk still old or missing. Ask: re-read after Edit/Write before “done.”
- [Edit reports success / shows content; disk unchanged](https://github.com/anthropics/claude-code/issues/5178)
- [Edit succeeds in tool; Read shows edit; `git diff` empty](https://github.com/anthropics/claude-code/issues/61471) — cache vs disk divergence
- [Blind edit-and-proceed / no post-edit verify](https://github.com/anthropics/claude-code/issues/32658)

**Cursor**

- [Write missing `path`/`contents` after stream truncate](https://forum.cursor.com/t/agent-write-errors-with-missing-path-contents-after-large-stream-or-disconnect/160228) — agent can think it wrote; args never fully arrive
- [StrReplace “success” but silent truncate on large files](https://forum.cursor.com/t/agent-strreplace-truncates-files-8-mib-silent-data-loss/166573) — tool reports OK; file wrong on disk
- [Cloud Agent Write fails while the flow looks like it worked](https://forum.cursor.com/t/cloud-agent-write-tool-fails-on-minimal-write-only-new-file-test/162020)

**Pattern people keep naming**

1. Agent or tool **reports success**
2. **No hard re-verify** against disk before the next step
3. Later: build / user check exposes the mismatch

So this is a known **weak verification** failure mode across coding-agent products — not Cursor-only.

### What this tool does about it

| Moment | Command | Proof |
|--------|---------|--------|
| After a write | `write` or `verify` + `--expect` | File exists, non-empty, contains the exports/strings you will rely on next |
| End of multi-file work | `verify-changed` | Git-touched paths under a root exist and are non-empty |
| Optional commit backstop | `setup-hooks` | Same `verify-changed` on commit if the agent skipped checks |

Fast (grep / existence). Agent-agnostic (shell + exit codes). Not a full Docker rebuild.

## Install (no npm publish)

From a consumer project:

```bash
# path install (local clone)
npm install -D /Users/clause/Documents/Clause_dev/agent_file_checker

# or after you push to GitHub
npm install -D github:<you>/agent_file_checker
```

Optional local git hook (runs `verify-changed` on commit):

```bash
npx agent-file-checker setup-hooks
```

## Commands

```bash
npx agent-file-checker verify <path> --expect '<str>' [--expect '<str>'] [--require-diff]
npx agent-file-checker write  <path> --expect '<str>'   # file contents on stdin
npx agent-file-checker verify-changed [--root <dir>]
npx agent-file-checker setup-hooks
```

| Command | What it checks |
|--------|----------------|
| `verify` | File exists, non-empty, contains each `--expect` literal; optional git diff for tracked files |
| `write` | Writes stdin to path, then `verify` |
| `verify-changed` | Every git-changed path under `--root` exists and is non-empty |
| `setup-hooks` | Installs `.githooks/pre-commit` in the **current** repo |

## Wire into any coding agent

1. Install this package in the project (see above).
2. Paste [`examples/AGENTS.snippet.md`](examples/AGENTS.snippet.md) into that project’s `AGENTS.md`, Cursor rules, or equivalent.
3. Agents run the CLI via shell; exit `0` / non-zero is the contract.

Full agent-facing text: [`AGENTS.md`](AGENTS.md).

## Optional npm scripts in a consumer repo

```json
{
  "scripts": {
    "agent:verify": "agent-file-checker verify",
    "agent:write": "agent-file-checker write",
    "agent:verify:changed": "agent-file-checker verify-changed"
  }
}
```

## Develop / smoke

```bash
cd /Users/clause/Documents/Clause_dev/agent_file_checker
chmod +x bin/agent-file-checker.js hooks/pre-commit scripts/smoke.sh
npm run test:smoke
```

## Not in v1

- npm registry publish
- Full `tsc` / Docker as the verify gate
- Cursor-only PostToolUse hooks
- AST / import-graph analysis
