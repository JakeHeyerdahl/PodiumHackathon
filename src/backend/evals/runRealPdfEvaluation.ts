import path from "node:path";

import { runComparisonAgent, type ParsedSubmittal as ComparisonParsedSubmittal, type RequirementSet as ComparisonRequirementSet } from "../agents/comparison";
import {
  buildRequirementSet,
  parseRequirementDocument,
  type ParsedRequirementDocument,
  type RequirementSet,
} from "../agents/requirements";
import { parseSubmittal, type ParserAgentOptions } from "../agents/parser";
import type { IncomingDocument, DetailedParsedSubmittal } from "../schemas/workflow";
import type { CreateLlmProviderOptions, LlmProvider } from "../providers";

export type RealPdfEvaluationInput = {
  submittalFiles: string[];
  requirementFile: string;
  parserModel?: string;
  requirementModel?: string;
  comparisonModel?: string;
  llmProvider?: LlmProvider;
} & CreateLlmProviderOptions;

export type RealPdfEvaluationResult = {
  parsedSubmittal: DetailedParsedSubmittal;
  parsedRequirementDocument: ParsedRequirementDocument;
  requirementSet: RequirementSet;
  comparisonInput: {
    parsedSubmittal: ComparisonParsedSubmittal;
    requirementSet: ComparisonRequirementSet;
  };
  comparisonResult: Awaited<ReturnType<typeof runComparisonAgent>>;
};

function toIncomingDocument(filePath: string, index: number): IncomingDocument {
  const resolvedPath = path.resolve(filePath);

  return {
    documentId: `submittal-${String(index + 1).padStart(2, "0")}`,
    fileName: path.basename(resolvedPath),
    mimeType: "application/pdf",
    filePath: resolvedPath,
  };
}

function toComparisonInputs(
  parsedSubmittal: DetailedParsedSubmittal,
  requirementSet: RequirementSet,
): {
  parsedSubmittal: ComparisonParsedSubmittal;
  requirementSet: ComparisonRequirementSet;
} {
  return {
    parsedSubmittal: {
      specSection: parsedSubmittal.specSection.value,
      productType: parsedSubmittal.productType.value,
      manufacturer: parsedSubmittal.manufacturer.value,
      modelNumber: parsedSubmittal.modelNumber.value,
      revision: parsedSubmittal.revision.value,
      extractedAttributes: Object.fromEntries(
        parsedSubmittal.extractedAttributes.map((attribute) => [
          attribute.name,
          attribute.value,
        ]),
      ),
      items: (parsedSubmittal.items ?? []).map((item) => ({
        itemId: item.itemId,
        label: item.label.value ?? item.itemId,
        productType: item.productType.value,
        specSection: item.specSection.value,
        manufacturer: item.manufacturer.value,
        modelNumber: item.modelNumber.value,
        extractedAttributes: Object.fromEntries(
          item.attributes.map((attribute) => [attribute.name, attribute.value]),
        ),
        supportingDocuments: item.supportingDocuments,
      })),
      supportingDocuments:
        parsedSubmittal.supportingDocuments ??
        parsedSubmittal.documentParses.map((document) => document.fileName),
      deviations: parsedSubmittal.deviations.map((issue) => issue.message),
    },
    requirementSet: {
      specSection: requirementSet.specSection.value,
      requiredAttributes: Object.fromEntries(
        requirementSet.requiredAttributes.map((attribute) => [
          attribute.key,
          attribute.expectedValue,
        ]),
      ),
      requiredItems: (requirementSet.requiredItems ?? []).map((item) => ({
        itemId: item.itemId,
        label: item.label,
        productType: item.productType ?? null,
        specSection: item.specSection ?? null,
        manufacturer: typeof item.manufacturerRequirement === "string"
          ? item.manufacturerRequirement
          : null,
        modelNumber: typeof item.modelNumberRequirement === "string"
          ? item.modelNumberRequirement
          : null,
        requiredAttributes: Object.fromEntries(
          item.requiredAttributes.map((attribute) => [
            attribute.key,
            attribute.expectedValue,
          ]),
        ),
        requiredDocuments: item.requiredDocuments.map((document) => document.label),
      })),
      requiredDocuments: requirementSet.requiredDocuments.map((document) => document.label),
    },
  };
}

export async function runRealPdfEvaluation(
  input: RealPdfEvaluationInput,
): Promise<RealPdfEvaluationResult> {
  const parserOptions: ParserAgentOptions = {
    mode: "llm",
    model: input.parserModel,
    llmProvider: input.llmProvider,
    provider: input.provider,
    anthropicApiKey: input.anthropicApiKey,
    anthropicModel: input.anthropicModel,
    allowMockFallback: input.allowMockFallback,
    allowDeterministicFallback: true,
  };

  const parsedSubmittal = await parseSubmittal(
    input.submittalFiles.map(toIncomingDocument),
    parserOptions,
  );

  const parsedRequirementDocument = await parseRequirementDocument({
    document: {
      documentId: "requirement-01",
      fileName: path.basename(path.resolve(input.requirementFile)),
      mimeType: "application/pdf",
      filePath: path.resolve(input.requirementFile),
    },
    model: input.requirementModel,
    llmProvider: input.llmProvider,
    provider: input.provider,
    anthropicApiKey: input.anthropicApiKey,
    anthropicModel: input.anthropicModel,
    allowMockFallback: input.allowMockFallback,
  });

  const requirementSet = buildRequirementSet({
    projectName:
      parsedRequirementDocument.metadata.projectName ??
      parsedSubmittal.packageMetadata?.projectName.value ??
      "Unknown Project",
    submittalTitle:
      parsedSubmittal.packageMetadata?.submittalNumber.value ??
      "Real PDF Evaluation",
    parsedSubmittal: {
      specSection: parsedSubmittal.specSection.value,
      productType: parsedSubmittal.productType.value,
      manufacturer: parsedSubmittal.manufacturer.value,
      modelNumber: parsedSubmittal.modelNumber.value,
      revision: parsedSubmittal.revision.value,
      extractedAttributes: Object.fromEntries(
        parsedSubmittal.extractedAttributes.map((attribute) => [
          attribute.name,
          attribute.value,
        ]),
      ),
      missingDocuments: parsedSubmittal.missingDocuments,
      deviations: parsedSubmittal.deviations.map((issue) => issue.message),
    },
    parsedRequirementDocument,
  });

  const comparisonInput = toComparisonInputs(parsedSubmittal, requirementSet);
  const comparisonResult = await runComparisonAgent({
    parsedSubmittal: comparisonInput.parsedSubmittal,
    requirementSet: comparisonInput.requirementSet,
    model: input.comparisonModel,
    llmProvider: input.llmProvider,
    provider: input.provider,
    anthropicApiKey: input.anthropicApiKey,
    anthropicModel: input.anthropicModel,
    allowMockFallback: input.allowMockFallback,
    allowDeterministicFallback: true,
  });

  return {
    parsedSubmittal,
    parsedRequirementDocument,
    requirementSet,
    comparisonInput,
    comparisonResult,
  };
}
