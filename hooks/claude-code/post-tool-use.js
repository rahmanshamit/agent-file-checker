#!/usr/bin/env node
"use strict";

/**
 * Claude Code PostToolUse adapter for agent-file-checker.
 * Matcher: Edit|Write
 * On failure: decision block + reason so the agent must address disk mismatch.
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

  const toolName = String(payload.tool_name || "");
  if (!/^(Edit|Write)$/i.test(toolName)) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const toolResponse = payload.tool_response;
  if (
    toolResponse &&
    typeof toolResponse === "object" &&
    toolResponse.success === false
  ) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const toolInput =
    payload.tool_input && typeof payload.tool_input === "object"
      ? payload.tool_input
      : {};
  const claim = extractEditClaim(toolInput);
  const result = checkPostEdit(claim);

  if (result.ok) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const detail = result.problems.join(" ");
  const reason =
    `agent-file-checker: disk verify failed after ${toolName}. ${detail} ` +
    `Do not treat the tool success as proof. Re-read the file, fix the write, ` +
    `then continue only after disk matches.`;

  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason,
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: reason,
      },
      systemMessage: reason,
    }) + "\n"
  );
  process.exit(0);
}

main().catch(() => {
  process.stdout.write("{}\n");
  process.exit(0);
});
