#!/usr/bin/env node

const assert = require("node:assert");
const fs = require("node:fs");
const util = require("node:util");
const {
  countMark,
  getNpmCommand,
  getPackageInfo,
  parseArgs,
  safeConvertStdoutToJson,
} = require("./utils");

const exec = util.promisify(require("node:child_process").exec);

const TIMEOUT_MS = 60_000;

class Rodeps {
  _dependenciesTypes = Object.freeze([
    "all",
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]);

  _args = {};

  _result = {};

  constructor() {
    this._args = parseArgs();

    for (const t of this._dependenciesTypes) {
      this._result[t] = {
        installed: 0,
        outdatedWanted: 0,
        outdatedLatest: 0,
        outdated: 0,
        packages: {},
      };
    }
  }

  _debug = (...args) => {
    if (this._args.verbose === true) {
      console.debug(...args);
    }
  };

  _getResultsSummary = () => {
    const rottenDepsPercentage = countMark(
      this._result.all.installed,
      this._result.all.outdated
    );
    const rottenWantedDepsPercentage = countMark(
      this._result.all.installed,
      this._result.all.outdatedWanted
    );
    const rottenLatestDepsPercentage = countMark(
      this._result.all.installed,
      this._result.all.outdatedLatest
    );

    return {
      rottenDepsPercentage,
      rottenWantedDepsPercentage,
      rottenLatestDepsPercentage,
    };
  };

  _tableOutput = () => {
    const { name, version } = getPackageInfo();
    const result = this._result;

    console.log(`Rotten deps results for ${name}@${version}.`);
    console.log(`Dependencies analyzed: ${result.all.installed}.`);
    console.log(
      `${result.all.outdated} (${countMark(
        result.all.installed,
        result.all.outdated
      )}%) of installed packages are outdated.`
    );

    console.log(
      `${result.all.outdatedWanted} (${countMark(
        result.all.installed,
        result.all.outdatedWanted
      )}%) of installed packages have outdated wanted versions.`
    );

    console.log(
      `${result.all.outdatedLatest} (${countMark(
        result.all.installed,
        result.all.outdatedLatest
      )}%) of installed packages have outdated latest versions.`
    );

    const output = Object.keys(result).reduce(
      (acc, key) => {
        const {
          installed,
          outdatedWanted,
          outdatedLatest,
          outdated,
          packages,
        } = result[key];
        acc.score[key] = {
          installed,
          "outdated wanted": outdatedWanted,
          "rotten wanted, %": countMark(
            result[key].installed,
            result[key].outdatedWanted
          ),
          "outdated latest": outdatedLatest,
          "rotten latest, %": countMark(
            result[key].installed,
            result[key].outdatedLatest
          ),
          outdated,
          "rotten, %": countMark(result[key].installed, result[key].outdated),
        };
        acc.packages[key] = packages;
        return acc;
      },
      { score: {}, packages: {} }
    );

    console.table(output.score);

    // Print detailed output of outdated packages if --long flag is set
    if (this._args.long === true) {
      this._longOutput(output.packages);
    }
  };

  _longOutput = (packages) => {
    for (const key in packages) {
      const list = packages[key];

      if (!list || Object.values(list).length === 0) {
        continue;
      }

      console.log(`\nList of outdated ${key}`);
      console.table(list);
    }
  };

  pre = () => {
    this._debug("CLI args:", this._args);

    assert(fs.existsSync("package.json"), "pre: package.json not found");

    this._debug("pre: OK");
  };

  list = async () => {
    const { stdout, stderr } = await exec(
      `${getNpmCommand()} ls --long --json`,
      {
        timeout: TIMEOUT_MS,
      }
    );

    if (stderr) {
      throw new Error(stderr, { cause: "Rodeps->list->exec" });
    }

    const json = safeConvertStdoutToJson(stdout);

    for (const t of this._dependenciesTypes) {
      const installed = Object.hasOwn(json, t) ? json[t] : {};
      const len = Object.keys(installed).length;

      this._result.all.installed += len;
      this._result[t].installed += len;
    }

    this._debug("ls: OK");
  };

  outdated = async () => {
    let stdout;
    try {
      ({ stdout } = await exec(`${getNpmCommand()} outdated --json --long`, {
        timeout: TIMEOUT_MS,
      }));
    } catch (e) {
      if (!e.stdout) {
        e.cause = "Rodeps->outdated§->exec";
        throw e;
      }

      stdout = e.stdout;
    }

    const json = safeConvertStdoutToJson(stdout);

    for (const key in json) {
      const d = json[key];

      if (!this._result[d.type]) {
        console.warn(`Unknown dependency type: ${d.type}`);
        continue;
      }

      this._result.all.outdated++;

      if (d.current !== d.wanted) {
        this._result.all.outdatedWanted++;
        this._result[d.type].outdatedWanted++;
      }

      if (d.wanted !== d.latest) {
        this._result.all.outdatedLatest++;
        this._result[d.type].outdatedLatest++;
      }

      this._result[d.type].outdated++;
      this._result[d.type].packages[key] = {
        current: d.current,
        wanted: d.wanted,
        latest: d.latest,
      };
    }

    this._debug("outdated: OK");
  };

  post = () => {
    if (this._args.json === true) {
      const result = {
        ...this._result,
        all: {
          ...this._result.all,
          ...this._getResultsSummary(),
        },
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      this._tableOutput();
    }

    this._debug("post: OK");
  };
}

main = async () => {
  const rodeps = new Rodeps();

  rodeps.pre();
  await rodeps.list();
  await rodeps.outdated();
  rodeps.post();
};

module.exports = main;
module.exports.Rodeps = Rodeps;
