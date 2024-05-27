exports.parseArgs = () => {
  const argsMap = {
    long: false,
    verbose: false,
    json: false,
  };

  const allowedArgs = Object.keys(argsMap);

  const cliArgs = process.argv.slice(2);
  for (const arg of cliArgs) {
    const validatedArg = arg.replace(/^--/, "");
    if (allowedArgs.includes(validatedArg)) {
      argsMap[validatedArg] = true;
    } else {
      console.error(`Provided argument \`${validatedArg}\` is not supported`);
      printHelp();
      throw new Error("Unsupported argument");
    }
  }

  Object.freeze(argsMap);

  return argsMap;
};

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

exports.dependenciesTypes = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

exports.getNpmCommand = () =>
  process.platform === "win32" ? "npm.cmd" : "npm";
