# Agent Audit Handoff

Date: 2026-03-14

## Current Snapshot

This repo is no longer just a scaffold plus disconnected backend experiments. It now contains a working fixture-driven backend workflow with an orchestrator, agent modules, parser fixtures, and automated tests.

The frontend is still lightweight, but the backend path from intake through executive decision is wired in code.

## What Exists Today

### Frontend shell

- `src/app/page.jsx`
  - minimal placeholder interface
- `src/app/layout.jsx`, `src/app/globals.css`, `src/index.css`
  - app shell and base styling

### Intake workflow

- `src/backend/agents/intake.ts`
  - orchestrates payload normalization and PDF extraction
- `src/backend/intake/normalize.ts`
  - validates payload shape and creates normalized document metadata
- `src/backend/intake/extractPdf.ts`
  - extracts text and warnings from local PDFs
- `fixtures/intake/*.json`
  - fixture payloads for local intake and workflow runs
- `scripts/run-intake-fixture.ts`
  - CLI harness for intake-only runs

### Parser workflow

- `src/backend/agents/parser.ts`
  - supports deterministic and LLM-backed parsing modes
- `src/backend/parsing/classifyDocument.ts`
  - heuristic document typing
- `src/backend/parsing/extractPdfText.ts`
  - parser-side PDF extraction and issue tagging
- `src/backend/parsing/extractDocumentFacts.ts`
  - deterministic field and attribute extraction
- `src/backend/parsing/composeParsedSubmittal.ts`
  - merges extracted evidence into normalized parser output
- `src/backend/parsing/runLlmParser.ts`
  - LLM-backed parser execution
- `src/backend/parsing/reviewWithLlm.ts`
  - parser review and structured-output helpers
- `src/backend/demo/mockSubmittals.ts`
  - deterministic fixture access for parser tests

### Decision agents

- `src/backend/agents/requirements.ts`
  - reconstructs normalized requirement data
- `src/backend/agents/completeness.ts`
  - runs completeness review
- `src/backend/agents/comparison.ts`
  - runs deterministic and LLM-backed comparison logic
- `src/backend/agents/routing.ts`
  - resolves routing policy and next destination
- `src/backend/agents/executive.ts`
  - makes the final workflow call and updates workflow status

### Orchestration

- `src/backend/orchestrator/runWorkflow.ts`
  - runs intake -> parser -> requirements -> completeness -> comparison -> routing -> executive
  - returns both workflow-facing state and richer intermediate artifacts
- `scripts/run-workflow.ts`
  - local CLI entrypoint for full workflow runs

### Shared contracts and providers

- `src/backend/schemas/intake.ts`
  - intake payloads and normalized envelope types
- `src/backend/schemas/workflow.ts`
  - workflow state plus parser/completeness/comparison/routing/executive types
- `src/backend/providers/*.ts`
  - Anthropic and mock provider abstractions

### Tests and fixtures

- `test/parser.test.ts`
  - deterministic parser and snapshot coverage
- `test/workflow-orchestrator.test.ts`
  - end-to-end workflow happy path and deviation path
- `test/comparison.test.ts`
- `test/requirements.test.ts`
- `test/routing.test.ts`
- `test/provider.test.ts`
- `test/agent-pipeline.test.ts`
- `scripts/generate-parser-fixtures.ts`
  - generates synthetic parser PDFs
- `scripts/fixtures/expected/*.json`
  - parser snapshot expectations

## What Was Verified In This Audit

The docs and file layout were reviewed against the current tree on 2026-03-14.

Notable corrections from older handoff notes:

- the orchestrator now exists
- parser internals live under `src/backend/parsing/`, not old `classifiers/`, `extractors/`, `normalizers/`, or `mergers/` paths
- automated backend tests now exist
- the backend is wired far enough for end-to-end fixture-driven workflow tests

## Important Current Constraints

### 1. There are richer internal types than the shared workflow summary

The orchestrator currently adapts:

- rich parser output into `WorkflowState.parsedSubmittal`
- reconstructed requirement output into `WorkflowState.requirementSet`
- comparison output into workflow summary items

That adapter layer is intentional, but it means schema changes in rich agent outputs should be made carefully.

### 2. LLM-backed paths depend on Anthropic configuration

The LLM parser, completeness, comparison, and routing flows rely on:

- `ANTHROPIC_API_KEY`

Optional model env vars:

- `ANTHROPIC_MODEL`
- `ANTHROPIC_PARSER_MODEL`
- `ANTHROPIC_COMPLETENESS_MODEL`
- `ANTHROPIC_COMPARISON_MODEL`
- `ANTHROPIC_ROUTING_MODEL`

### 3. The frontend is not the center of gravity yet

The application shell exists, but most meaningful functionality is still exercised through backend scripts and tests rather than through a user-facing UI.

## Recommended Next Steps

1. Keep backend docs aligned with the orchestrator and agent APIs as schemas evolve.
2. Expand tests around non-happy-path completeness, comparison, and routing scenarios.
3. Decide whether the future public surface should be a Next.js route, a job runner, or both.
4. If UI work starts, expose workflow results through a stable backend interface instead of letting the frontend import backend internals directly.
