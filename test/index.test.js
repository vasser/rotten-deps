const {
  describe,
  it,
  mock,
  before,
  after,
  beforeEach,
  afterEach,
} = require("node:test");
const assert = require("node:assert");
const child_process = require("node:child_process");
const fs = require("node:fs");

const { Rodeps } = require("../index");

const defaultArgs = Object.freeze(["node", "index.js"]);

describe("Rodeps class - constructor", () => {
  let rodeps;

  before(() => {
    // Ensure default args (no flags)
    process.argv = defaultArgs;
    rodeps = new Rodeps();
  });

  after(() => {
    rodeps = null;
  });

  it("should initialize with default values", () => {
    assert.deepStrictEqual(rodeps._args, {
      long: false,
      verbose: false,
      json: false,
    });
    assert.deepStrictEqual(rodeps._result, {
      all: {
        installed: 0,
        outdatedWanted: 0,
        outdatedLatest: 0,
        outdated: 0,
        packages: {},
      },
      dependencies: {
        installed: 0,
        outdatedWanted: 0,
        outdatedLatest: 0,
        outdated: 0,
        packages: {},
      },
      devDependencies: {
        installed: 0,
        outdatedWanted: 0,
        outdatedLatest: 0,
        outdated: 0,
        packages: {},
      },
      optionalDependencies: {
        installed: 0,
        outdatedWanted: 0,
        outdatedLatest: 0,
        outdated: 0,
        packages: {},
      },
      peerDependencies: {
        installed: 0,
        outdatedWanted: 0,
        outdatedLatest: 0,
        outdated: 0,
        packages: {},
      },
    });
  });
});

describe("Rodeps class - methods", () => {
  let originalExec;
  let originalExistsSync;
  let rodeps;

  const lsJson = JSON.stringify({
    dependencies: { a: {}, b: {} },
    devDependencies: { c: {} },
    optionalDependencies: {},
    peerDependencies: { d: {}, e: {}, f: {} },
  });

  const outdatedJson = JSON.stringify({
    a: {
      current: "1.0.0",
      wanted: "1.1.0",
      latest: "2.0.0",
      type: "dependencies",
    },
    c: {
      current: "1.0.0",
      wanted: "1.0.0",
      latest: "1.2.0",
      type: "devDependencies",
    },
    x: {
      current: "0.1.0",
      wanted: "0.2.0",
      latest: "0.2.0",
      type: "peerDependencies",
    },
    unknownPkg: {
      current: "0.0.1",
      wanted: "0.0.2",
      latest: "0.1.0",
      type: "someCustomType",
    },
  });

  beforeEach(() => {
    process.argv = defaultArgs;

    // Patch child_process.exec BEFORE re-requiring module under test
    originalExec = child_process.exec;

    child_process.exec = (cmd, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }

      if (/ls --long --json/.test(cmd)) {
        return callback(null, { stdout: lsJson, stderr: "" });
      }

      if (/outdated --json --long/.test(cmd)) {
        // Simulate npm outdated exit code (error) but still provide stdout
        const err = new Error("Command failed: npm outdated");
        err.code = 1;
        err.stdout = outdatedJson;
        err.stderr = "";
        return callback(err, { stdout: outdatedJson, stderr: "" });
      }

      return callback(null, { stdout: "{}", stderr: "" });
    };

    // Remove cached module so that internal exec (promisified) picks up our patched exec
    delete require.cache[require.resolve("../index")];
    const mod = require("../index");
    rodeps = new mod.Rodeps();

    // fs.existsSync -> true by default
    originalExistsSync = fs.existsSync;
    fs.existsSync = mock.fn(() => true);
  });

  afterEach(() => {
    fs.existsSync = originalExistsSync;
    child_process.exec = originalExec;
    rodeps = null;
  });

  it("pre() should pass when package.json exists", () => {
    assert.doesNotThrow(() => rodeps.pre());
  });

  it("pre() should throw when package.json missing", () => {
    fs.existsSync.mock.mockImplementation(() => false);
    assert.throws(() => rodeps.pre(), /package.json not found/);
  });

  it("list() should count installed dependencies across categories", async () => {
    await rodeps.list();
    assert.strictEqual(rodeps._result.all.installed, 6); // 2 + 1 + 0 + 3
    assert.strictEqual(rodeps._result.dependencies.installed, 2);
    assert.strictEqual(rodeps._result.devDependencies.installed, 1);
    assert.strictEqual(rodeps._result.optionalDependencies.installed, 0);
    assert.strictEqual(rodeps._result.peerDependencies.installed, 3);
  });

  it("outdated() should count and categorize outdated deps (including wanted/latest) and ignore unknown types", async () => {
    await rodeps.list();
    const warnSpy = mock.method(console, "warn", () => {});
    await rodeps.outdated();

    assert.strictEqual(rodeps._result.all.outdated, 3); // unknown type ignored
    assert.strictEqual(rodeps._result.all.outdatedWanted, 2); // a + x
    assert.strictEqual(rodeps._result.all.outdatedLatest, 2); // a + c

    // dependencies category (a)
    assert.deepStrictEqual(rodeps._result.dependencies, {
      installed: 2,
      outdatedWanted: 1,
      outdatedLatest: 1,
      outdated: 1,
      packages: {
        a: { current: "1.0.0", wanted: "1.1.0", latest: "2.0.0" },
      },
    });

    // devDependencies category (c)
    assert.deepStrictEqual(rodeps._result.devDependencies, {
      installed: 1,
      outdatedWanted: 0,
      outdatedLatest: 1,
      outdated: 1,
      packages: {
        c: { current: "1.0.0", wanted: "1.0.0", latest: "1.2.0" },
      },
    });

    // peerDependencies category (x)
    assert.deepStrictEqual(rodeps._result.peerDependencies, {
      installed: 3,
      outdatedWanted: 1,
      outdatedLatest: 0,
      outdated: 1,
      packages: {
        x: { current: "0.1.0", wanted: "0.2.0", latest: "0.2.0" },
      },
    });

    // optionalDependencies untouched
    assert.deepStrictEqual(rodeps._result.optionalDependencies, {
      installed: 0,
      outdatedWanted: 0,
      outdatedLatest: 0,
      outdated: 0,
      packages: {},
    });

    assert.strictEqual(warnSpy.mock.calls.length, 1); // unknown type warned once
    warnSpy.mock.restore();
  });

  it("post() with --json should output summary and results", async () => {
    // Need a fresh instance with --json
    process.argv = [...defaultArgs, "--json"];

    // Rebuild module & instance so args are parsed with json flag
    delete require.cache[require.resolve("../index")];
    const mod = require("../index");
    rodeps = new mod.Rodeps();
    await rodeps.list();
    await rodeps.outdated();

    const logSpy = mock.method(console, "log", () => {});
    rodeps.post();

    // Collect JSON output argument (last console.log call should be JSON blob)
    const calls = logSpy.mock.calls.map((c) => c.arguments[0]);
    const jsonStr = calls.find(
      (c) => typeof c === "string" && c.includes("summary")
    );
    assert(jsonStr, "Expected JSON output with summary");
    const output = JSON.parse(jsonStr);

    assert.deepStrictEqual(output.summary.all, {
      rottenDepsPercentage: 50, // 3 of 6
      rottenWantedDepsPercentage: 33.33, // 2 of 6
      rottenLatestDepsPercentage: 33.33, // 2 of 6
    });

    logSpy.mock.restore();
  });
});

describe("Rodeps class - output variants", () => {
  let originalExec;
  let originalExistsSync;
  let rodeps;

  const lsJson = JSON.stringify({
    dependencies: { a: {} },
    devDependencies: { c: {} },
    peerDependencies: { x: {} },
  });
  const outdatedJson = JSON.stringify({
    a: {
      current: "1.0.0",
      wanted: "1.1.0",
      latest: "2.0.0",
      type: "dependencies",
    },
    c: {
      current: "1.0.0",
      wanted: "1.0.0",
      latest: "1.2.0",
      type: "devDependencies",
    },
    x: {
      current: "0.1.0",
      wanted: "0.2.0",
      latest: "0.2.0",
      type: "peerDependencies",
    },
  });

  beforeEach(async () => {
    process.argv = defaultArgs;
    originalExec = child_process.exec;
    child_process.exec = (cmd, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      if (/ls --long --json/.test(cmd))
        return callback(null, { stdout: lsJson, stderr: "" });
      if (/outdated --json --long/.test(cmd)) {
        const err = new Error("Command failed");
        err.stdout = outdatedJson;
        err.stderr = "";
        err.code = 1;
        return callback(err, { stdout: outdatedJson, stderr: "" });
      }
      return callback(null, { stdout: "{}", stderr: "" });
    };
    delete require.cache[require.resolve("../index")];
    const mod = require("../index");
    rodeps = new mod.Rodeps();
    originalExistsSync = fs.existsSync;
    fs.existsSync = () => true;
    rodeps.pre();
    await rodeps.list();
    await rodeps.outdated();
  });

  afterEach(() => {
    child_process.exec = originalExec;
    fs.existsSync = originalExistsSync;
    rodeps = null;
  });

  it("post() should print table output with expected keys", () => {
    const tableSpy = mock.method(console, "table", () => {});
    const logSpy = mock.method(console, "log", () => {});
    rodeps.post();
    assert.ok(
      tableSpy.mock.calls.length >= 1,
      "console.table should be called at least once"
    );
    const scoreArg = tableSpy.mock.calls[0].arguments[0];
    [
      "all",
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ].forEach((k) => {
      assert.ok(Object.hasOwn(scoreArg, k), `Missing key ${k} in table output`);
    });
    // installed counts
    assert.strictEqual(scoreArg.dependencies.installed, 1);
    assert.strictEqual(scoreArg.devDependencies.installed, 1);
    assert.strictEqual(scoreArg.peerDependencies.installed, 1);
    tableSpy.mock.restore();
    logSpy.mock.restore();
  });

  it("post() with --long should include detailed package sections", async () => {
    process.argv = [...defaultArgs, "--long"]; // enable long flag
    delete require.cache[require.resolve("../index")];
    const mod = require("../index");
    rodeps = new mod.Rodeps();
    await rodeps.list();
    await rodeps.outdated();
    const logSpy = mock.method(console, "log", () => {});
    const tableSpy = mock.method(console, "table", () => {});
    rodeps.post();
    const logs = logSpy.mock.calls.map((c) => c.arguments[0]);
    assert(
      logs.some((l) => /List of outdated dependencies/.test(l)),
      "Should log list for dependencies"
    );
    assert(
      logs.some((l) => /List of outdated devDependencies/.test(l)),
      "Should log list for devDependencies"
    );
    assert(
      logs.some((l) => /List of outdated peerDependencies/.test(l)),
      "Should log list for peerDependencies"
    );
    // Expect 1 score table + 3 detailed tables
    assert.strictEqual(tableSpy.mock.calls.length, 4);
    logSpy.mock.restore();
    tableSpy.mock.restore();
  });
});

describe("Rodeps class - no outdated scenario", () => {
  let originalExec;
  let originalExistsSync;
  let rodeps;
  const lsJson = JSON.stringify({ dependencies: { a: {} } });
  const outdatedJson = JSON.stringify({});

  beforeEach(async () => {
    process.argv = [...defaultArgs, "--json"]; // json output for easier assertions
    originalExec = child_process.exec;
    child_process.exec = (cmd, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      if (/ls --long --json/.test(cmd))
        return callback(null, { stdout: lsJson, stderr: "" });
      if (/outdated --json --long/.test(cmd)) {
        const err = new Error("Command failed");
        err.stdout = outdatedJson;
        err.stderr = "";
        err.code = 1;
        return callback(err, { stdout: outdatedJson, stderr: "" });
      }
      return callback(null, { stdout: "{}", stderr: "" });
    };
    delete require.cache[require.resolve("../index")];
    const mod = require("../index");
    rodeps = new mod.Rodeps();
    originalExistsSync = fs.existsSync;
    fs.existsSync = () => true;
    rodeps.pre();
    await rodeps.list();
    await rodeps.outdated();
  });

  afterEach(() => {
    child_process.exec = originalExec;
    fs.existsSync = originalExistsSync;
    rodeps = null;
  });

  it("should have zero outdated counts and 0% marks", () => {
    const logSpy = mock.method(console, "log", () => {});
    rodeps.post();
    const jsonStr = logSpy.mock.calls
      .map((c) => c.arguments[0])
      .find((s) => typeof s === "string" && s.includes("summary"));
    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(parsed.all.outdated, 0);
    assert.strictEqual(parsed.all.outdatedWanted, 0);
    assert.strictEqual(parsed.all.outdatedLatest, 0);
    assert.deepStrictEqual(parsed.summary.all, {
      rottenDepsPercentage: 0,
      rottenWantedDepsPercentage: 0,
      rottenLatestDepsPercentage: 0,
    });
    logSpy.mock.restore();
  });
});
