"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function packageRoot() {
  return path.resolve(__dirname, "..");
}

/**
 * Install local git hooks into the consumer repo (cwd).
 * Sets core.hooksPath to .githooks and copies pre-commit template.
 * @returns {number} exit code
 */
function setupHooks({ cwd }) {
  let inRepo = true;
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    inRepo = false;
  }

  if (!inRepo) {
    process.stderr.write(
      "agent-file-checker: setup-hooks requires a git working tree\n"
    );
    return 1;
  }

  const hooksDir = path.join(cwd, ".githooks");
  const targetHook = path.join(hooksDir, "pre-commit");
  const template = path.join(packageRoot(), "hooks", "pre-commit");

  if (!fs.existsSync(template)) {
    process.stderr.write(
      `agent-file-checker: missing hook template: ${template}\n`
    );
    return 1;
  }

  fs.mkdirSync(hooksDir, { recursive: true });
  fs.copyFileSync(template, targetHook);
  fs.chmodSync(targetHook, 0o755);

  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd });

  process.stdout.write(
    "ok: installed .githooks/pre-commit and set core.hooksPath=.githooks\n"
  );
  process.stdout.write(
    "     pre-commit runs: agent-file-checker verify-changed\n"
  );
  return 0;
}

module.exports = { setupHooks };
