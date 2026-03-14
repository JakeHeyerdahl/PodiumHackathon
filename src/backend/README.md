# Backend Organization Guide

This document describes how the backend is organized today.

The easiest way to understand the system is to read it in this order:

1. `schemas/`
2. `agents/`
3. `orchestrator/`
4. feature folders such as `intake/`, `parsing/`, and `completeness/`
5. `providers/`
6. `demo/`

## Directory Layout

```text
src/backend/
  README.md
  agents/
    intake.ts
    parser.ts
    requirements.ts
    completeness.ts
    comparison.ts
    routing.ts
    executive.ts
  orchestrator/
    runWorkflow.ts
  intake/
    normalize.ts
    extractPdf.ts
  parsing/
    classifyDocument.ts
    composeParsedSubmittal.ts
    extractDocumentFacts.ts
    extractPdfText.ts
    reviewWithLlm.ts
    runLlmParser.ts
  completeness/
    reviewWithLlm.ts
  providers/
    anthropic.ts
    index.ts
    llmProvider.ts
    mockProvider.ts
  schemas/
    intake.ts
    workflow.ts
  demo/
    mockSubmittals.ts
```

## Mental Model

The backend is organized around workflow steps, with a small amount of adaptation between richer internal types and the shared workflow state.

- `schemas/` defines the shared contracts.
- `agents/` owns the public workflow steps.
- `orchestrator/` wires the steps together into an end-to-end run.
- feature folders hold step-specific implementation details.
- `providers/` abstracts model access.
- `demo/` exposes deterministic fixture helpers for tests and local runs.

## Workflow Order

The orchestrated flow is:

1. `agents/intake.ts`
2. `agents/parser.ts`
3. `agents/requirements.ts`
4. `agents/completeness.ts`
5. `agents/comparison.ts`
6. `agents/routing.ts`
7. `agents/executive.ts`

`orchestrator/runWorkflow.ts` is the current end-to-end entrypoint. It:

- runs intake against fixture-backed uploads
- converts accepted PDFs into parser input
- runs parser, requirements, completeness, comparison, routing, and executive in order
- stores workflow-facing summaries in `WorkflowState`
- returns richer intermediate artifacts alongside the final workflow state

## Folder Ownership

### `agents/`

Public workflow surface area.

Rules:

- Keep one workflow step per file.
- Export the main step entrypoint.
- Keep orchestration-facing decisions here.
- Push extraction, parsing, or prompt-building details into feature folders.

### `orchestrator/`

End-to-end workflow coordination.

Rules:

- Own agent sequencing and state transitions.
- Own adapters between rich internal outputs and workflow-facing summaries.
- Do not bury feature logic here.

### `intake/`

Upload normalization and PDF preparation for intake.

Current responsibilities:

- validating and normalizing upload payloads
- assigning run IDs and document metadata
- extracting raw PDF text and warnings during intake

### `parsing/`

Parser-specific internals.

Current responsibilities:

- PDF text extraction for parser review
- heuristic document classification
- deterministic fact extraction
- LLM parser review
- parsed submittal composition

### `completeness/`

Completeness-review internals.

Current responsibilities:

- LLM-backed completeness review and evidence shaping

### `providers/`

Model-provider abstraction layer.

Current responsibilities:

- selecting Anthropic vs mock provider behavior
- validating API-key-backed execution paths
- returning typed structured outputs to agents

### `schemas/`

Shared contracts for the backend.

Current split:

- `intake.ts` contains upload and intake envelope types
- `workflow.ts` contains workflow-state, parser, completeness, comparison, routing, and executive types

### `demo/`

Deterministic backend fixtures for parser tests and local inspection.

## Import Direction

Prefer imports that flow inward:

- scripts and tests -> `agents/`, `orchestrator/`, `demo/`
- `orchestrator/` -> `agents/`, `schemas/`
- `agents/` -> feature folders, `providers/`, `schemas/`
- feature folders -> `providers/`, `schemas/`

Avoid convenience imports that skip a clearer public entrypoint when one already exists.

## Where New Code Goes

- New workflow step: add a file in `agents/`
- New end-to-end coordination logic: add it in `orchestrator/`
- Helper used by one domain only: keep it in that domain folder
- Shared backend contract: add it in `schemas/`
- Deterministic test fixture support: add it in `demo/` or `scripts/fixtures/`
- Local verification CLI: add it in `scripts/`

Avoid creating generic mechanic-based top-level folders like `utils/`, `helpers/`, or `normalizers/` unless the code is truly cross-domain and a feature-based home would be misleading.

## Current Notes

- The workflow state intentionally keeps a simpler serializable summary than some richer agent outputs.
- The parser, completeness, comparison, and routing steps all support LLM-backed execution paths.
- Deterministic parser coverage remains important for regression tests and snapshots.
