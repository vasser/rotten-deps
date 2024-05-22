#!/usr/bin/env node

const run = require("../index");

run()
  .then(() => void 0)
  .catch((e) => console.error("Error", e.message));
