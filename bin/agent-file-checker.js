#!/usr/bin/env node
"use strict";

const { runCli } = require("../src/cli");

runCli(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`agent-file-checker: ${message}\n`);
    process.exit(1);
  });
