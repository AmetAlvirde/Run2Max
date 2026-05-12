# Prescribed Runs store expanded steps on the parsed Plan

_Made during: 02-run-prescriptions-and-comparisons / parent issue #53 /
sub-issue #54_ _Scope: product_ _Status: accepted_

When parsing a Plan, `parsePlan` eagerly parses Prescription Notation inside
Week-level `prescribed_runs` and stores the expanded, ordered `PrescribedStep[]`
on each `PrescribedRun`. This keeps downstream association/comparison code
working with stable domain data (steps + targets) instead of re-parsing notation
at each call site.

## Considered Options

- Store only authored metadata on the Plan and require downstream consumers to
  call the notation parser lazily.
- Store a richer parser AST on the Plan in addition to the expanded steps.

## Consequences

- Plan parsing fails fast when a `prescribed_runs` entry contains invalid
  notation.
- Downstream parents do not need to repeat parser invocation or error handling.
- Prescription grammar internals remain out of the public Plan shape (only
  domain steps/targets are stored).
