# Agent Audit Handoff

Date: 2026-03-14

## Current Snapshot

This repo is still mostly a Next.js scaffold on the frontend. The meaningful work so far is concentrated in `src/backend`, `fixtures/intake`, and `scripts/run-intake-fixture.ts`.

There are currently two backend tracks in the tree:

1. A runnable intake pipeline that normalizes upload payloads and extracts text from fixture PDFs.
2. A richer parser/orchestration prototype with document classification, fact extraction, completeness, comparison, routing, and executive decision modules.

These tracks are not wired together into a single end-to-end workflow yet.

## What Has Been Created

### Frontend shell

- `src/app/page.jsx`
  - Minimal placeholder page only.
- `src/app/layout.jsx`, `src/app/globals.css`, `src/index.css`
  - App shell styling and base layout.

### Intake pipeline that runs today

- `src/backend/schemas/intake.ts`
  - Types for upload payloads, intake envelope, normalized documents, and intake results.
- `src/backend/intake/normalize.ts`
  - Validates payload shape.
  - Generates `runId`, package label, inferred category hints, document IDs, warnings, and extraction status defaults.
- `src/backend/intake/extractPdf.ts`
  - Uses `pdfjs-dist` to parse local fixture PDFs into page text and `fullText`.
  - Flags empty or low-text PDFs with warnings.
- `src/backend/intake/runIntakeAgent.ts`
  - Orchestrates normalization + PDF extraction.
  - Returns `accepted`, `accepted_with_warnings`, or `rejected`.
- `scripts/run-intake-fixture.ts`
  - CLI harness for running intake against fixture JSON payloads.

### Fixture coverage

- `fixtures/intake/good-upload.json`
  - Happy path with two valid PDFs.
- `fixtures/intake/one-good-one-bad.json`
  - One valid PDF and one broken PDF.
- `fixtures/intake/empty-text-pdf.json`
  - PDF parses but yields no searchable text.
- `fixtures/intake/missing-project-name.json`
  - Validation failure.
- `fixtures/intake/mixed-documents-with-warnings.json`
  - Duplicate filename plus skipped non-PDF file.
- `fixtures/intake/files/*`
  - Supporting PDFs and images used by the fixtures.

### Rich parser prototype

- `src/backend/classifiers/documentClassifier.ts`
  - Heuristic document type classification from filename/text.
- `src/backend/extractors/pdfTextExtractor.ts`
  - PDF extraction with text coverage and OCR-needed warnings.
- `src/backend/normalizers/submittalFieldExtractor.ts`
  - Regex-based extraction of spec section, product type, manufacturer, model number, revision, attributes, deviations, and expected docs.
- `src/backend/mergers/composeParsedSubmittal.ts`
  - Merges extracted evidence into a confidence-scored `DetailedParsedSubmittal`.
- `src/backend/agents/parser.ts`
  - Runs extraction, classification, normalization, and composition for incoming docs.

### Decision agent prototypes

- `src/backend/agents/requirements.ts`
  - Builds a rich requirement set from parsed submittal data plus mock project context.
- `src/backend/agents/completeness.ts`
  - Evaluates required document presence.
- `src/backend/agents/comparison.ts`
  - Compares parsed facts against required values.
- `src/backend/agents/routing.ts`
  - Produces routing destination and action list.
- `src/backend/agents/executive.ts`
  - Produces final executive decision and workflow status update.
- `src/backend/schemas/workflow.ts`
  - Shared workflow and parser-oriented types.

### Planning doc

- `docs/SPRINT_AGENT_ORCHESTRATION.md`
  - Sprint intent and target architecture.

## What Was Verified

### Commands that worked

- `npm run lint`
  - Passed.
- `npm run intake:fixture fixtures/intake/good-upload.json -- --summary`
  - Passed. Returned `accepted`.
- `npm run intake:fixture fixtures/intake/one-good-one-bad.json -- --summary`
  - Passed. Returned `accepted_with_warnings`.
- `npm run intake:fixture fixtures/intake/empty-text-pdf.json -- --summary`
  - Passed. Returned `accepted_with_warnings`.
- `npm run intake:fixture fixtures/intake/mixed-documents-with-warnings.json -- --summary`
  - Passed. Returned `accepted_with_warnings`.
- `npm run intake:fixture fixtures/intake/missing-project-name.json -- --summary`
  - Correctly rejected input.

### Observed runtime caveats

- PDF extraction emits `pdfjs-dist` font warnings about `LiberationSans-Regular.ttf`.
- Those warnings did not block fixture execution.

## What Is Missing Before Real Testing

### 1. No end-to-end orchestrator exists yet

The repo has individual agent modules, but nothing currently:

- initializes a `WorkflowState`
- maps intake output into parser input
- maps parser output into requirement/completeness/comparison input
- runs the full sequence
- emits a final workflow result

Without that layer, we can only test the intake script directly.

### 2. The backend contracts currently diverge

There are incompatible shapes across modules:

- `src/backend/agents/requirements.ts`
  - returns a rich `RequirementSet` with nested `specSection`, structured `requiredAttributes`, and object `routingPolicy`
- `src/backend/agents/completeness.ts`
  - expects `RequirementSet` from `src/backend/schemas/workflow.ts`, where `requiredAttributes` is `string[]` and `routingPolicy` is `string`
- `src/backend/agents/executive.ts`
  - reads `requirementSet.specSection` as a string
- `src/backend/agents/parser.ts`
  - returns `DetailedParsedSubmittal`
- `src/backend/agents/completeness.ts` and `src/backend/agents/comparison.ts`
  - expect a simpler `ParsedSubmittal`

This means the rich parser and rich requirements agent cannot currently plug into the other decision agents without an adapter or schema consolidation.

### 3. TypeScript is not green

Current `npx tsc --noEmit` blockers:

- `src/backend/agents/comparison.ts`
  - type narrowing bug in `normalizeValue`
- `src/backend/normalizers/submittalFieldExtractor.ts`
  - uses named regex capture groups while `tsconfig.json` is still targeting `ES2017`

Until these are fixed, `next build` fails during TypeScript validation.

### 4. Build is not clean yet

`npm run build` compiled app code, then failed on TypeScript validation. It also auto-added TypeScript support changes when run:

- added `@types/node`
- updated `next-env.d.ts`
- rewrote `tsconfig.json` `jsx`
- added `.next/dev/types/**/*.ts` to `include`

These changes are now in the working tree.

### 5. No tests exist yet

There are no unit or integration tests for:

- intake normalization
- PDF extraction edge cases
- parser classification/extraction
- requirement reconstruction
- completeness/comparison/routing/executive branches
- end-to-end workflow orchestration

## Recommended Next Steps

1. Decide which contract is canonical.
   - Either keep the simple `workflow.ts` shapes and downgrade the rich agents to match.
   - Or promote the rich parser/requirements shapes and adapt completeness/comparison/routing/executive to them.

2. Add an orchestrator module.
   - One function that runs intake -> parse -> requirements -> completeness -> comparison -> routing -> executive.
   - Return a serializable final workflow object with logs.

3. Make TypeScript pass.
   - Fix `comparison.ts` narrowing.
   - Raise `tsconfig.json` target/lib to at least `ES2018`, likely `ES2019` or newer.

4. Add backend tests before UI integration.
   - Start with fixture-backed integration tests for intake.
   - Then add unit tests for each agent branch.
   - Finally add one end-to-end happy path and one exception path.

5. Decide whether the intake path or parser path is the current source of truth.
   - Right now both exist, and the overlap will confuse the next agent unless one path is declared primary.

## Suggested Starting Point For The Next Agent

If the goal is "ready to start testing," the most leverage comes from:

1. consolidating the workflow schema
2. creating the orchestrator
3. getting `npx tsc --noEmit` green
4. converting the existing fixtures into automated integration tests

After those four steps, the backend will be in a stable enough shape to test intentionally instead of probing disconnected modules.
