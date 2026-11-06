"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function runGit(cwd, args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function collectChangedPaths(cwd) {
  const unstaged = runGit(cwd, ["diff", "--name-only"]);
  const staged = runGit(cwd, ["diff", "--cached", "--name-only"]);
  const untracked = runGit(cwd, [
    "ls-files",
    "--others",
    "--exclude-standard",
  ]);

  return Array.from(new Set([...unstaged, ...staged, ...untracked]));
}

function isUnderRoot(filePath, rootAbsolute) {
  const absolute = path.resolve(filePath);
  const relative = path.relative(rootAbsolute, absolute);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Verify all git-changed files under root exist and are non-empty.
 * Does not require --expect (that belongs on per-write verify).
 * @returns {number} exit code
 */
function verifyChanged({ root, cwd }) {
  const rootAbsolute = path.isAbsolute(root)
    ? root
    : path.resolve(cwd, root);

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
      "agent-file-checker: verify-changed requires a git working tree\n"
    );
    return 1;
  }

  const changed = collectChangedPaths(cwd).filter((filePath) => {
    const absolute = path.resolve(cwd, filePath);
    return isUnderRoot(absolute, rootAbsolute);
  });

  if (changed.length === 0) {
    process.stdout.write("ok: no changed files\n");
    return 0;
  }

  let failed = 0;

  for (const filePath of changed) {
    const absolute = path.resolve(cwd, filePath);

    // Deleted files show up in diff; treat missing as failure for "claimed write landed"
    if (!fs.existsSync(absolute)) {
      process.stderr.write(
        `agent-file-checker: changed path missing on disk: ${filePath}\n`
      );
      failed += 1;
      continue;
    }

    const stat = fs.statSync(absolute);
    if (!stat.isFile()) {
      // directories / specials: skip
      continue;
    }

    if (stat.size === 0) {
      process.stderr.write(
        `agent-file-checker: changed file is empty: ${filePath}\n`
      );
      failed += 1;
      continue;
    }

    process.stdout.write(`ok: ${filePath}\n`);
  }

  if (failed > 0) {
    process.stderr.write(
      `agent-file-checker: verify-changed failed (${failed} issue(s))\n`
    );
    return 1;
  }

  process.stdout.write(`ok: verified ${changed.length} changed path(s)\n`);
  return 0;
}

module.exports = { verifyChanged, collectChangedPaths };
