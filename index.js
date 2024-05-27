#!/usr/bin/env node

const assert = require("node:assert");
const fs = require("node:fs");
const util = require("node:util");
const { dependenciesTypes, getNpmCommand, parseArgs } = require("./utils");

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
  result[t] = { ...subresult, packages: [] };
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

    for (const k in json.dependencies) {
      const d = json.dependencies[k];

      result.all.installed++;

      if (d.dev === true) {
        result.devDependencies.installed++;
        continue;
      }

      if (d.optional === true) {
        result.optionalDependencies.installed++;
        continue;
      }

      if (d.peer === true) {
        result.peerDependencies.installed++;
        continue;
      }

      result.dependencies.installed++;
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

    for (const k in json) {
      const d = json[k];

      result.all.outdated++;

      if (!result[d.type]) {
        result[d.type] = { ...subresult, packages: [] };
      }

      result[d.type].outdated++;
      result[d.type].packages.push({
        package: k,
        current: d.current,
        wanted: d.wanted,
      });
    }

    debug("outdated: OK");
  } catch (e) {
    console.error("outdated: ERROR");
    throw e;
  }
}

function post() {
  const { name, version = "undefined" } = require("./package.json");

  const mark = Number(
    parseFloat(
      result.all.outdated === 0 || result.all.installed === 0
        ? 0
        : (result.all.outdated * 100) / result.all.installed
    ).toFixed(2)
  );

  if (parsedArgs.json === true) {
    result.all.rottenDepsPercentage = mark;
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Rotten deps results for ${name}@${version}`);
  console.log(
    `${mark}% of installed packages (${result.all.installed}) are outdated (${result.all.outdated})`
  );

  for (const type of dependenciesTypes) {
    if (result[type].installed === 0) {
      continue;
    }

    console.log(`\n${type}:`);
    console.log(`\tinstalled: ${result[type].installed}`);
    console.log(`\toutdated: ${result[type].outdated}`);

    if (parsedArgs.long === true) {
      console.log(
        "List of outdated:\n",
        JSON.stringify(result[type].packages, null, 2)
      );
    }
  }

  debug("post: OK");
}

main = async () => {
  pre();
  await list();
  await outdated();
  post();
};

module.exports = main;
