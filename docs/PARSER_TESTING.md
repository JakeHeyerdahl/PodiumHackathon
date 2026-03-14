# Parser Testing

## Goal

Test the parser against the retained real PDF cases only:

- `test-pdfs/perfect.pdf`
- `test-pdfs/submittal-1.pdf`
- `test-pdfs/busted.pdf`
- `test-pdfs/requirement-1.pdf`

The parser still supports:

- deterministic extraction
- Anthropic-backed LLM review

## Deterministic Parser

Run one fixture:

```bash
npm run parser:run -- --files test-pdfs/perfect.pdf --deterministic
```

What it does:

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
npm run parser:run:llm -- --files test-pdfs/perfect.pdf
```

Optional overrides:

```bash
npm run parser:run:llm -- --files test-pdfs/perfect.pdf --model claude-sonnet-4-5-20250929
```

What it does:

- extracts text from the generated PDFs
- sends the package evidence to the LLM-backed parser
- prints the parsed result JSON

Model selection falls back through parser-specific and shared Anthropic env vars when no explicit `--model` is provided.

## Automated Test Coverage

Run deterministic parser tests:

```bash
npm run parser:test
```

Current coverage in `test/parser.test.ts` includes:

- current extraction behavior on `perfect.pdf`
- current extraction behavior on `submittal-1.pdf`
- current failure behavior on `busted.pdf`
- regression check that `requirement-1.pdf` does not trigger false deviations

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
2. Run `npm run parser:run -- --files test-pdfs/perfect.pdf --deterministic`.
3. Run `npm run parser:test`.
4. If you changed LLM behavior, run `npm run parser:run:llm -- --files test-pdfs/perfect.pdf`.
5. Run `npm run workflow:test` to confirm the retained intake cases still behave as expected.

## Files That Matter

- `src/backend/agents/parser.ts`
- `src/backend/parsing/extractDocumentFacts.ts`
- `src/backend/parsing/reviewWithLlm.ts`
- `src/backend/parsing/runLlmParser.ts`
- `src/backend/parsing/composeParsedSubmittal.ts`
- `src/backend/providers/anthropic.ts`
- `src/backend/demo/realPdfFixtures.ts`
- `scripts/run-parser.ts`
- `scripts/run-parser-llm.ts`
- `test/parser.test.ts`
