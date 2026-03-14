import {
  type CreateLlmProviderOptions,
  type LlmProvider,
  resolveConfiguredLlmProvider,
} from "./llmProvider";
import { AnthropicLlmProvider } from "./anthropic";
import { MockLlmProvider } from "./mockProvider";

export * from "./anthropic";
export * from "./llmProvider";
export * from "./mockProvider";

export function createLlmProvider(
  options: CreateLlmProviderOptions = {},
): LlmProvider {
  const providerKind = resolveConfiguredLlmProvider(options);

  if (providerKind === "anthropic") {
    const apiKey = options.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;

    if (apiKey) {
      return new AnthropicLlmProvider({
        apiKey,
        model: options.anthropicModel,
      });
    }

    if (options.allowMockFallback !== false) {
      return new MockLlmProvider();
    }

    throw new Error(
      "Requested the Anthropic provider, but no ANTHROPIC_API_KEY was configured.",
    );
  }

  return new MockLlmProvider();
}
