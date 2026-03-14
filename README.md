# PodiumHackathon

Construction submittal workflow prototype built with Next.js and a backend agent pipeline.

The frontend is currently minimal. Most of the active work lives in `src/backend`, `scripts/`, `fixtures/`, and `test/`.

## What This Repo Does

The backend models a bounded submittal-review workflow:

1. intake normalizes an uploaded package
2. parser extracts structured facts from PDFs
3. requirements reconstruct expected spec and document requirements
4. completeness decides whether the package is reviewable
5. comparison evaluates compliance vs requirements
6. routing picks the next destination
7. executive makes the final workflow call

The main orchestrator lives at `src/backend/orchestrator/runWorkflow.ts`.

## Project Layout

```text
src/
  app/                        Next.js app shell
  backend/
    agents/                   workflow steps
    orchestrator/             end-to-end workflow runner
    parsing/                  parser internals
    completeness/             completeness review helpers
    intake/                   intake normalization and PDF extraction
    providers/                Anthropic and mock provider abstractions
    schemas/                  shared workflow and intake types
    demo/                     deterministic parser fixture access
scripts/
  run-*.ts                    local CLI entrypoints
test-pdfs/                    retained submittal, requirement, and intake payload files
test/                         node:test coverage for agents and orchestrator
docs/                         current project notes
```

## Common Commands

- `npm run dev` starts the Next.js app.
- `npm run lint` runs ESLint.
- `npm run agents:test` runs the full backend test suite.
- `npm run workflow:test` runs the workflow orchestrator tests.
- `npm run parser:test` runs deterministic parser checks against the retained real PDFs.
- `npm run workflow:run -- test-pdfs/intake-perfect.json` runs the full workflow on a retained real-PDF intake case.
- `npm run parser:run -- --files test-pdfs/perfect.pdf --deterministic` runs the deterministic parser on one retained PDF.
- `npm run parser:run:llm -- --files test-pdfs/perfect.pdf` runs the LLM parser on one retained PDF.
- `npm run pdf:eval -- --submittal test-pdfs/perfect.pdf --requirements test-pdfs/requirement-1.pdf` runs the real PDF comparison path.
- `npm run completeness:run` runs the completeness review script.
- `npm run comparison:run` runs the comparison script.

## Environment

Some scripts load `.env.local` automatically through `scripts/load-local-env.ts`.

LLM-backed commands expect:

- `ANTHROPIC_API_KEY`

Optional model overrides:

- `ANTHROPIC_MODEL`
- `ANTHROPIC_PARSER_MODEL`
- `ANTHROPIC_COMPLETENESS_MODEL`
- `ANTHROPIC_COMPARISON_MODEL`
- `ANTHROPIC_ROUTING_MODEL`

If you only want deterministic parser coverage, you do not need an API key.

## Current State

- The backend orchestrator is implemented and tested.
- Parser fixtures and snapshots are in place for deterministic coverage.
- Completeness, comparison, and routing support LLM-backed review flows.
- The frontend is still a lightweight shell rather than a full product UI.

## Related Docs

- `docs/PARSER_TESTING.md`
- `docs/SPRINT_AGENT_ORCHESTRATION.md`
- `docs/AGENT_AUDIT_HANDOFF.md`
- `src/backend/README.md`
