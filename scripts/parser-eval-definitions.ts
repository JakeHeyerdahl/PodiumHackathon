import type { MockFixtureName } from "../src/backend/demo/mockSubmittals";
import type {
  DocumentFieldName,
  ParsedDocumentType,
  ParserConfidence,
  ParserStatus,
} from "../src/backend/schemas/workflow";

export type ParserFieldExpectation = {
  value: string | null;
  allowedConfidence?: ParserConfidence[];
};

export type ParserEvalDefinition = {
  name: MockFixtureName;
  description: string;
  hard: {
    status: ParserStatus;
    fields?: Partial<Record<DocumentFieldName, ParserFieldExpectation>>;
    missingDocuments?: string[];
    deviationCodes?: string[];
    documentTypes?: Array<{
      documentId: string;
      documentType: ParsedDocumentType;
    }>;
    unresolvedFields?: DocumentFieldName[];
  };
  soft?: {
    preferredAttributeNames?: string[];
    preferredIssueCodes?: string[];
    maxSoftFailures?: number;
  };
};

export const parserEvalDefinitions: Record<MockFixtureName, ParserEvalDefinition> = {
  "good-submittal": {
    name: "good-submittal",
    description: "Complete package should extract the core identity and supporting docs cleanly.",
    hard: {
      status: "parsed",
      fields: {
        specSection: {
          value: "23 73 13",
          allowedConfidence: ["high", "medium"],
        },
        productType: {
          value: "Packaged Indoor Air Handling Unit",
          allowedConfidence: ["high", "medium"],
        },
        manufacturer: {
          value: "Acme Air Systems",
          allowedConfidence: ["high", "medium"],
        },
        modelNumber: {
          value: "AHU-9000",
          allowedConfidence: ["high", "medium"],
        },
        revision: {
          value: "B",
          allowedConfidence: ["high", "medium"],
        },
      },
      missingDocuments: [],
      deviationCodes: [],
      unresolvedFields: [],
      documentTypes: [
        { documentId: "01-cover", documentType: "submittal_cover" },
        { documentId: "02-product", documentType: "product_data" },
        { documentId: "03-drawing", documentType: "shop_drawing" },
        { documentId: "04-warranty", documentType: "warranty" },
        { documentId: "05-manual", documentType: "o_and_m_manual" },
      ],
    },
    soft: {
      preferredAttributeNames: ["airflow", "voltage", "motor", "filter_rating", "finish"],
      maxSoftFailures: 1,
    },
  },
  "missing-doc-submittal": {
    name: "missing-doc-submittal",
    description: "Package should identify the missing warranty and stay warning-level.",
    hard: {
      status: "parsed_with_warnings",
      fields: {
        specSection: { value: "23 73 13" },
        manufacturer: { value: "Acme Air Systems" },
        modelNumber: { value: "AHU-9000" },
      },
      missingDocuments: ["warranty"],
      deviationCodes: [],
      unresolvedFields: [],
      documentTypes: [
        { documentId: "01-cover", documentType: "submittal_cover" },
        { documentId: "02-product", documentType: "product_data" },
        { documentId: "03-drawing", documentType: "shop_drawing" },
        { documentId: "04-manual", documentType: "o_and_m_manual" },
      ],
    },
    soft: {
      preferredAttributeNames: ["airflow", "voltage"],
      maxSoftFailures: 1,
    },
  },
  "deviation-submittal": {
    name: "deviation-submittal",
    description: "Package should preserve core identity and flag explicit deviation language.",
    hard: {
      status: "parsed_with_warnings",
      fields: {
        specSection: { value: "23 73 13" },
        manufacturer: { value: "Acme Air Systems" },
        modelNumber: { value: "AHU-9000" },
      },
      missingDocuments: ["shop_drawing", "warranty", "o_and_m_manual"],
      deviationCodes: ["deviation_detected"],
      unresolvedFields: [],
      documentTypes: [
        { documentId: "01-cover", documentType: "submittal_cover" },
        { documentId: "02-product", documentType: "product_data" },
        { documentId: "03-deviation", documentType: "deviation_letter" },
      ],
    },
    soft: {
      preferredIssueCodes: ["deviation_detected"],
      maxSoftFailures: 1,
    },
  },
  "conflict-submittal": {
    name: "conflict-submittal",
    description: "Package should detect conflict and still prefer the stronger product identity.",
    hard: {
      status: "parsed_with_warnings",
      fields: {
        specSection: { value: "23 73 13" },
        manufacturer: { value: "Acme Air Systems" },
        modelNumber: { value: "AHU-9000" },
        revision: { value: "B" },
      },
      missingDocuments: ["warranty", "o_and_m_manual"],
      deviationCodes: [],
      unresolvedFields: [],
      documentTypes: [
        { documentId: "01-cover", documentType: "submittal_cover" },
        { documentId: "02-product", documentType: "product_data" },
        { documentId: "03-drawing", documentType: "shop_drawing" },
      ],
    },
    soft: {
      preferredIssueCodes: ["conflicting_values"],
      preferredAttributeNames: ["finish", "voltage"],
      maxSoftFailures: 1,
    },
  },
  "scan-review-submittal": {
    name: "scan-review-submittal",
    description: "Low-text scan should force review and avoid hallucinated package completeness.",
    hard: {
      status: "needs_human_review",
      fields: {
        specSection: { value: "23 73 13" },
        manufacturer: { value: "Acme Air Systems" },
        modelNumber: { value: "AHU-9000" },
      },
      missingDocuments: ["product_data", "shop_drawing", "warranty", "o_and_m_manual"],
      deviationCodes: [],
      unresolvedFields: [],
      documentTypes: [
        { documentId: "01-cover", documentType: "submittal_cover" },
      ],
    },
    soft: {
      preferredIssueCodes: [],
      maxSoftFailures: 2,
    },
  },
  "malformed-submittal": {
    name: "malformed-submittal",
    description: "Corrupted PDF should produce review-needed status without losing the good cover facts.",
    hard: {
      status: "needs_human_review",
      fields: {
        specSection: { value: "23 73 13" },
        manufacturer: { value: "Acme Air Systems" },
        modelNumber: { value: "AHU-9000" },
      },
      missingDocuments: ["product_data", "shop_drawing", "warranty", "o_and_m_manual"],
      deviationCodes: [],
      unresolvedFields: [],
      documentTypes: [
        { documentId: "01-cover", documentType: "submittal_cover" },
        { documentId: "02-badfile", documentType: "unknown" },
      ],
    },
    soft: {
      preferredIssueCodes: [],
      maxSoftFailures: 2,
    },
  },
};
