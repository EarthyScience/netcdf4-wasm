# Contributors Guide

Thank you for your interest in contributing to `netcdf4-wasm`! We welcome everyone, whether you're new to open source, WebAssembly, TypeScript, or scientific computing, or an experienced developer. Every contribution, big or small, helps make this project better.

If you have questions, ideas, or just want to chat, please reach out to us anytime. We're happy to help and discuss anything related to `netcdf4-wasm`, NetCDF, or science in general.

## How You Can Contribute

* **Report bugs or suggest features:** [Open a GitHub issue](https://github.com/EarthyScience/netcdf4-wasm/issues/new/) to let us know about problems or ideas.
* **Start or join a discussion:** [Create a GitHub discussion](https://github.com/EarthyScience/netcdf4-wasm/discussions/new/choose) to ask questions, share experiences, or brainstorm.
* **Improve documentation:** Help us make our docs clearer and more helpful for everyone.
* **Write code:** Fix bugs, add features, or improve performance.
* **Add examples:** Create usage examples or tutorials showing how to use `netcdf4-wasm` in different scenarios.

### Tips for Creating Issues

The most helpful bug reports:

* Include a clear code snippet (not just a link) that shows the problem in the latest version of `netcdf4-wasm`. A ["minimal working example"](https://en.wikipedia.org/wiki/Minimal_working_example) is ideal.
* Paste the full error message you received, even if it's long.
* Use triple backticks (```` ``` ````) for code, and [markdown formatting](https://docs.github.com/en/github/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) to keep things readable.
* Share your `netcdf4-wasm` version, Node.js/browser version, and details about your environment (OS, browser, etc.).

Discussions are great for questions about usage, implementation, WebAssembly compilation, NetCDF formats, or anything else.

## Development Setup

To start developing `netcdf4-wasm`:

1. [Fork the `netcdf4-wasm` repository](https://docs.github.com/en/github/collaborating-with-pull-requests/working-with-forks) and clone your fork
2. Navigate to the project directory
3. Install dependencies:
```bash
   npm install
```
4. Check that you have all build dependencies:
```bash
   npm run check-deps
```
5. If you need Emscripten for building WASM:
```bash
   npm run install-emscripten
```
6. Build the project:
```bash
   npm run build
```
7. Run tests to ensure everything works:
```bash
   npm test
```

and to build and synchronize with the **demo** do

```bash
   npm run build-and-sync
```

### Project Structure

Understanding the project structure will help you navigate the codebase:
```
netcdf4-wasm/
├── src/                   # TypeScript source code
│   ├── __tests__/         # Test files
│   ├── constants.ts       # NetCDF constants
│   ├── dimension.ts       # Dimension class
│   ├── group.ts           # Group class
│   ├── index.ts           # Main API exports
│   ├── netcdf-getters.ts  # Data getter utilities
│   ├── netcdf-worker.ts   # Web Worker implementation
│   ├── netcdf4-wasm.d.ts  # TypeScript declarations
│   ├── netcdf4.ts         # Main NetCDF4 class
│   ├── test-setup.ts      # Test configuration
│   ├── types.ts           # Type definitions
│   ├── variable.ts        # Variable class
│   └── wasm-module.ts     # WASM module loader
├── scripts/               # Build scripts
│   ├── build-wasm.sh      # Main WASM build script
│   ├── check-dependencies.sh
│   └── install-emscripten.sh
├── bindings/              # WASM bindings
│   ├── pre.js             # Pre-run JavaScript
│   └── post.js            # Post-run JavaScript
├── build/                 # Build artifacts (generated)
├── dist/                  # Distribution files (generated)
└── package.json
```

## Making Your Contribution

1. [Fork the repository](https://docs.github.com/en/github/collaborating-with-pull-requests/working-with-forks), make your changes, and [open a pull request](https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork). We'll review and help you get it merged.
2. For small fixes (like typos), you can use the [GitHub editor](https://docs.github.com/en/github/managing-files-in-a-repository/managing-files-on-github/editing-files-in-your-repository) for a quick edit and pull request.
3. Please try to follow our code style and formatting conventions.
4. Always test your changes before submitting:
```bash
   # Run all tests
   npm test
   
   # Run tests with coverage
   npm run test:coverage
   
   # Run tests in watch mode while developing
   npm run test:watch
```

## Good First Steps

* Try out `netcdf4-wasm` using the examples in our documentation. If you hit any problems or have questions, please open an issue!
* Write an example or tutorial showing how to use `netcdf4-wasm` for reading/writing NetCDF files in the browser or Node.js.
* Suggest improvements to documentation or code comments.
* Work on issues labeled `good first issue` or `help wanted`.
* Improve TypeScript type definitions for better developer experience.
* Add or improve test coverage.

If you want to work on something, let us know by commenting on an issue or opening a new one. This helps us coordinate and support you.

## Useful Commands

Here are the main commands you'll use during development:
```bash
# Install dependencies
npm install

# Build the entire project (WASM + TypeScript)
npm run build

# Build and synchronize the demo
npm run build-and-sync

# Build only the WASM module
npm run build:wasm

# Build only TypeScript
npm run build:ts

# Clean build artifacts
npm run clean

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful, kind, and constructive in all interactions. We do not tolerate harassment or discriminatory behavior of any kind.

## Getting Help

* **Questions about usage?** Open a [GitHub discussion](https://github.com/EarthyScience/netcdf4-wasm/discussions)
* **Found a bug?** Open an [issue](https://github.com/EarthyScience/netcdf4-wasm/issues)
* **Want to chat?** Reach out to the maintainers

We're excited to have you join our community. Thank you for helping make `netcdf4-wasm` better!