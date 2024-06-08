[![Rodeps](https://github.com/vasser/rotten-deps/actions/workflows/rotten-deps.yml/badge.svg)](https://github.com/vasser/rotten-deps/actions/workflows/rotten-deps.yml) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/rodeps)

<!-- TOC -->

- [Rotten Dependencies rodeps](#rotten-dependencies-rodeps)
  - [Purpose](#purpose)
  - [Features](#features)
  - [Usage](#usage)
    - [Installation](#installation)
    - [Options](#options)
  - [Integration with CI/CD](#integration-with-cicd)
    - [Parsing output](#parsing-output)
    - [Github Actions](#github-actions)
    - [CircleCI](#circleci)
    - [Using rodeps in NPM postinstall hook](#using-rodeps-in-npm-postinstall-hook)
  - [Outputs](#outputs)
  - [Contributing](#contributing)
  - [License](#license)

<!-- /TOC -->

# Rotten Dependencies (rodeps)

This package analyzes the dependencies listed in a `package.json` file and reports how outdated they are. It is designed to help maintainers keep their dependencies up-to-date by providing clear, actionable insights into their dependency landscape.

## Purpose

The primary purpose of this script is to shift left in the software development lifecycle. By incorporating dependency checks early in the CI/CD pipeline, on operation dashboards, or in day-to-day code checks, teams can proactively manage their dependencies, reducing the risk of security vulnerabilities and ensuring compatibility with the latest features and bug fixes.

## Features

- **Detailed reporting**: Provides a summary of all dependencies, including the percentage of outdated packages.
- **Zero dependencies**: This script is implemented with no external dependencies, relying solely on Node.js built-in modules, ensuring lightweight and fast execution.
- **Verbose and detailed output options**: Configure the script to output detailed lists of outdated packages if needed.
- **CI/CD integration**: Easily integrate this script into your CI/CD pipelines to automatically check for outdated dependencies with every build.

## Usage

### Installation

Install it from npmjs.org:

```sh
npm i --save-dev rodeps
```

Or run without installation using `npx`:

```sh
npx rodeps
```

### Options

- `--long`: Output a detailed list of outdated packages. This option will be ignored if used with `--json`.
- `--json`: Output in JSON format to the results can be parsed. Takes precenence over `--long` if used simultaneously.
- `--verbose`: Enable verbose output for debugging purposes.

Example:

```sh
npx rodeps --verbose --long
```

## CI integrations and automation

To integrate this package into your CI/CD pipeline, you can use `--json` option and parse the output using `jq` (or any other tool to manipilate JSON).

### Parsing output

Example of parsing JSON output that returns percentage of all outdated packages in analyzed repo:

```sh
npx rodeps --json | jq '.all.rottenDepsPercentage' # returns integer or float, e.g.: 25.89
```

Example of parsing table output using `awk`:

```sh
npx rodeps | awk 'NR==2 { print $1 }' # returns string, e.g.: 25.89%
```

### Github Actions

GitHub Actions workflow example. This workflow installs dependencies, analyzes repo and fails run if percentage of outdated packages greater or equal of variable `RODEPS_THRESHOLD`:

```yaml
name: Rodeps

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  rotten-deps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci --quiet --no-audit --no-fund
      - name: Check outdated dependencies
        run: |
          SCORE=$(npx rodeps --json | jq '.all.rottenDepsPercentage')
          if [ "$(echo "$SCORE <= $RODEPS_THRESHOLD" | bc)" -le 0 ]; then echo "Outdated dependencies $SCORE breach threashold $RODEPS_THRESHOLD"; exit 1; else echo "Outdated dependencies score $SCORE is ok"; fi
```

### CircleCI

CircleCI job example. This workflow installs dependencies, analyzes repo and fails run if percentage of outdated packages greater or equal of variable `RODEPS_THRESHOLD`:

```yaml
version: 2.1

jobs:
  rotten-deps:
    docker:
      - image: cimg/node:17.2.0
    steps:
      - checkout
      - npm ci
      - run:
          name: Check outdated dependencies
          command: |
            RODEPS_THRESHOLD=50
            SCORE=$(npx rodeps --json | jq '.all.rottenDepsPercentage')
            if [ "$(echo "$SCORE <= $RODEPS_THRESHOLD" | bc)" -le 0 ]; then echo "Outdated dependencies $SCORE breach threashold $RODEPS_THRESHOLD"; exit 1; else echo "Outdated dependencies score $SCORE is ok"; fi

workflows:
  my-workflow:
    jobs:
      - rotten-deps
```

### Using rodeps in NPM postinstall hook

It is possible to run `rodeps` on every install command in the project. In that case after `npm install` or `npm ci` command will appear result of outdated dependencies analysis. This can be enabled by adding this script to the `package.json` file:

```json
"scripts": {
  ...
  "postinstall": "if [ -z $CI ]; then npx -y rodeps; fi"
}
```

Note `if [ -z $CI ];` - checks whether hook is not executed in non-continious integration environment. This is added to reduce the time of install command and eliminate excessive output.

## Outputs

The script outputs a summary of the dependency status, for example:

```
Rotten deps results for <project-name>@<version>
12.5% of installed packages (104) are outdated (13)
┌──────────────────────┬───────────┬──────────┬───────────┐
│       (index)        │ installed │ outdated │ rotten, % │
├──────────────────────┼───────────┼──────────┼───────────┤
│         all          │    104    │    13    │   12.5    │
│     dependencies     │    95     │    6     │   6.32    │
│   devDependencies    │     9     │    7     │   77.78   │
│ optionalDependencies │     0     │    0     │     0     │
│   peerDependencies   │     0     │    0     │     0     │
└──────────────────────┴───────────┴──────────┴───────────┘
```

If the `--long` option is used, it will also output a detailed list of outdated packages.

If the `--json` option is used, it will output entire report in JSON format, including lists of outdated packages. This options excludes `--long` and might be useful in CI/CD or automated runs.

Results of `--json` invoked output can be parsed programmaticaly or stored in the file for the further analysis.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
