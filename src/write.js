"use strict";

const fs = require("fs");
const path = require("path");
const { verifyFile, resolvePath } = require("./verify");

function readStdin(stdin) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stdin.on("data", (chunk) => chunks.push(chunk));
    stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    stdin.on("error", reject);
  });
}

/**
 * Write file from stdin, then verify.
 * @returns {Promise<number>} exit code
 */
async function writeAndVerify({ filePath, expects, cwd, stdin }) {
  const absolutePath = resolvePath(cwd, filePath);
  const contents = await readStdin(stdin);

  if (contents.length === 0) {
    process.stderr.write(
      "agent-file-checker: write received empty stdin; refusing to write\n"
    );
    return 1;
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, "utf8");

  return verifyFile({
    filePath,
    expects,
    requireDiff: false,
    cwd,
  });
}

module.exports = { writeAndVerify };
