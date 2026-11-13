#!/usr/bin/env node
"use strict";

/**
 * Cursor postToolUse adapter for agent-file-checker.
 * Matcher: Write|StrReplace
 * On failure: inject additional_context (Cursor cannot block a completed write).
 */

const { checkPostEdit, extractEditClaim } = require("../../src/post-edit-check");

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
  });
}

function parseToolInput(raw) {
  if (raw && typeof raw === "object") {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

async function main() {
  let payload = {};
  try {
    const text = await readStdin();
    if (text.trim()) {
      payload = JSON.parse(text);
    }
  } catch {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const toolName = String(payload.tool_name || payload.toolName || "");
  if (!/^(Write|StrReplace)$/i.test(toolName)) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const toolInput = parseToolInput(payload.tool_input || payload.toolInput);
  const claim = extractEditClaim(toolInput);
  const result = checkPostEdit(claim);

  if (result.ok) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const detail = result.problems.join(" ");
  const message =
    `agent-file-checker: disk verify failed after ${toolName}. ${detail} ` +
    `Do not treat the Write/StrReplace tool success as proof. Re-read the file, ` +
    `fix the write, then re-verify before continuing.`;

  process.stdout.write(
    JSON.stringify({ additional_context: message }) + "\n"
  );
  process.exit(0);
}

main().catch(() => {
  process.stdout.write("{}\n");
  process.exit(0);
});
