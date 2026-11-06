"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function resolvePath(cwd, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
}

function isTracked(cwd, absolutePath) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", absolutePath], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function hasGitDiff(cwd, absolutePath) {
  try {
    const unstaged = execFileSync(
      "git",
      ["diff", "--name-only", "--", absolutePath],
      { cwd, encoding: "utf8" }
    ).trim();
    const staged = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--", absolutePath],
      { cwd, encoding: "utf8" }
    ).trim();
    return Boolean(unstaged || staged);
  } catch {
    return false;
  }
}

/**
 * Verify one file on disk.
 * @returns {number} exit code
 */
function verifyFile({ filePath, expects, requireDiff = false, cwd }) {
  const absolutePath = resolvePath(cwd, filePath);

  if (!fs.existsSync(absolutePath)) {
    process.stderr.write(
      `agent-file-checker: missing file: ${filePath}\n`
    );
    return 1;
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    process.stderr.write(
      `agent-file-checker: not a regular file: ${filePath}\n`
    );
    return 1;
  }

  if (stat.size === 0) {
    process.stderr.write(`agent-file-checker: empty file: ${filePath}\n`);
    return 1;
  }

  const contents = fs.readFileSync(absolutePath, "utf8");

  for (const expect of expects) {
    if (!contents.includes(expect)) {
      process.stderr.write(
        `agent-file-checker: expected text not found in ${filePath}:\n  ${expect}\n`
      );
      return 1;
    }
  }

  if (requireDiff) {
    const tracked = isTracked(cwd, absolutePath);
    if (tracked && !hasGitDiff(cwd, absolutePath)) {
      process.stderr.write(
        `agent-file-checker: --require-diff set but git sees no change for tracked file: ${filePath}\n`
      );
      return 1;
    }
  }

  process.stdout.write(`ok: ${filePath}\n`);
  return 0;
}

module.exports = {
  verifyFile,
  resolvePath,
  isTracked,
  hasGitDiff,
};
