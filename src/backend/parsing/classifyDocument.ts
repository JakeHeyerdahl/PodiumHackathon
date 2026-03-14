import type { IncomingDocument, ParsedDocumentType } from "../schemas/workflow";

const CLASSIFICATION_RULES: Array<{
  type: ParsedDocumentType;
  patterns: RegExp[];
}> = [
  {
    type: "submittal_cover",
    patterns: [/submittal register/i, /submittal cover/i, /package index/i],
  },
  {
    type: "product_data",
    patterns: [/product data/i, /catalog data/i, /technical data sheet/i],
  },
  {
    type: "shop_drawing",
    patterns: [/shop drawing/i, /fabrication drawing/i, /arrangement drawing/i],
  },
  {
    type: "compliance_certificate",
    patterns: [/certificate of compliance/i, /compliance certificate/i],
  },
  {
    type: "o_and_m_manual",
    patterns: [/operation and maintenance/i, /o&m manual/i, /maintenance manual/i],
  },
  {
    type: "warranty",
    patterns: [/warranty/i, /manufacturer warranty/i],
  },
  {
    type: "finish_sheet",
    patterns: [/finish schedule/i, /color chart/i],
  },
  {
    type: "deviation_letter",
    patterns: [/deviation request/i, /substitution request/i, /exception letter/i],
  },
];

export function classifyDocument(
  document: IncomingDocument,
  text: string,
): ParsedDocumentType {
  if (document.declaredDocType) {
    return document.declaredDocType;
  }

  const haystack = `${document.fileName} ${text}`;
  const match = CLASSIFICATION_RULES.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(haystack)),
  );

  return match?.type ?? "unknown";
}
