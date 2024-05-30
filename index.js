#!/usr/bin/env node

const assert = require("node:assert");
const fs = require("node:fs");
const util = require("node:util");
const {
  dependenciesTypes,
  getNpmCommand,
  parseArgs,
  getPackageInfo,
  countMark,
} = require("./utils");

const exec = util.promisify(require("node:child_process").exec);

const TIMEOUT_MS = 60_000;

let parsedArgs;
try {
  parsedArgs = parseArgs();
} catch (error) {
  process.exit(1);
}

const debug = (...args) => {
  if (parsedArgs && parsedArgs.verbose === true) {
    console.debug(...args);
  }
};

const formatOutput = () => {
  const { name, version } = getPackageInfo();

  console.log(`Rotten deps results for ${name}@${version}`);
  console.log(
    `${countMark(result.all)}% of installed packages (${
      result.all.installed
    }) are outdated (${result.all.outdated})`
  );

  const output = Object.keys(result).reduce(
    (acc, key) => {
      const { installed, outdated, packages } = result[key];
      acc.score[key] = {
        installed,
        outdated,
        "rotten, %": countMark(result[key]),
      };
      acc.packages[key] = packages;
      return acc;
    },
    { score: {}, packages: {} }
  );

  console.table(output.score);

  if (parsedArgs.long === true) {
    for (const key in output.packages) {
      const list = output.packages[key];

      if (!list || Object.values(list).length === 0) {
        continue;
      }

      console.log(`\nList of outdated ${key}`);
      console.table(list);
    }
  }
};

const subresult = {
  installed: 0,
  outdated: 0,
};

const result = {
  all: {
    installed: 0,
    outdated: 0,
  },
};

for (const t of dependenciesTypes) {
  result[t] = { ...subresult, packages: {} };
}

function pre() {
  debug("CLI args:", parsedArgs);

  try {
    assert(fs.existsSync("package.json"), "pre: package.json not found");

    debug("pre: OK");
  } catch (e) {
    console.error("pre: ERROR");
  }
}

async function list() {
  try {
    const { stdout, stderr } = await exec(
      `${getNpmCommand()} ls --long --json`,
      {
        timeout: TIMEOUT_MS,
      }
    );

    if (stderr) {
      console.error("npm ls: Error: ", stderr);
      return;
    }

    let json = {};

    try {
      json = JSON.parse(stdout);
    } catch {}

    for (const t of dependenciesTypes) {
      const installed = Object.hasOwn(json, t) ? json[t] : {};
      const len = Object.keys(installed).length;

      result.all.installed += len;
      result[t].installed += len;
    }

    debug("ls: OK");
  } catch (e) {
    console.error("ls: ERROR");
    throw e;
  }
}

async function outdated() {
  try {
    let stdout;
    try {
      ({ stdout } = await exec(`${getNpmCommand()} outdated --json --long`, {
        timeout: TIMEOUT_MS,
      }));
    } catch (e) {
      if (!e.stdout) {
        throw e;
      }

      stdout = e.stdout;
    }

    let json = {};

    try {
      json = JSON.parse(stdout);
    } catch {}

    for (const key in json) {
      const d = json[key];

      result.all.outdated++;

      if (!result[d.type]) {
        result[d.type] = { ...subresult, packages: {} };
      }

      result[d.type].outdated++;
      result[d.type].packages[key] = {
        current: d.current,
        wanted: d.wanted,
      };
    }

    debug("outdated: OK");
  } catch (e) {
    console.error("outdated: ERROR");
    throw e;
  }
}

function post() {
  if (parsedArgs.json === true) {
    result.all.rottenDepsPercentage = countMark(result.all);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  formatOutput();

  debug("post: OK");
}

main = async () => {
  pre();
  await list();
  await outdated();
  post();
};

module.exports = main;
