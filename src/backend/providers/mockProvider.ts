import type * as z from "zod";

import type {
  LlmGenerateObjectRequest,
  LlmGenerateTextRequest,
  LlmObjectResult,
  LlmProvider,
  LlmTextResult,
} from "./llmProvider";

export type MockLlmProviderOptions = {
  model?: string;
  cannedText?: string;
  textHandler?: (
    request: LlmGenerateTextRequest,
  ) => Promise<string> | string;
  objectHandler?: (
    request: LlmGenerateObjectRequest<z.ZodTypeAny>,
  ) => Promise<unknown> | unknown;
};

export class MockLlmProvider implements LlmProvider {
  readonly kind = "mock";
  readonly defaultModel: string;

  constructor(private readonly options: MockLlmProviderOptions = {}) {
    this.defaultModel = options.model ?? "mock-llm-v1";
  }

  async generateText(request: LlmGenerateTextRequest): Promise<LlmTextResult> {
    const handledText = await this.options.textHandler?.(request);
    const text =
      handledText ??
      request.fallbackText ??
      this.options.cannedText ??
      `Mock response for input: ${request.input}`;

    return {
      provider: this.kind,
      model: request.model ?? this.defaultModel,
      text,
    };
  }

  async generateObject<Schema extends z.ZodTypeAny>(
    request: LlmGenerateObjectRequest<Schema>,
  ): Promise<LlmObjectResult<Schema>> {
    const candidate =
      (await this.options.objectHandler?.(
        request as LlmGenerateObjectRequest<z.ZodTypeAny>,
      )) ?? request.fallbackObject;

    if (candidate === undefined) {
      throw new Error(
        `MockLlmProvider.generateObject requires either objectHandler or fallbackObject for schema "${request.schemaName}".`,
      );
    }

    const object = request.schema.parse(candidate);

    return {
      provider: this.kind,
      model: request.model ?? this.defaultModel,
      text:
        request.fallbackText ??
        this.options.cannedText ??
        JSON.stringify(object, null, 2),
      object,
    };
  }
}
