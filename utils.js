const fs = require("node:fs");

const printHelp = () => {
  console.log(
    "\nThis package analyzes the dependencies listed in a `package.json`" +
      "file and reports how outdated they are.\n"
  );
  console.log("Options:");
  console.log("\t--long\t\tOutput a detailed list of outdated packages");
  console.log("\t--json\t\tOutput in JSON format to the results can be parsed");
  console.log("\t--verbose\tEnable verbose output for debugging purposes");
};

/**
 * Parses command line arguments.
 * @returns {Object} The parsed arguments.
 */
exports.parseArgs = () => {
  const argsMap = {
    long: false,
    verbose: false,
    json: false,
  };

  // Skip the first two arguments which are node and script name
  const cliArgs = process.argv.slice(2);
  for (const arg of cliArgs) {
    // arguments are passed with the `--` prefix
    const validatedArg = arg.replace(/^--/, "");
    if (argsMap[validatedArg] !== undefined) {
      argsMap[validatedArg] = true;
    } else {
      printHelp();
      throw new Error(
        `Unsupported argument. ${validatedArg} is not in the list: ${Object.keys(argsMap).join(", ")}`
      );
    }
  }

  Object.freeze(argsMap);

  return argsMap;
};

/**
 * Retrieves the npm command to use based on the current platform.
 * @returns {string} The npm command to use.
 */
exports.getNpmCommand = () =>
  process.platform === "win32" ? "npm.cmd" : "npm";

/**
 * Retrieves the name and version of the package from the package.json file.
 * @returns {{ name: string, version: string }} The package name and version.
 */
exports.getPackageInfo = () => {
  try {
    const { name, version } = JSON.parse(fs.readFileSync("package.json"));

    return { name, version };
  } catch (_) {
    console.error("Could not retrieve analyzed package name and version");
    return {
      name: "unknown",
      version: "unknown",
    };
  }
};

/**
 * Calculates the percentage of outdated packages.
 * @param {*} installed
 * @param {*} outdated
 * @returns {number} Percentage of outdated packages, a number in fixed-point notation.
 */
exports.countMark = (installed = 0, outdated = 0) => {
  return Number(
    parseFloat(
      outdated === 0 || installed === 0 ? 0 : (outdated * 100) / installed
    ).toFixed(2)
  );
};

/**
 * Safely converts the stdout output to JSON.
 * @param {*} stdout
 * @returns {Object} The parsed JSON object or an empty object if parsing fails.
 */
exports.safeConvertStdoutToJson = (stdout = {}) => {
  try {
    return JSON.parse(stdout);
  } catch {
    return {};
  }
};
