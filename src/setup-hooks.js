"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function packageRoot() {
  return path.resolve(__dirname, "..");
}

function ensureGitHooks({ cwd }) {
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
      "agent-file-checker: --git requires a git working tree\n"
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
    "ok: git pre-commit -> agent-file-checker verify-changed\n"
  );
  return 0;
}

function cursorCommand() {
  return "node node_modules/agent-file-checker/hooks/cursor/post-tool-use.js";
}

function claudeCommand() {
  return "node node_modules/agent-file-checker/hooks/claude-code/post-tool-use.js";
}

function isOurCursorHook(entry) {
  const command = String((entry && entry.command) || "");
  return command.includes("agent-file-checker") && command.includes("post-tool-use");
}

function isOurClaudeHook(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  if (String(entry.matcher || "").includes("Edit|Write") || String(entry.matcher || "") === "Write|Edit") {
    const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
    return hooks.some((h) =>
      String((h && h.command) || "").includes("agent-file-checker")
    );
  }
  const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
  return hooks.some((h) =>
    String((h && h.command) || "").includes("agent-file-checker/hooks/claude-code")
  );
}

function ensureCursorHooks({ cwd }) {
  const cursorDir = path.join(cwd, ".cursor");
  const hooksJsonPath = path.join(cursorDir, "hooks.json");
  fs.mkdirSync(cursorDir, { recursive: true });

  let config = { version: 1, hooks: {} };
  if (fs.existsSync(hooksJsonPath)) {
    try {
      config = JSON.parse(fs.readFileSync(hooksJsonPath, "utf8"));
    } catch (error) {
      process.stderr.write(
        `agent-file-checker: cannot parse ${hooksJsonPath}: ${error.message}\n`
      );
      return 1;
    }
  }

  if (!config || typeof config !== "object") {
    config = { version: 1, hooks: {} };
  }
  if (!config.version) {
    config.version = 1;
  }
  if (!config.hooks || typeof config.hooks !== "object") {
    config.hooks = {};
  }

  const existing = Array.isArray(config.hooks.postToolUse)
    ? config.hooks.postToolUse.filter((h) => !isOurCursorHook(h))
    : [];

  existing.push({
    command: cursorCommand(),
    matcher: "Write|StrReplace",
  });
  config.hooks.postToolUse = existing;

  fs.writeFileSync(hooksJsonPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  process.stdout.write(
    "ok: Cursor postToolUse -> disk verify (Write|StrReplace)\n"
  );
  process.stdout.write(`     ${hooksJsonPath}\n`);
  return 0;
}

function ensureClaudeCodeHooks({ cwd }) {
  const claudeDir = path.join(cwd, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");
  fs.mkdirSync(claudeDir, { recursive: true });

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch (error) {
      process.stderr.write(
        `agent-file-checker: cannot parse ${settingsPath}: ${error.message}\n`
      );
      return 1;
    }
  }

  if (!settings || typeof settings !== "object") {
    settings = {};
  }
  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }

  const existing = Array.isArray(settings.hooks.PostToolUse)
    ? settings.hooks.PostToolUse.filter((h) => !isOurClaudeHook(h))
    : [];

  existing.push({
    matcher: "Edit|Write",
    hooks: [
      {
        type: "command",
        command: claudeCommand(),
      },
    ],
  });
  settings.hooks.PostToolUse = existing;

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  process.stdout.write(
    "ok: Claude Code PostToolUse -> disk verify (Edit|Write)\n"
  );
  process.stdout.write(`     ${settingsPath}\n`);
  return 0;
}

/**
 * @param {{ cwd: string, targets?: string[] }} opts
 * @returns {number}
 */
function setupHooks({ cwd, targets }) {
  let selected = targets;
  if (!selected || selected.length === 0) {
    selected = ["git"];
  }

  if (selected.includes("all")) {
    selected = ["git", "cursor", "claude-code"];
  }

  const allowed = new Set(["git", "cursor", "claude-code", "all"]);
  for (const t of selected) {
    if (!allowed.has(t)) {
      process.stderr.write(
        `agent-file-checker: unknown setup target: ${t}\n` +
          "  use: --git --cursor --claude-code  or  --all\n"
      );
      return 1;
    }
  }

  let code = 0;
  if (selected.includes("git")) {
    code = ensureGitHooks({ cwd }) || code;
  }
  if (selected.includes("cursor")) {
    code = ensureCursorHooks({ cwd }) || code;
  }
  if (selected.includes("claude-code")) {
    code = ensureClaudeCodeHooks({ cwd }) || code;
  }
  return code;
}

module.exports = {
  setupHooks,
  ensureGitHooks,
  ensureCursorHooks,
  ensureClaudeCodeHooks,
};
