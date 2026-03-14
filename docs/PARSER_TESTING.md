# Parser Testing

## Goal

Test the parser in isolation with deterministic synthetic submittal packages, then compare LLM-backed behavior against the same fixture set.

The parser currently has two execution modes:

- deterministic extraction
- Anthropic-backed LLM review

## Fixture Generation

Generate the synthetic parser PDFs before running parser tests or scripts:

```bash
npm run parser:fixtures
```

What it does:

- creates synthetic PDF packages from `scripts/parser-fixture-definitions.ts`
- writes them into `scripts/fixtures/generated/`

## Deterministic Parser

Run one fixture:

```bash
npm run parser:run -- good-submittal
```

What it does:

- loads the generated fixture package
- runs `parseSubmittalDeterministic`
- prints the parsed JSON result

Use this mode to:

- debug extraction and classification without API calls
- validate snapshots
- compare LLM output against a stable baseline

## LLM Parser

Run one fixture:

```bash
export ANTHROPIC_API_KEY=your_key_here
npm run parser:run:llm -- good-submittal
```

Optional overrides:

```bash
npm run parser:run:llm -- good-submittal --model claude-sonnet-4-5-20250929
npm run parser:run:llm -- --all
```

What it does:

- extracts text from the generated PDFs
- sends the package evidence to the LLM-backed parser
- prints the parsed result JSON

Model selection falls back through parser-specific and shared Anthropic env vars when no explicit `--model` is provided.

## Parser Evals

Run all LLM parser evals:

```bash
export ANTHROPIC_API_KEY=your_key_here
npm run parser:eval:llm
```

Run one fixture:

```bash
npm run parser:eval:llm -- --fixture good-submittal
```

What it does:

- runs the Anthropic-backed parser against the fixture set
- compares actual output to hard and soft expectations
- prints pass/fail plus scoring
- exits nonzero if any fixture fails

Expectation source:

- `scripts/parser-eval-definitions.ts`

## Automated Test Coverage

Run deterministic parser tests:

```bash
npm run parser:test
```

Current coverage in `test/parser.test.ts` includes:

- core field extraction on `good-submittal`
- missing-document detection
- explicit deviation detection
- conflict resolution precedence
- low-text OCR-review behavior
- malformed PDF handling
- regression checks against real-world PDFs in `test-pdfs/`
- snapshot stability for every generated parser fixture

Refresh deterministic snapshots when intentional parser changes occur:

```bash
npm run parser:snapshot
```

## Available Synthetic Fixtures

- `good-submittal`
- `missing-doc-submittal`
- `deviation-submittal`
- `conflict-submittal`
- `scan-review-submittal`
- `malformed-submittal`

Fixture access helpers live in `src/backend/demo/mockSubmittals.ts`.

## How To Read Results

Focus on:

- `specSection`, `productType`, `manufacturer`, `modelNumber`, `revision`
- `documentParses`
- `missingDocuments`
- `deviations`
- `issues`
- `parserSummary`

Good signs:

- correct core identity fields
- sensible document typing
- no invented values
- explicit deviations captured when present
- low-text or broken PDFs downgraded into review states

Bad signs:

- hallucinated manufacturer/model/spec values
- missing obvious documents that are present
- missed explicit deviation language
- confidently parsed output from low-text or malformed PDFs

## Suggested Loop

1. Update parser logic or fixture content.
2. Run `npm run parser:run -- good-submittal`.
3. Run `npm run parser:test`.
4. If you changed LLM behavior, run `npm run parser:run:llm -- good-submittal`.
5. Finish with `npm run parser:eval:llm` when you want full eval coverage.

## Files That Matter

- `src/backend/agents/parser.ts`
- `src/backend/parsing/extractDocumentFacts.ts`
- `src/backend/parsing/reviewWithLlm.ts`
- `src/backend/parsing/runLlmParser.ts`
- `src/backend/parsing/composeParsedSubmittal.ts`
- `src/backend/providers/anthropic.ts`
- `src/backend/demo/mockSubmittals.ts`
- `scripts/generate-parser-fixtures.ts`
- `scripts/run-parser.ts`
- `scripts/run-parser-llm.ts`
- `scripts/run-parser-evals.ts`
- `scripts/update-parser-snapshots.ts`
- `test/parser.test.ts`
