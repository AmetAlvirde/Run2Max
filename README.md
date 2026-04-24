# run2max

CLI tool that takes a Stryd `.fit` file and produces a structured markdown analysis of a run.

```bash
run2max quantify run.fit
```

## Monorepo structure

```
packages/
  engine/   @run2max/engine — core analysis library
  cli/      @run2max/cli    — user-facing CLI (run2max quantify)
fixture-fits/               — gitignored; drop .fit files here for smoke tests
```

## Development

```bash
pnpm install
pnpm --filter @run2max/engine build
pnpm --filter @run2max/engine exec vitest run
```

Smoke tests against a real `.fit` file:

```bash
FIT_FIXTURE=./fixture-fits/your-run.fit pnpm --filter @run2max/engine exec vitest run
```
