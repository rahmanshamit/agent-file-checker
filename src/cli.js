"use strict";

const { verifyFile } = require("./verify");
const { writeAndVerify } = require("./write");
const { verifyChanged } = require("./verify-changed");
const { setupHooks } = require("./setup-hooks");

function printUsage() {
  process.stderr.write(`Usage:
  agent-file-checker verify <path> --expect <str> [--expect <str>...] [--require-diff]
  agent-file-checker write  <path> --expect <str> [--expect <str>...]
      (file contents on stdin)
  agent-file-checker verify-changed [--root <dir>]
  agent-file-checker setup-hooks

Exit 0 on success, non-zero on failure.
`);
}

function parseArgs(argv) {
  const positional = [];
  const expects = [];
  let requireDiff = false;
  let root = ".";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--expect") {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error("--expect requires a value");
      }
      expects.push(value);
      i += 1;
      continue;
    }

    if (arg === "--require-diff") {
      requireDiff = true;
      continue;
    }

    if (arg === "--root") {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error("--root requires a value");
      }
      root = value;
      i += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      return { command: "help", positional, expects, requireDiff, root };
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  const command = positional[0] || "help";
  return {
    command,
    positional: positional.slice(1),
    expects,
    requireDiff,
    root,
  };
}

async function runCli(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`agent-file-checker: ${message}\n`);
    printUsage();
    return 1;
  }

  const { command, positional, expects, requireDiff, root } = parsed;

  if (command === "help") {
    printUsage();
    return 0;
  }

  if (command === "verify") {
    const filePath = positional[0];
    if (!filePath) {
      process.stderr.write("agent-file-checker: verify requires <path>\n");
      printUsage();
      return 1;
    }
    if (expects.length === 0) {
      process.stderr.write(
        "agent-file-checker: verify requires at least one --expect <str>\n"
      );
      return 1;
    }
    return verifyFile({
      filePath,
      expects,
      requireDiff,
      cwd: process.cwd(),
    });
  }

  if (command === "write") {
    const filePath = positional[0];
    if (!filePath) {
      process.stderr.write("agent-file-checker: write requires <path>\n");
      printUsage();
      return 1;
    }
    if (expects.length === 0) {
      process.stderr.write(
        "agent-file-checker: write requires at least one --expect <str>\n"
      );
      return 1;
    }
    return writeAndVerify({
      filePath,
      expects,
      cwd: process.cwd(),
      stdin: process.stdin,
    });
  }

  if (command === "verify-changed") {
    return verifyChanged({
      root,
      cwd: process.cwd(),
    });
  }

  if (command === "setup-hooks") {
    return setupHooks({
      cwd: process.cwd(),
    });
  }

  process.stderr.write(`agent-file-checker: unknown command: ${command}\n`);
  printUsage();
  return 1;
}

module.exports = { runCli, parseArgs };
