[![Rodeps](https://github.com/vasser/rotten-deps/actions/workflows/rotten-deps.yml/badge.svg)](https://github.com/vasser/rotten-deps/actions/workflows/rotten-deps.yml) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/rodeps)

# Rotten Dependencies (rodeps)

Rotten Dependencies package analyzes the dependencies tree in the `package.json` file and reports how outdated they are. It is designed to help maintainers keep their dependencies up-to-date by providing clear, actionable insights into their dependency landscape.

<!-- TOC -->

- [Rotten Dependencies rodeps](#rotten-dependencies-rodeps)
  - [Purpose](#purpose)
  - [Features](#features)
  - [Usage](#usage)
    - [Installation](#installation)
    - [Options](#options)
  - [CI integrations and automation](#ci-integrations-and-automation)
    - [Parsing output](#parsing-output)
    - [Github Actions](#github-actions)
    - [CircleCI](#circleci)
    - [Bitbucket Pipelines](#bitbucket-pipelines)
    - [Using rodeps in NPM postinstall hook](#using-rodeps-in-npm-postinstall-hook)
  - [Outputs](#outputs)
    - [Default output](#default-output)
    - [JSON output](#json-output)
  - [Limitations](#limitations)
  - [Contributing](#contributing)
  - [License](#license)

<!-- /TOC -->

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
- `--json`: Output in JSON format to the results can be parsed. It takes precedence over `--long` if used simultaneously.
- `--verbose`: Enable verbose output for debugging purposes.

Example:

```sh
npx rodeps --verbose --long
```

## CI integrations and automation

To integrate this package into your CI/CD pipeline, you can use `--json` option and parse the output using `jq` (or any other tool to work with JSON).

### Parsing output

Example of parsing JSON output that returns a percentage of all outdated packages in the analyzed repo:

```sh
npx -y rodeps --json | jq '.all.rottenDepsPercentage' # returns integer or float, e.g.: 25.89
```

Example of parsing table output using `awk`:

```sh
npx -y rodeps | awk -F'[()]*' 'NR==3 { print $2 }' # returns string, percentage of all outdated deps from line 3, e.g.: 25.89%
```

### Github Actions

GitHub Actions workflow example. This workflow installs dependencies, analyzes the repo, and fails run if the percentage of outdated packages is greater or equal to variable `RODEPS_THRESHOLD`:

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
          SCORE=$( -y rodeps --json | jq '.all.rottenDepsPercentage')
          if [ "$(echo "$SCORE <= $RODEPS_THRESHOLD" | bc)" -le 0 ]; then echo "Outdated dependencies $SCORE breach threshold $RODEPS_THRESHOLD"; exit 1; else echo "Outdated dependencies score $SCORE is ok"; fi
```

### CircleCI

CircleCI job example. This workflow installs dependencies, analyzes the repo, and fails run if the percentage of outdated packages is greater or equal to the variable `RODEPS_THRESHOLD`:

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
            SCORE=$(npx -y rodeps --json | jq '.all.rottenDepsPercentage')
            if [ "$(echo "$SCORE <= $RODEPS_THRESHOLD" | bc)" -le 0 ]; then echo "Outdated dependencies $SCORE breach threshold $RODEPS_THRESHOLD"; exit 1; else echo "Outdated dependencies score $SCORE is ok"; fi

workflows:
  my-workflow:
    jobs:
      - rotten-deps
```

### Bitbucket Pipelines

Bitbucket pipelines example. This workflow installs dependencies, analyzes the repo, and fails run if the percentage of outdated packages is greater or equal to the variable `RODEPS_THRESHOLD`:

```yaml
image: atlassian/default-image:5

pipelines:
  default:
    - parallel:
        - step:
            name: Check outdated dependencies
            script:
              - npm ci --quiet --no-audit --no-fund
              - |
                SCORE=$(npx -y rodeps --json | jq '.all.rottenDepsPercentage')
                RODEPS_THRESHOLD=${RODEPS_THRESHOLD:-0}
                if [ "${SCORE%.*}" -ge "$RODEPS_THRESHOLD" ]; then
                  echo "Failed: Outdated dependencies percentage - $SCORE breaches threshold - $RODEPS_THRESHOLD"
                  exit 1
                else
                  echo "OK: Outdated dependencies percentage - $SCORE is within the threshold - $RODEPS_THRESHOLD"
                fi
```

### Using rodeps in NPM postinstall hook

It is possible to run `rodeps` on every install command in the project. In that case after `npm install` or `npm ci` command will print the result of outdated dependencies analysis. This can be enabled by adding this script to the `package.json` file:

```json
"scripts": {
  ...
  "postinstall": "if [ -z $CI ]; then npx -y rodeps; fi"
}
```

Note `if [ -z $CI ];` - checks whether the hook is not executed in a non-continuous integration environment. This is added to reduce the time of install command and eliminate excessive output.

## Outputs

### Default output

The script outputs a summary of the dependency status, for example:

```
Rotten deps results for <project-name>@<version>
Dependencies analyzed: 27.
9 (33.33%) of installed packages are outdated.
5 (18.52%) of installed packages have outdated wanted versions.
4 (14.81%) of installed packages have outdated latest versions.
┌──────────────────────┬───────────┬─────────────────┬──────────────────┬─────────────────┬──────────────────┬──────────┬───────────┐
│       (index)        │ installed │ outdated wanted │ rotten wanted, % │ outdated latest │ rotten latest, % │ outdated │ rotten, % │
├──────────────────────┼───────────┼─────────────────┼──────────────────┼─────────────────┼──────────────────┼──────────┼───────────┤
│         all          │    27     │        5        │      18.52       │        4        │      14.81       │    9     │   33.33   │
│     dependencies     │    18     │        2        │      11.11       │        1        │       5.56       │    3     │   16.67   │
│   devDependencies    │     9     │        3        │      33.33       │        3        │      33.33       │    6     │   66.67   │
│ optionalDependencies │     0     │        0        │        0         │        0        │        0         │    0     │     0     │
│   peerDependencies   │     0     │        0        │        0         │        0        │        0         │    0     │     0     │
└──────────────────────┴───────────┴─────────────────┴──────────────────┴─────────────────┴──────────────────┴──────────┴───────────┘
```

Where:

- `installed` - number of installed dependencies in the dependency tree (all) or specific group (dev, optional, etc).
- `outdated wanted` - number of outdated dependencies compared to the wanted version, specified in package.json file. In case you have specified [which update types your package can accept from dependencies](https://docs.npmjs.com/about-semantic-versioning#using-semantic-versioning-to-specify-update-types-your-package-can-accept): patch (~), minor (^) or major (\*), the current version can be behind the wanted and require an update.
- `rotten wanted` - the percentage of rotten (outdated) packages that have the current version older than wanted.
- `outdated latest` - number of outdated dependencies compared to the latest version.
- `rotten latest` percentage of all rotten (outdated) packages that have the current version older than the latest. This metric is stricter than `rotten wanted` since the `wanted` version may be fixed on the patch or minor level that will never allow updating dependency to the latest.
- `outdated`
- `rotten` - percentage of all rotten (outdated) packages.

If the `--long` option is used, it will also send to the output a detailed list of outdated packages. In that case, the default output will be extended with the following (for example):

```
List of outdated dependencies
┌──────────────────┬──────────┬──────────┬──────────┐
│     (index)      │ current  │  wanted  │  latest  │
├──────────────────┼──────────┼──────────┼──────────┤
│ react-router-dom │ '6.23.1' │ '6.25.1' │ '6.25.1' │
│       sass       │ '1.77.5' │ '1.77.8' │ '1.77.8' │
│    web-vitals    │ '2.1.4'  │ '2.1.4'  │ '4.2.2'  │
└──────────────────┴──────────┴──────────┴──────────┘

List of outdated devDependencies
┌─────────────────────────────┬──────────┬──────────┬──────────┐
│           (index)           │ current  │  wanted  │  latest  │
├─────────────────────────────┼──────────┼──────────┼──────────┤
│   @testing-library/react    │ '13.4.0' │ '13.4.0' │ '16.0.0' │
│ @testing-library/user-event │ '13.5.0' │ '13.5.0' │ '14.5.2' │
└─────────────────────────────┴──────────┴──────────┴──────────┘
```

There can be different tables for each group of dependencies if such a group has outdated packages:

- `dependencies`
- `devDependencies`
- `optionalDependencies`
- `peerDependencies`

### JSON output

If the `--json` option is used, it will output the entire report in JSON format, including lists of outdated packages. This option excludes `--long` and might be useful in CI/CD or automated runs.

Results of `--json` invoked output can be parsed programmatically or stored in the file for further analysis.

Example of JSON output:

```json
{
  "all": {
    "installed": 27,
    "outdatedWanted": 5,
    "outdatedLatest": 4,
    "outdated": 9,
    "rottenDepsPercentage": 33.33,
    "rottenWantedDepsPercentage": 18.52,
    "rottenLatestDepsPercentage": 14.81
 },
  "dependencies": {
    "installed": 18,
    "outdatedWanted": 2,
    "outdatedLatest": 1,
    "outdated": 3,
    "packages": {
      "react-router-dom": {
        "current": "6.23.1",
        "wanted": "6.25.1",
        "latest": "6.25.1"
 },
      ...
 }
 },
  "devDependencies": {
    "installed": 9,
    "outdatedWanted": 3,
    "outdatedLatest": 3,
    "outdated": 6,
    "packages": {
      "@testing-library/react": {
        "current": "13.4.0",
        "wanted": "13.4.0",
        "latest": "16.0.0"
 },
      ...
 },
  "optionalDependencies": {
    "installed": 0,
    "outdatedWanted": 0,
    "outdatedLatest": 0,
    "outdated": 0,
    "packages": {}
 },
  "peerDependencies": {
    "installed": 0,
    "outdatedWanted": 0,
    "outdatedLatest": 0,
    "outdated": 0,
    "packages": {}
 }
}
```

## Limitations

Current design trade-offs and unsupported scenarios to avoid confusion:

- Nested dependency tree depth is ignored. Only top-level direct dependencies in each group are counted when determining the total installed set; transitive dependencies are not included in counts or percentages.
- Private registries / authenticated npm registries are not explicitly supported. If authentication is required and not present, commands may fail silently and produce empty or partial data (handled as zeroes). Explicit error handling for auth failures is not yet implemented.
- `npm` only. Alternative package managers (Yarn, pnpm, Bun, etc.) are not detected or supported; the tool always invokes the npm CLI. Mixed or non-npm lockfiles will yield unreliable results.

These constraints are tracked for future enhancement in the project improvement list / TODO.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
