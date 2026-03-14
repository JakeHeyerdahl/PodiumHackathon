import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import {
  AnthropicLlmProvider,
  MockLlmProvider,
  createLlmProvider,
  resolveConfiguredLlmProvider,
} from "../src/backend/providers";

test("resolveConfiguredLlmProvider prefers explicit provider", () => {
  assert.equal(
    resolveConfiguredLlmProvider({
      provider: "mock",
      anthropicApiKey: "test-key",
    }),
    "mock",
  );
});

test("resolveConfiguredLlmProvider uses Anthropic when a key is available", () => {
  assert.equal(
    resolveConfiguredLlmProvider({
      anthropicApiKey: "test-key",
    }),
    "anthropic",
  );
});

test("MockLlmProvider returns fallback text deterministically", async () => {
  const provider = new MockLlmProvider();
  const result = await provider.generateText({
    instructions: "Be helpful.",
    input: "Summarize this package.",
    fallbackText: "Deterministic summary.",
  });

  assert.equal(result.provider, "mock");
  assert.equal(result.text, "Deterministic summary.");
});

test("MockLlmProvider validates structured responses with the supplied schema", async () => {
  const provider = new MockLlmProvider({
    objectHandler: () => ({
      specSection: "23 73 13",
      confidence: "high",
    }),
  });

  const result = await provider.generateObject({
    instructions: "Return strict structured JSON.",
    input: "Spec section is 23 73 13.",
    schemaName: "requirement_signal",
    schema: z.object({
      specSection: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  });

  assert.equal(result.object.specSection, "23 73 13");
  assert.equal(result.object.confidence, "high");
});

test("createLlmProvider returns an Anthropic provider when explicitly configured", () => {
  const provider = createLlmProvider({
    provider: "anthropic",
    anthropicApiKey: "test-key",
  });

  assert(provider instanceof AnthropicLlmProvider);
});

test("createLlmProvider falls back to mock when Anthropic is requested without a key", () => {
  const provider = createLlmProvider({
    provider: "anthropic",
  });

  assert(provider instanceof MockLlmProvider);
});
