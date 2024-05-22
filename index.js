#!/usr/bin/env node

const assert = require("node:assert");
const fs = require("node:fs");
const util = require("node:util");

const exec = util.promisify(require("node:child_process").exec);

// TODO parse argv
const isVerbose = false;
const isLong = false;

const dependenciesTypes = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

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

function debug(msg, params) {
  if (isVerbose === true) {
    console.debug(msg, params);
  }
}

function pre() {
  try {
    assert(fs.existsSync("package.json"), "pre: package.json not found");

    debug("pre: OK");
  } catch (e) {
    console.error("pre: ERROR");
  }
}

async function list() {
  try {
    const { stdout, stderr } = await exec("npm ls --long --json", {
      timeout: 60_000,
    });

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
      ({ stdout } = await exec("npm outdated --json --long", {
        timeout: 60_000,
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

  const mark = parseFloat(
    result.all.outdated === 0 || result.all.installed === 0
      ? 0
      : (result.all.outdated * 100) / result.all.installed
  ).toFixed(2);

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

    if (isLong === true) {
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
