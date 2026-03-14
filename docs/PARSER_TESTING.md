# Parser Testing

## Goal

Test the parsing agent in isolation with fake construction submittal packages.

The parser test flow now has two modes:

- deterministic baseline
- Anthropic-backed LLM parsing

## Scripts

### Generate fake parser fixtures

```bash
npm run parser:fixtures
```

What it does:

- creates synthetic PDF packages from fixture definitions
- writes them into `scripts/fixtures/generated/`

Input source:

- `scripts/parser-fixture-definitions.ts`

### Run the deterministic parser

```bash
npm run parser:run -- good-submittal
```

What it does:

- runs the non-LLM parser baseline
- prints the parsed JSON result

Use this to:

- compare current LLM behavior against the old deterministic baseline
- debug extraction issues without consuming API calls

### Run the LLM parser on one fixture

```bash
export ANTHROPIC_API_KEY=your_key_here
npm run parser:run:llm -- good-submittal
```

What it does:

- extracts PDF text from the synthetic package
- sends the package evidence to the Anthropic-backed parsing agent
- prints the parsed result JSON

Optional:

```bash
npm run parser:run:llm -- good-submittal --model claude-sonnet-4-5-20250929
npm run parser:run:llm -- --all
```

### Run parser evals against expectations

```bash
export ANTHROPIC_API_KEY=your_key_here
npm run parser:eval:llm
```

Run one fixture:

```bash
npm run parser:eval:llm -- --fixture good-submittal
```

What it does:

- runs the Anthropic-backed parser
- compares actual output to expected hard checks and soft checks
- prints pass/fail plus scoring
- exits with nonzero status if any fixture fails

Expectation source:

- `scripts/parser-eval-definitions.ts`

## Fake Inputs

Current fake packages:

- `good-submittal`
  - complete package with clear identity fields
- `missing-doc-submittal`
  - missing warranty document
- `deviation-submittal`
  - explicit deviation letter
- `conflict-submittal`
  - conflicting model/revision evidence
- `scan-review-submittal`
  - low-text scan that should trigger review behavior
- `malformed-submittal`
  - corrupted PDF file

Fake document content lives in:

- `scripts/parser-fixture-definitions.ts`

## Expected Results

The parser output is judged in two layers.

### Hard checks

These should match exactly:

- parser status
- core fields like `specSection`, `manufacturer`, `modelNumber`
- expected missing documents
- expected deviation detection
- expected document types
- expected unresolved fields

### Soft checks

These are quality signals:

- preferred attributes extracted
- preferred issue codes present
- acceptable confidence levels

Soft misses do not always fail the whole fixture if they stay under the allowed threshold.

## How To Read Results

### `parser:run:llm`

Look at:

- `specSection`, `productType`, `manufacturer`, `modelNumber`, `revision`
- `documentParses`
- `missingDocuments`
- `deviations`
- `issues`
- `parserSummary.status`

Good signs:

- correct identity fields
- strong document typing
- no hallucinated values
- missing docs only when truly implied
- review status when evidence is weak

Bad signs:

- invented manufacturer/model/spec values
- missing obvious documents that are present
- failure to detect explicit deviation language
- marking low-text scans as confidently complete

### `parser:eval:llm`

Example result shape:

- `PASS`
  - hard checks matched
  - soft quality was acceptable
- `FAIL`
  - one or more hard checks failed
  - or too many soft checks missed

The summary shows:

- fixture pass count
- total hard checks passed
- total soft checks passed

## Best Testing Loop

1. Edit fixture content or parser prompt.
2. Run one fixture with:

```bash
npm run parser:run:llm -- good-submittal
```

3. Run evaluation for that fixture:

```bash
npm run parser:eval:llm -- --fixture good-submittal
```

4. When it looks good, run all evals:

```bash
npm run parser:eval:llm
```

## Files That Matter

- `src/backend/agents/parser.ts`
- `src/backend/parsing/reviewWithLlm.ts`
- `src/backend/parsing/runLlmParser.ts`
- `src/backend/providers/anthropic.ts`
- `scripts/run-parser-llm.ts`
- `scripts/run-parser-evals.ts`
- `scripts/parser-fixture-definitions.ts`
- `scripts/parser-eval-definitions.ts`
