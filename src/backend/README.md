# Backend Organization Guide

This document is the source of truth for how backend code should be organized in this repository.

The goal is simple: a senior engineer should be able to open `src/backend`, understand the workflow quickly, and know exactly where new code belongs without tracing a maze of utility folders.

## Mental Model

The backend is organized around the submittal workflow, not around low-level implementation patterns.

Read the code in this order:

1. `schemas/`
2. `agents/`
3. feature internals such as `intake/` and `parsing/`
4. `demo/`

That order mirrors how the system should be understood:

1. shared contracts define the shape of the state
2. agents are the public workflow steps
3. feature folders contain the implementation details behind those steps
4. demo fixtures support deterministic testing and sprint demos

## Directory Layout

```text
src/backend/
  README.md                <- this guide
  agents/                  <- public workflow steps; start here
    intake.ts
    parser.ts
    requirements.ts
    completeness.ts
    comparison.ts
    routing.ts
    executive.ts
  intake/                  <- intake-only helpers used by the intake agent
    normalize.ts
    extractPdf.ts
  parsing/                 <- parser-only helpers used by the parser agent
    classifyDocument.ts
    extractPdfText.ts
    extractDocumentFacts.ts
    composeParsedSubmittal.ts
  schemas/                 <- shared typed contracts
    intake.ts
    workflow.ts
  demo/                    <- deterministic backend fixtures and demo helpers
    mockSubmittals.ts
```

## Ownership Rules

### `agents/`

This folder is the backend's public workflow surface.

Each file here should represent one step in the orchestration pipeline. If another engineer wants to understand the system, this is where they should spend their first 10 minutes.

Rules:

- Keep one workflow step per file.
- Export the main entry function for that step.
- Keep orchestration-facing logic here.
- Push low-level parsing, extraction, or normalization details into a feature folder.

If a future orchestrator is added, it should call into `agents/*`, not directly into `intake/*` or `parsing/*`.

### `intake/`

This folder contains implementation details for intake only.

Current responsibilities:

- payload validation
- fixture-backed document preparation
- raw PDF extraction that returns document `fullText`

Rules:

- Do not put cross-workflow business decisions here.
- Do not let other workflow stages import deeply from this folder unless they are truly reusing intake behavior.
- If a helper only exists to support `agents/intake.ts`, it belongs here.

### `parsing/`

This folder contains implementation details for parser-only work.

Current responsibilities:

- PDF text extraction for parser review
- document classification
- field and attribute extraction
- normalized parsed submittal composition

Rules:

- Keep parser helper logic here instead of scattering top-level folders like `classifiers/`, `extractors/`, `normalizers/`, or `mergers/`.
- Add new parser internals here unless they are genuinely shared across multiple backend domains.
- Treat `agents/parser.ts` as the only parser entrypoint other backend layers should rely on.

### `schemas/`

This folder owns the backend contracts.

Current split:

- `intake.ts` defines intake payloads and envelope types
- `workflow.ts` defines parser and workflow state contracts

Rules:

- Shared types belong here, not inside individual agents.
- If multiple agents need a contract, promote it into `schemas/`.
- Prefer expanding an existing schema file over creating many tiny type files unless a new domain is truly large.

### `demo/`

This folder owns deterministic demo fixtures and helper functions for exercising the workflow.

Rules:

- Demo helpers should stay deterministic.
- Keep fixture discovery and fixture metadata here.
- Do not bury demo-only code inside production workflow modules.

## Current Workflow Shape

Today the backend is best understood as two layers:

1. public workflow agents
2. feature-specific internals behind those agents

The intended flow is:

1. `agents/intake.ts`
2. `agents/parser.ts`
3. `agents/requirements.ts`
4. `agents/completeness.ts`
5. `agents/comparison.ts`
6. `agents/routing.ts`
7. `agents/executive.ts`

The first two steps already depend on internal feature folders:

- intake agent -> `intake/`
- parser agent -> `parsing/`

The remaining agents are currently more self-contained. If they grow, follow the same pattern:

- keep the public step in `agents/`
- place supporting internals in a feature folder named after the domain

Examples:

- future requirement helpers -> `src/backend/requirements/`
- future routing policy helpers -> `src/backend/routing/`
- future executive heuristics -> `src/backend/executive/`

## Where New Code Goes

Use these rules before adding files:

- New workflow step: add a file in `agents/`
- Helper used by only one step: add a feature folder or place it in that step's existing feature folder
- Shared contract: add it in `schemas/`
- Demo fixture or deterministic test input: add it in `demo/` or the existing fixture area
- Script for local verification: keep it in `scripts/`, importing through `agents/*` whenever possible

Do not create new top-level backend folders named after implementation mechanics like:

- `utils/`
- `helpers/`
- `extractors/`
- `normalizers/`
- `mergers/`

unless the code is truly shared across multiple backend domains and a feature-based home would be misleading.

## Import Direction

Keep imports flowing inward:

- scripts and future routes may import from `agents/`
- `agents/` may import from feature folders and `schemas/`
- feature folders may import from `schemas/`

Avoid the reverse:

- feature folders should not depend on route handlers
- feature folders should not reach into unrelated feature folders unless there is a clear shared contract
- scripts should not bypass `agents/` just because a helper function looks convenient

## Naming Conventions

Use names that describe workflow intent.

Prefer:

- `runIntakeAgent`
- `parseSubmittal`
- `buildRequirementSet`
- `determineRoutingDecision`

Avoid generic names that hide the domain:

- `processData`
- `normalize`
- `merge`
- `extract`

unless they live inside a clearly named feature folder where the context is already obvious.

## Current Gaps

This backend is still mid-sprint. A few important areas are not fully built yet:

- intake is intentionally minimal and only returns extracted PDF text
- provider abstractions exist, but the workflow is only partially wired to them
- no demo API route yet
- workflow contracts are still evolving between agents

When adding those pieces, preserve this organization:

- orchestrator entrypoints should live in `src/backend/orchestrator/`
- provider abstractions should live in `src/backend/providers/`
- API handlers should stay outside `src/backend` and call into backend agents/orchestrator

## Definition Of Clean Backend Structure

The backend is considered organized when:

- a reader can start in `agents/` and understand the workflow order quickly
- shared contracts are easy to find in `schemas/`
- feature internals are grouped by domain, not by implementation pattern
- imports mostly flow from outer layers into inner layers
- demo and script code do not leak into core workflow modules

If a future agent is unsure where to put code, default to preserving this feature-based structure rather than introducing a new top-level category.
