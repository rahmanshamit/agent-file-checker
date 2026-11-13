"use strict";

const fs = require("fs");

const DEFAULT_MIN_CHARS = 5;

function minCharsFromEnv() {
  const raw = process.env.AGENT_FILE_CHECKER_MIN_CHARS;
  if (raw === undefined || raw === "") {
    return DEFAULT_MIN_CHARS;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_CHARS;
}

/**
 * Prove a claimed Write/Edit landed on disk.
 * @param {{ filePath: string, fullContent?: string|null, newString?: string|null, oldString?: string|null, minChars?: number }} opts
 * @returns {{ ok: boolean, problems: string[] }}
 */
function checkPostEdit({
  filePath,
  fullContent = null,
  newString = null,
  oldString = null,
  minChars = minCharsFromEnv(),
}) {
  const problems = [];

  if (!filePath) {
    problems.push("missing file path in tool input");
    return { ok: false, problems };
  }

  if (!fs.existsSync(filePath)) {
    problems.push(`file missing on disk after write/edit: ${filePath}`);
    return { ok: false, problems };
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    problems.push(`cannot stat ${filePath}: ${error.message}`);
    return { ok: false, problems };
  }

  if (!stat.isFile()) {
    problems.push(`not a regular file: ${filePath}`);
    return { ok: false, problems };
  }

  if (stat.size === 0) {
    problems.push(`file empty on disk after write/edit: ${filePath}`);
    return { ok: false, problems };
  }

  let disk;
  try {
    disk = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    problems.push(`cannot read ${filePath}: ${error.message}`);
    return { ok: false, problems };
  }

  if (typeof fullContent === "string" && fullContent.length >= minChars) {
    if (disk !== fullContent && !disk.includes(fullContent)) {
      problems.push(
        `Write content not found on disk for ${filePath} (tool claimed success; disk differs)`
      );
    }
  }

  if (typeof newString === "string" && newString.length >= minChars) {
    if (!disk.includes(newString)) {
      problems.push(
        `expected new edit text not found in ${filePath} (Edit/StrReplace may not have applied)`
      );
      if (
        typeof oldString === "string" &&
        oldString.length > 0 &&
        oldString !== newString &&
        disk.includes(oldString)
      ) {
        problems.push(
          `original text still present in ${filePath}; edit may have missed the target occurrence`
        );
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Normalize Write / Edit / StrReplace tool_input shapes across hosts.
 * @param {object} toolInput
 * @returns {{ filePath: string, fullContent: string|null, newString: string|null, oldString: string|null }}
 */
function extractEditClaim(toolInput) {
  const input = toolInput && typeof toolInput === "object" ? toolInput : {};
  const filePath =
    input.file_path || input.filePath || input.path || input.target_file || "";

  const fullContent =
    typeof input.content === "string"
      ? input.content
      : typeof input.contents === "string"
        ? input.contents
        : null;

  const newString =
    typeof input.new_string === "string"
      ? input.new_string
      : typeof input.newString === "string"
        ? input.newString
        : null;

  const oldString =
    typeof input.old_string === "string"
      ? input.old_string
      : typeof input.oldString === "string"
        ? input.oldString
        : null;

  return { filePath, fullContent, newString, oldString };
}

module.exports = {
  checkPostEdit,
  extractEditClaim,
  minCharsFromEnv,
  DEFAULT_MIN_CHARS,
};
