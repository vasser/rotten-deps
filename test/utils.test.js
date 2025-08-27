const { describe, it, mock, before, after } = require("node:test");
const assert = require("node:assert");

const utils = require("../utils");

const testArgsMap = {
  long: false,
  verbose: false,
  json: false,
};

describe("utils", () => {
  describe("parseArgs", () => {
    it("should parse args", () => {
      const argsMap = utils.parseArgs();

      assert.deepStrictEqual(argsMap, { ...testArgsMap });
    });

    ["long", "json", "verbose"].forEach((arg) => {
      it(`should accept --${arg} arg`, () => {
        process.argv = ["node", "index.js", `--${arg}`];

        const argsMap = utils.parseArgs();

        assert.deepStrictEqual(argsMap, {
          ...testArgsMap,
          [arg]: true,
        });
      });
    });

    it("should throw and print help for invalid args", () => {
      const printHelp = mock.fn();
      utils.printHelp = printHelp;

      process.argv = ["node", "index.js", "--invalid-arg"];

      assert.throws(utils.parseArgs, { message: /Unsupported argument/ });
      assert(printHelp.mock.callCount, 1);
    });
  });

  describe("getNpmCommand", () => {
    it("should return npm command based on platform", () => {
      const expectedCommand = process.platform === "win32" ? "npm.cmd" : "npm";
      const npmCommand = utils.getNpmCommand();

      assert.strictEqual(npmCommand, expectedCommand);
    });
  });

  describe("getPackageInfo", () => {
    let originalReadFileSync;

    before(() => {
      originalReadFileSync = require("node:fs").readFileSync;
    });

    after(() => {
      require("node:fs").readFileSync = originalReadFileSync;
    });

    it("should return package name and version from package.json", () => {
      require("node:fs").readFileSync = mock.fn(() => {
        return JSON.stringify({ name: "rodeps", version: "1.0.0" });
      });

      const packageInfo = utils.getPackageInfo();

      assert.strictEqual(packageInfo.name, "rodeps");
      assert.strictEqual(packageInfo.version, "1.0.0");
    });

    it("should handle missing package.json gracefully", () => {
      require("node:fs").readFileSync = () => {
        throw new Error("File not found");
      };

      const packageInfo = utils.getPackageInfo();

      assert.deepStrictEqual(packageInfo, {
        version: "unknown",
        name: "unknown",
      });
    });
  });

  describe("countMark", () => {
    it("should return percentage of outdated packages", () => {
      const installed = 100;
      const outdated = 20;

      const mark = utils.countMark(installed, outdated);

      assert.strictEqual(mark, 20.0);
    });

    it("should return percentage of outdated packages (string)", () => {
      const installed = "100";
      const outdated = "20";

      const mark = utils.countMark(installed, outdated);

      assert.strictEqual(mark, 20.0);
    });

    it("should return 0% for no installed packages", () => {
      const installed = 0;
      const outdated = 20;

      const mark = utils.countMark(installed, outdated);

      assert.strictEqual(mark, 0.0);
    });

    it("should return 0% for no undefined arguments", () => {
      const mark = utils.countMark();

      assert.strictEqual(mark, 0.0);
    });
  });

  describe("safeConvertStdoutToJson", () => {
    it("should convert valid JSON string to object", () => {
      const jsonString = '{"key": "value"}';
      const result = utils.safeConvertStdoutToJson(jsonString);

      assert.deepStrictEqual(result, { key: "value" });
    });

    it("should return empty object for invalid JSON string", () => {
      const invalidJsonString = "invalid json";
      const result = utils.safeConvertStdoutToJson(invalidJsonString);

      assert.deepStrictEqual(result, {});
    });
  });
});
