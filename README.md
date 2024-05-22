# Rotten Deps

This Node.js script analyzes the dependencies listed in a `package.json` file and reports how outdated they are. It is designed to help maintainers keep their dependencies up-to-date by providing clear, actionable insights into their dependency landscape.

## Purpose

The primary purpose of this script is to shift left in the software development lifecycle. By incorporating dependency checks early in the CI/CD pipeline, on operation dashboards, or in day-to-day code checks, teams can proactively manage their dependencies, reducing the risk of security vulnerabilities and ensuring compatibility with the latest features and bug fixes.

## Features

- **Zero dependencies**: This script is implemented with no external dependencies, relying solely on Node.js built-in modules, ensuring lightweight and fast execution.
- **Detailed reporting**: Provides a summary of all dependencies, including the percentage of outdated packages.
- **Verbose and detailed output options**: Configure the script to output detailed lists of outdated packages if needed.
- **CI/CD integration**: Easily integrate this script into your CI/CD pipelines to automatically check for outdated dependencies with every build.

## Usage

### Installation

Install if from github:

```sh
npm i --save-dev https://github.com/vasser/rotten-deps.git
```

Or run without installation using `npx`:

```sh
npx https://github.com/vasser/rotten-deps.git
```

### Options

- `--verbose`: Enable verbose output for debugging purposes.
- `--long`: Output a detailed list of outdated packages.

Example:

```sh
npx rotten-deps --verbose --long
```

## Integration with CI/CD

To integrate this script into your CI/CD pipeline, add the following step to your pipeline configuration:

For example, in a GitHub Actions workflow:

```yaml
name: CI

on: [push, pull_request]

jobs:
  check-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "14"
      - name: Run Rotten Deps
        run: rotten-deps
```

## Outputs

The script outputs a summary of the dependency status:

```
Rotten deps results for <project_name>@<version>
<percentage>% of installed packages (<total_installed>) are outdated (<total_outdated>)

<dependency_type>:
    installed: <number>
    outdated: <number>
```

If the `--long` option is used, it will also output a detailed list of outdated packages.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
