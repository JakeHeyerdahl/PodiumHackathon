# Sprint Plan: Agent Orchestration

## Scope

This sprint is **backend and orchestration only**.

We are explicitly **not** doing any of the following in this sprint:

- frontend work
- frontend/backend integration
- real project data integrations
- auth, security hardening, or permissions
- production infrastructure

The goal is to build a believable **autonomous submittal workflow engine** for demo use.

## Product Goal

Build an executive-led agent system that can autonomously process a construction submittal through a bounded workflow:

1. ingest a submittal event
2. parse documents into structured facts
3. reconstruct project requirements
4. evaluate completeness
5. compare submission vs requirements
6. decide routing
7. make an executive-level workflow decision
8. emit a final structured state and action plan

## Demo Goal

Given a mock submittal payload, the backend should return a structured workflow result that looks like a real autonomous decision engine:

- parsed submittal facts
- requirement set
- completeness result
- technical comparison result
- routing decision
- executive decision
- workflow log

## Non-Goals

Do not spend sprint time on:

- UI polish
- PDF OCR perfection
- Procore or email integration
- persistent databases unless needed for state stubbing
- notification delivery
- authentication
- safety/compliance hardening

## System Shape

Use a simple backend architecture:

- `orchestrator`
  - drives the workflow
  - invokes agents in order
  - owns workflow state
- `agents`
  - pure backend modules with narrow responsibilities
- `provider layer`
  - abstracts model calls
- `schemas`
  - typed contracts for every agent input/output
- `demo API`
  - one or two endpoints to run the orchestration

## Core Design Principles

1. Each agent should do one narrow job.
2. Agents communicate through shared typed state, not freeform agent-to-agent chat.
3. The executive agent is the only agent allowed to make the final workflow call.
4. All outputs should be structured and serializable.
5. Every agent should write a short trace/log entry into the workflow state.
6. Everything should be mockable for demo reliability.

## Shared State Contract

Create a single workflow state object that all agents read/write.

Suggested top-level fields:

```ts
type WorkflowState = {
  runId: string;
  projectName: string;
  submittalTitle: string;
  currentStatus: string;
  incomingDocuments: string[];
  parsedSubmittal?: ParsedSubmittal;
  requirementSet?: RequirementSet;
  completenessResult?: CompletenessResult;
  comparisonResult?: ComparisonResult;
  routingDecision?: RoutingDecision;
  executiveDecision?: ExecutiveDecision;
  logs: WorkflowLogEntry[];
};
```

## Agent List

### 1. Intake Agent

Purpose:
- validate incoming documents and extract raw PDF text for downstream agents

Inputs:
- project name
- raw incoming documents

Outputs:
- accepted or rejected intake result
- extracted document text for each usable PDF
- intake log entry

Rules:
- no business judgment
- no field extraction, title inference, or document categorization
- no model required unless we later support fuzzy package grouping

Definition of done:
- returns stable document IDs and extracted PDF text for downstream parsing

### 2. Parsing Agent

Purpose:
- convert raw submittal docs into structured attributes

Inputs:
- `incomingDocuments`

Outputs:
- `parsedSubmittal`

Expected extracted fields:
- spec section
- product type
- manufacturer
- model number
- revision/version
- extracted attributes
- missing documents
- deviations

Definition of done:
- returns deterministic structured output for a mock submittal payload

### 3. Requirement Reconstruction Agent

Purpose:
- build a normalized requirement set to compare against

Inputs:
- project name
- submittal title
- parsed submittal
- mock project requirement context

Outputs:
- `requirementSet`

Expected requirement fields:
- spec section
- required attributes
- required documents
- routing policy

Definition of done:
- returns a comparison-ready requirement object with no frontend dependency

### 4. Completeness Agent

Purpose:
- decide whether the package is reviewable

Inputs:
- parsed submittal
- requirement set

Outputs:
- `completenessResult`

Possible statuses:
- `complete`
- `incomplete`
- `needs_human_review`

Definition of done:
- missing documents are clearly listed
- rationale is concise and structured

### 5. Technical Comparison Agent

Purpose:
- compare submitted attributes against requirements

Inputs:
- parsed submittal
- requirement set

Outputs:
- `comparisonResult`

Possible statuses:
- `compliant`
- `deviation_detected`
- `unclear`

Definition of done:
- reports matches, mismatches, and unclear items separately

### 6. Routing Agent

Purpose:
- determine the next workflow destination before executive review

Inputs:
- completeness result
- comparison result
- routing policy

Outputs:
- `routingDecision`

Possible destinations:
- `auto_route_internal_review`
- `return_to_subcontractor`
- `human_exception_queue`

Definition of done:
- always returns a destination and action list

### 7. Executive Agent

Purpose:
- make the final workflow decision like an accountable operations lead

Inputs:
- full workflow state

Outputs:
- `executiveDecision`

Possible decisions:
- `continue`
- `return_to_subcontractor`
- `escalate_to_human`
- `approve_internal_progression`

Executive behavior:
- decisive
- concise
- operates like an employee making a real call
- no hedging unless evidence is insufficient

Definition of done:
- produces a short summary, reasoning bullets, and next actions
- updates the final workflow status

## Shared Schemas To Implement First

These should be finished before any agent logic expands:

- `ParsedSubmittal`
- `RequirementSet`
- `CompletenessResult`
- `ComparisonResult`
- `RoutingDecision`
- `ExecutiveDecision`
- `WorkflowLogEntry`
- `WorkflowState`

## Suggested Backend File Layout

This is only a suggestion, but all windows should follow the same shape:

```text
src/
  backend/
    agents/
      intake.ts
      parser.ts
      requirements.ts
      completeness.ts
      comparison.ts
      routing.ts
      executive.ts
    orchestrator/
      runSubmittalWorkflow.ts
    providers/
      llmProvider.ts
      mockProvider.ts
      anthropicProvider.ts
    schemas/
      workflow.ts
    demo/
      mockSubmittals.ts
```

## Parallel Workstreams

These are separated so other context windows can work independently.

### Window A: Shared Contracts

Owns:
- workflow schemas
- enums/status values
- mock input/output fixtures

Must not touch:
- orchestrator logic
- API routes

Deliverables:
- typed schema file
- one complete mock workflow payload

### Window B: Core Specialist Agents

Owns:
- parser agent
- requirement reconstruction agent
- completeness agent
- technical comparison agent

Must not touch:
- executive logic
- routing policy constants outside agreed schema

Deliverables:
- pure functions with typed inputs/outputs
- deterministic mock behavior

### Window C: Decision Layer

Owns:
- routing agent
- executive agent

Must not touch:
- frontend
- API handlers

Deliverables:
- final decision contracts
- deterministic routing and executive decisions

### Window D: Orchestrator + Demo API

Owns:
- orchestrator runner
- provider abstraction
- demo route(s)
- workflow logging glue

Must not touch:
- frontend
- visual components

Deliverables:
- end-to-end runnable backend flow
- one route that returns the full workflow state

## Implementation Order

1. Define all schemas and status enums.
2. Add mock fixtures for one good submittal and one bad submittal.
3. Implement pure agent functions with mock logic first.
4. Implement orchestrator sequencing.
5. Add executive decision pass at the end.
6. Add provider abstraction for future real model calls.
7. Add a demo endpoint.

## Minimal Sprint Deliverable

By end of sprint, we should have:

- a backend-only orchestration module
- a clear executive agent
- typed state and decision contracts
- one successful autonomous demo path
- one failure/return path

## Acceptance Criteria

The sprint is complete when:

1. A demo payload can be submitted to the backend.
2. The orchestrator runs all agents in order.
3. The workflow returns a full structured result.
4. The executive agent makes a final decision.
5. No frontend files are changed as part of orchestration work after this planning step.

## Notes For All Windows

- Keep logic deterministic where possible.
- Prefer pure functions over stateful classes unless there is a strong reason.
- Avoid framework-heavy abstractions at this stage.
- Use mock providers first so the demo always works.
- Leave hooks for real LLM/provider integration, but do not block on it.
