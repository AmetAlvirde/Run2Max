# run2max

Structured run analysis from `.fit` files. Takes a Stryd `.fit` file and
produces a clean markdown (or JSON/YAML) analysis.

```bash
run2max quantify my-run.fit
```

## Packages

| Package                              | Description                          |
| ------------------------------------ | ------------------------------------ |
| [`@run2max/cli`](packages/cli)       | User-facing CLI — `run2max quantify` |
| [`@run2max/engine`](packages/engine) | Core analysis library                |

## Quick start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Analyze a run
run2max quantify my-run.fit
```

See [`packages/cli/README.md`](packages/cli/README.md) for the full CLI
reference including flags, config, output format, and plan commands (`create`,
`status`, `sync`, `adjust`, `validate`).

## Monorepo structure

```
packages/
  engine/       @run2max/engine — core analysis library
  cli/          @run2max/cli    — user-facing CLI (run2max quantify)
fixture-fits/                   — gitignored; drop .fit files here for smoke tests
```

## Development

```bash
# Install
pnpm install

# Build all packages
pnpm build

# Run all tests (unit tests only)
pnpm test

# Run tests including smoke tests against a real .fit file
FIT_FIXTURE=./fixture-fits/your-run.fit pnpm test

# Build and watch
pnpm dev
```

**Requirements:** Node 22 LTS or later, pnpm.
