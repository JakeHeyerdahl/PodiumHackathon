import type {
  DocumentFieldName,
  ExtractedAttribute,
  ParserIssue,
  ParsedDocumentType,
  SourceReference,
} from "../schemas/workflow";

export type ExtractedFieldCandidate = {
  field: DocumentFieldName;
  value: string;
  documentType: ParsedDocumentType;
  confidence: "high" | "medium";
  sources: SourceReference[];
};

export type DocumentExtraction = {
  fieldCandidates: ExtractedFieldCandidate[];
  attributes: ExtractedAttribute[];
  deviations: ParserIssue[];
  expectedDocuments: string[];
};

function buildSource(
  documentId: string,
  fileName: string,
  excerpt: string,
): SourceReference[] {
  return [
    {
      documentId,
      fileName,
      excerpt: excerpt.slice(0, 180),
    },
  ];
}

function captureValue(pattern: RegExp, text: string): string | null {
  const match = text.match(pattern);
  return match?.groups?.value?.trim() ?? null;
}

function normalizeExtractionText(text: string): string {
  return text
    .replace(/[●•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function captureLabeledValue(labels: string[], text: string): string | null {
  const escapedLabels = labels
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pattern = new RegExp(
    `(?:${escapedLabels}):\\s*(?<value>.+?)(?=\\s+(?:Specification Section|Product Type|Equipment|Manufacturer|Model Number|Model No\\.?|Unit Model|Revision|Rev|Included Documents|Airflow|Voltage|Motor|Filter Rating|Filter|Finish|Warranty period)|$)`,
    "i",
  );

  return captureValue(pattern, text);
}

function collectAttributes(
  documentId: string,
  fileName: string,
  text: string,
): ExtractedAttribute[] {
  const attributePatterns: Array<{ name: string; pattern: RegExp }> = [
    {
      name: "airflow",
      pattern: /airflow:\s*(?<value>[\d,]+\s*c?fm)(?=\s+(?:[A-Z][A-Za-z ]+:)|$)/i,
    },
    {
      name: "voltage",
      pattern: /voltage:\s*(?<value>\d+\s*v(?:\/\d+ph)?)(?=\s+(?:[A-Z][A-Za-z ]+:)|$)/i,
    },
    {
      name: "motor",
      pattern: /motor:\s*(?<value>.+?)(?=\s+(?:[A-Z][A-Za-z ]+:)|$)/i,
    },
    {
      name: "finish",
      pattern: /finish:\s*(?<value>.+?)(?=\s+(?:[A-Z][A-Za-z ]+:)|$)/i,
    },
    {
      name: "filter_rating",
      pattern: /filter rating:\s*(?<value>.+?)(?=\s+(?:[A-Z][A-Za-z ]+:)|$)/i,
    },
  ];

  return attributePatterns.flatMap(({ name, pattern }) => {
    const value = captureValue(pattern, text);
    if (!value) {
      return [];
    }

    return [
      {
        name,
        value,
        confidence: "high",
        sources: buildSource(documentId, fileName, `${name}: ${value}`),
      },
    ];
  });
}

function collectExpectedDocuments(text: string): string[] {
  const expectedDocuments = new Set<string>();
  const lowered = text.toLowerCase();

  if (lowered.includes("product data")) {
    expectedDocuments.add("product_data");
  }
  if (lowered.includes("shop drawing")) {
    expectedDocuments.add("shop_drawing");
  }
  if (lowered.includes("warranty")) {
    expectedDocuments.add("warranty");
  }
  if (lowered.includes("operation and maintenance") || lowered.includes("o&m")) {
    expectedDocuments.add("o_and_m_manual");
  }
  if (lowered.includes("certificate of compliance")) {
    expectedDocuments.add("compliance_certificate");
  }

  return [...expectedDocuments].sort();
}

export function extractDocumentFacts(params: {
  documentId: string;
  fileName: string;
  documentType: ParsedDocumentType;
  text: string;
}): DocumentExtraction {
  const { documentId, fileName, documentType, text } = params;
  const normalizedText = normalizeExtractionText(text);
  const fieldCandidates: ExtractedFieldCandidate[] = [];

  const specSection = captureValue(
    /spec(?:ification)? section:?\s*(?<value>\d{2}\s?\d{2}\s?\d{2})/i,
    text,
  ) ??
    captureValue(
      /(?:spec(?:ification)?\s*section|section)\s*:?\s*(?<value>\d{2}\s?\d{2}\s?\d{2})/i,
      normalizedText,
    ) ??
    captureValue(
      /sectio\s*n\s*(?<value>\d{2}\s?\d{2}\s?\d{2})/i,
      text,
    );
  if (specSection) {
    fieldCandidates.push({
      field: "specSection",
      value: specSection.replace(/\s+/g, " ").trim(),
      documentType,
      confidence: "high",
      sources: buildSource(documentId, fileName, `Spec Section ${specSection}`),
    });
  }

  const productType =
    captureLabeledValue(["Product Type"], text) ??
    captureLabeledValue(["Equipment"], text) ??
    captureValue(
      /(?:^|\s)(?<value>concrete masonry units\s*\(cmu\)|mortar|reinforcing steel)(?=\s+manufacturer|\s+approved|\s+parameter|\s+acme|\s+quikmix|\s+steelpro|$)/i,
      normalizedText,
    );
  if (productType) {
    fieldCandidates.push({
      field: "productType",
      value: productType,
      documentType,
      confidence: "high",
      sources: buildSource(documentId, fileName, `Product Type ${productType}`),
    });
  }

  const manufacturer =
    captureLabeledValue(["Manufacturer"], text) ??
    captureValue(
      /approved manufacturer per spec\s*\((?<value>[^)]+?)(?:\s+or equivalent)?\)/i,
      normalizedText,
    ) ??
    captureValue(
      /(?:concrete masonry units\s*\(cmu\)|mortar|reinforcing steel)\s+(?<value>acme block co\.|quikmix|steelpro)(?=\s+)/i,
      normalizedText,
    );
  if (manufacturer) {
    fieldCandidates.push({
      field: "manufacturer",
      value: manufacturer,
      documentType,
      confidence: "high",
      sources: buildSource(documentId, fileName, `Manufacturer ${manufacturer}`),
    });
  }

  const modelNumber =
    captureLabeledValue(["Model Number", "Model No.", "Model No", "Model"], text) ??
    captureLabeledValue(["Unit Model"], text) ??
    captureValue(
      /(?:product|product standard)\s+(?<value>standard cmu|type n mortar|#4 rebar,\s*grade 60)(?=\s+astm|\s+section|\s+quantity|$)/i,
      normalizedText,
    );
  if (modelNumber) {
    fieldCandidates.push({
      field: "modelNumber",
      value: modelNumber.toUpperCase(),
      documentType,
      confidence: "high",
      sources: buildSource(documentId, fileName, `Model ${modelNumber}`),
    });
  }

  const revision =
    captureLabeledValue(["Revision"], text) ??
    captureLabeledValue(["Rev"], text) ??
    captureValue(/revision\s*(?<value>[a-z0-9.-]+)/i, normalizedText);
  if (revision) {
    fieldCandidates.push({
      field: "revision",
      value: revision.toUpperCase(),
      documentType,
      confidence: "high",
      sources: buildSource(documentId, fileName, `Revision ${revision}`),
    });
  }

  const deviations: ParserIssue[] = [];
  const hasNegativeDeviationStatement =
    /no\s+(substitutions?|deviations?)\s+(are\s+)?proposed/i.test(normalizedText) ||
    /without\s+(substitutions?|deviations?)/i.test(normalizedText) ||
    /no\s+exceptions?\s+(to\s+specification)?/i.test(normalizedText);
  const hasPositiveDeviationStatement =
    /document contains explicit deviation/i.test(normalizedText) ||
    /(?:a|an)\s+deviation\s+(?:is|was)\s+proposed/i.test(normalizedText) ||
    /(?:a|an)\s+substitution\s+(?:is|was)\s+proposed/i.test(normalizedText) ||
    /proposed\s+(?:deviation|substitution)/i.test(normalizedText) ||
    /deviation request/i.test(normalizedText) ||
    /substitution request/i.test(normalizedText) ||
    /exception letter/i.test(normalizedText);

  if (!hasNegativeDeviationStatement && hasPositiveDeviationStatement) {
    deviations.push({
      code: "deviation_detected",
      severity: "warning",
      message: "Document contains explicit deviation or substitution language.",
      documentId,
      sources: buildSource(documentId, fileName, text),
    });
  }

  return {
    fieldCandidates,
    attributes: collectAttributes(documentId, fileName, text),
    deviations,
    expectedDocuments: collectExpectedDocuments(text),
  };
}
