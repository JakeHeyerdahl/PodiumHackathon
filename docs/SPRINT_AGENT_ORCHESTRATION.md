# Sprint Plan: Agent Orchestration

## Scope

This sprint is focused on backend workflow orchestration for a construction submittal review prototype.

Still out of scope:

- polished frontend product work
- production integrations
- auth and permissions
- persistent infra and operational hardening

## Product Goal

Build a believable autonomous workflow engine that can process a construction submittal through these bounded steps:

1. ingest a submittal event
2. parse documents into structured facts
3. reconstruct project requirements
4. evaluate completeness
5. compare submission vs requirements
6. decide routing
7. make an executive workflow decision
8. emit structured workflow state plus actionable output

## Current Implementation Status

The target architecture now exists in code.

Implemented pieces:

- workflow orchestrator in `src/backend/orchestrator/runWorkflow.ts`
- workflow-step agents in `src/backend/agents/`
- shared contracts in `src/backend/schemas/`
- Anthropic and mock provider abstractions in `src/backend/providers/`
- retained real-PDF debugging fixtures in `test-pdfs/`
- backend tests for parser, comparison, requirements, providers, routing flows, and workflow orchestration

Still intentionally light:

- the frontend remains mostly a shell
- workflow execution is fixture-driven rather than integrated with real systems
- the final state is structured for demos and tests, not yet for production persistence or APIs

## System Shape

The current backend shape is:

- `orchestrator`
  - drives the workflow in order
  - owns state transitions and adapters
- `agents`
  - implement each workflow step
- `feature folders`
  - hold parsing, intake, and completeness internals
- `provider layer`
  - abstracts LLM access
- `schemas`
  - define typed state and outputs
- `scripts` and `tests`
  - provide local harnesses and regression coverage

## Shared State

`WorkflowState` remains the serializable cross-step summary used by the orchestrator and executive review.

Key fields:

- `runId`
- `projectName`
- `submittalTitle`
- `currentStatus`
- `incomingDocuments`
- `parsedSubmittal`
- `requirementSet`
- `completenessResult`
- `comparisonResult`
- `routingDecision`
- `executiveDecision`
- `logs`

Some agents produce richer internal types than the workflow state stores. The orchestrator is the place where those richer outputs are adapted into workflow-facing summaries.

## Core Design Principles

1. Each agent owns one narrow workflow responsibility.
2. Shared state is typed and serializable.
3. The executive agent is the final workflow decision-maker.
4. Deterministic fixtures remain available for demo reliability and regression tests.
5. LLM-backed steps should return structured outputs, not freeform prose.
6. Logs should make workflow decisions explainable after the fact.

## Current Workflow Order

1. Intake
2. Parser
3. Requirements
4. Completeness
5. Comparison
6. Routing
7. Executive

This order is exercised by `npm run workflow:run` and `npm run workflow:test`.

## Near-Term Priorities

1. Keep schema adapters intentional as parser and requirements outputs evolve.
2. Expand tests around the LLM-backed completeness, comparison, and routing paths.
3. Add a cleaner external interface for running the orchestrator outside local scripts.
4. Decide how much of the rich intermediate data should be exposed to future UI or API consumers.
