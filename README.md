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

A harness that allowed parallel “write file” + “wire imports” without a disk check made that easy. Soft rules (“please verify after write”) are not enough; this CLI makes the check an **exit code** any agent can run. Auto-triggers (Cursor / Claude Code hooks) run the same check after Write/Edit without relying on the model to remember.

### Public reports (same class of bug, other products)

**Claude Code**

- [Subagents report tasks complete without verifying writes](https://github.com/anthropics/claude-code/issues/46755) — claims files fixed/created; disk still old or missing. Ask: re-read after Edit/Write before “done.”
- [Edit reports success / shows content; disk unchanged](https://github.com/anthropics/claude-code/issues/5178)
- [Edit succeeds in tool; Read shows edit; `git diff` empty](https://github.com/anthropics/claude-code/issues/61471) — cache vs disk divergence
- [Blind edit-and-proceed / no post-edit verify](https://github.com/anthropics/claude-code/issues/32658)
- Unmerged prior art: [edit-verifier plugin PR #32755](https://github.com/anthropics/claude-code/pull/32755)

**Cursor**

- [Write missing `path`/`contents` after stream truncate](https://forum.cursor.com/t/agent-write-errors-with-missing-path-contents-after-large-stream-or-disconnect/160228) — agent can think it wrote; args never fully arrive
- [StrReplace “success” but silent truncate on large files](https://forum.cursor.com/t/agent-strreplace-truncates-files-8-mib-silent-data-loss/166573) — tool reports OK; file wrong on disk
- [Cloud Agent Write fails while the flow looks like it worked](https://forum.cursor.com/t/cloud-agent-write-tool-fails-on-minimal-write-only-new-file-test/162020)

### What this tool does about it

| Moment | Command / hook | Proof |
|--------|----------------|--------|
| After a write | `write` or `verify` + `--expect` | File exists, non-empty, contains the exports/strings you will rely on next |
| After Write/Edit (auto) | Cursor / Claude Code PostToolUse hooks | Claimed content / `new_string` is on disk |
| End of multi-file work | `verify-changed` | Git-touched paths under a root exist and are non-empty |
| Optional commit backstop | `setup-hooks --git` | Same `verify-changed` on commit if the agent skipped checks |

Fast (grep / existence). Agent-agnostic CLI. Host-specific auto-triggers. Not a full Docker rebuild.

## Install (no npm publish)

From a consumer project:

```bash
# path install (local clone)
npm install -D /Users/clause/Documents/Clause_dev/agent_file_checker

# or from GitHub
npm install -D github:rahmanshamit/agent-file-checker
```

### Auto-triggers + git backstop

```bash
# everything we ship today
npx agent-file-checker setup-hooks --all

# or pick targets
npx agent-file-checker setup-hooks --git
npx agent-file-checker setup-hooks --cursor
npx agent-file-checker setup-hooks --claude-code
```

| Target | What it installs |
|--------|------------------|
| `--git` | `.githooks/pre-commit` → `verify-changed` (default if you pass no flags) |
| `--cursor` | Merges into `.cursor/hooks.json`: `postToolUse` for `Write\|StrReplace` |
| `--claude-code` | Merges into `.claude/settings.json`: `PostToolUse` for `Edit\|Write` |
| `--all` | git + Cursor + Claude Code |

Hooks call `node node_modules/agent-file-checker/hooks/...`, so the package must be installed in that project.

- **Cursor:** on failure, injects `additional_context` (cannot block a write that already finished).
- **Claude Code:** on failure, returns `decision: "block"` plus reason so the agent must address the mismatch.
- Optional: `AGENT_FILE_CHECKER_MIN_CHARS` (default `5`) — skip substring checks for shorter replacements; still checks exists + non-empty.

## Commands

```bash
npx agent-file-checker verify <path> --expect '<str>' [--expect '<str>'] [--require-diff]
npx agent-file-checker write  <path> --expect '<str>'   # file contents on stdin
npx agent-file-checker verify-changed [--root <dir>]
npx agent-file-checker setup-hooks [--git] [--cursor] [--claude-code] [--all]
```

| Command | What it checks |
|--------|----------------|
| `verify` | File exists, non-empty, contains each `--expect` literal; optional git diff for tracked files |
| `write` | Writes stdin to path, then `verify` |
| `verify-changed` | Every git-changed path under `--root` exists and is non-empty |
| `setup-hooks` | Installs git and/or agent-host auto-triggers in the **current** repo |

## Wire into any coding agent

1. Install this package in the project (see above).
2. Run `setup-hooks --cursor` and/or `--claude-code` (or `--all`) so writes are checked automatically.
3. Optionally paste [`examples/AGENTS.snippet.md`](examples/AGENTS.snippet.md) into `AGENTS.md` / rules for manual `verify` on export-heavy steps.
4. CLI exit `0` / non-zero remains the contract for explicit checks.

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
chmod +x bin/agent-file-checker.js hooks/pre-commit hooks/cursor/post-tool-use.js hooks/claude-code/post-tool-use.js scripts/smoke.sh
npm run test:smoke
```

## Not in this version

- npm registry publish
- Full `tsc` / Docker as the verify gate
- Import-graph / missing-module resolution
- AST analysis
- Auto-triggers for hosts other than Cursor and Claude Code
