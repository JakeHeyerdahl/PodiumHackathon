import type * as z from "zod";

export type LlmProviderKind = "mock" | "anthropic";

export type LlmRequestMetadata = Record<string, string>;

export type LlmGenerateTextRequest = {
  instructions: string;
  input: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: LlmRequestMetadata;
  fallbackText?: string;
};

export type LlmGenerateObjectRequest<Schema extends z.ZodTypeAny> =
  LlmGenerateTextRequest & {
    schema: Schema;
    schemaName: string;
    fallbackObject?: z.infer<Schema>;
  };

export type LlmTextResult = {
  provider: LlmProviderKind;
  model: string;
  responseId?: string;
  text: string;
};

export type LlmObjectResult<Schema extends z.ZodTypeAny> = LlmTextResult & {
  object: z.infer<Schema>;
};

export interface LlmProvider {
  readonly kind: LlmProviderKind;
  readonly defaultModel: string;
  generateText(request: LlmGenerateTextRequest): Promise<LlmTextResult>;
  generateObject<Schema extends z.ZodTypeAny>(
    request: LlmGenerateObjectRequest<Schema>,
  ): Promise<LlmObjectResult<Schema>>;
}

export type CreateLlmProviderOptions = {
  provider?: LlmProviderKind;
  anthropicApiKey?: string;
  anthropicModel?: string;
  allowMockFallback?: boolean;
};

export function resolveConfiguredLlmProvider(
  options: Pick<CreateLlmProviderOptions, "provider" | "anthropicApiKey"> = {},
): LlmProviderKind {
  const configuredProvider =
    options.provider ??
    readProviderEnv("BACKEND_LLM_PROVIDER") ??
    readProviderEnv("LLM_PROVIDER");

  if (configuredProvider) {
    return configuredProvider;
  }

  return options.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ? "anthropic" : "mock";
}

function readProviderEnv(
  key: "BACKEND_LLM_PROVIDER" | "LLM_PROVIDER",
): LlmProviderKind | undefined {
  const value = process.env[key]?.trim().toLowerCase();

  if (value === "mock" || value === "anthropic") {
    return value;
  }

  return undefined;
}
