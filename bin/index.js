#!/usr/bin/env node

const run = require("../index");

run()
  .then(() => void 0)
  .catch((error) => console.error("Error", { error }));
