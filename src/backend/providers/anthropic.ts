import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

import type {
  LlmGenerateObjectRequest,
  LlmGenerateTextRequest,
  LlmObjectResult,
  LlmProvider,
  LlmTextResult,
} from "./llmProvider";

const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";

let sharedClient: Anthropic | null = null;

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required to run Anthropic-backed agents.",
    );
  }

  return apiKey;
}

export function getAnthropicClient(): Anthropic {
  if (!sharedClient) {
    sharedClient = new Anthropic({
      apiKey: getApiKey(),
    });
  }

  return sharedClient;
}

export type StructuredGenerationInput<Schema extends z.ZodType> = {
  systemPrompt: string;
  userPrompt: string;
  schema: Schema;
  maxTokens?: number;
  model?: string;
};

export type StructuredGenerationResult<Output> = {
  output: Output;
  responseId: string;
  model: string;
  text: string;
};

export type AnthropicLlmProviderOptions = {
  apiKey?: string;
  model?: string;
  client?: Anthropic;
};

export class AnthropicLlmProvider implements LlmProvider {
  readonly kind = "anthropic";
  readonly defaultModel: string;
  private readonly client: Anthropic;

  constructor(options: AnthropicLlmProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;

    if (!options.client && !apiKey) {
      throw new Error(
        "AnthropicLlmProvider requires ANTHROPIC_API_KEY or an injected Anthropic client.",
      );
    }

    this.defaultModel = options.model ?? DEFAULT_MODEL;
    this.client =
      options.client ??
      new Anthropic({
        apiKey,
      });
  }

  async generateText(request: LlmGenerateTextRequest): Promise<LlmTextResult> {
    const message = await this.client.messages.create({
      model: request.model ?? this.defaultModel,
      max_tokens: request.maxOutputTokens ?? 2000,
      system: request.instructions,
      messages: [
        {
          role: "user",
          content: request.input,
        },
      ],
    });

    return {
      provider: this.kind,
      model: request.model ?? this.defaultModel,
      responseId: message.id,
      text: message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n"),
    };
  }

  async generateObject<Schema extends z.ZodType>({
    schema,
    ...request
  }: LlmGenerateObjectRequest<Schema>): Promise<LlmObjectResult<Schema>> {
    const message = await this.client.messages.parse({
      model: request.model ?? this.defaultModel,
      max_tokens: request.maxOutputTokens ?? 2000,
      system: request.instructions,
      messages: [
        {
          role: "user",
          content: request.input,
        },
      ],
      output_config: {
        format: zodOutputFormat(schema),
      },
    });

    if (!message.parsed_output) {
      throw new Error("Anthropic returned no structured output.");
    }

    return {
      provider: this.kind,
      model: request.model ?? this.defaultModel,
      responseId: message.id,
      text: message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n"),
      object: message.parsed_output,
    };
  }
}

export async function generateStructuredOutputWithAnthropic<
  Schema extends z.ZodType,
>({
  systemPrompt,
  userPrompt,
  schema,
  maxTokens,
  model,
}: StructuredGenerationInput<Schema>): Promise<
  StructuredGenerationResult<z.infer<Schema>>
> {
  const startedAt = Date.now();
  const resolvedModel =
    model ??
    process.env.ANTHROPIC_COMPLETENESS_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    DEFAULT_MODEL;
  const provider = new AnthropicLlmProvider({
    client: getAnthropicClient(),
  });
  const response = await provider.generateObject({
    instructions: systemPrompt,
    input: userPrompt,
    schema,
    schemaName: "anthropic_structured_output",
    model: resolvedModel,
    maxOutputTokens: maxTokens,
  });

  const durationMs = Date.now() - startedAt;
  console.log(
    `[anthropic] model=${resolvedModel} response=${response.responseId ?? "unknown"} latency_ms=${durationMs}`,
  );

  return {
    output: response.object,
    responseId: response.responseId ?? "unknown",
    model: resolvedModel,
    text: response.text,
  };
}
