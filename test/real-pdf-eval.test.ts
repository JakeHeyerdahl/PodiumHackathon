import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { runRealPdfEvaluation } from "../src/backend/evals/runRealPdfEvaluation";
import { MockLlmProvider } from "../src/backend/providers";

test("real PDF eval compares perfect.pdf against requirement-1.pdf with package-aware outputs", async () => {
  const llmProvider = new MockLlmProvider({
    objectHandler: ({ schemaName }) => {
      if (schemaName === "parser_review") {
        return {
          packageMetadata: {
            projectName: {
              value: "Greenfield Office Complex",
              confidence: "high",
              sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
            },
            projectNumber: {
              value: "GOC-2026-001",
              confidence: "high",
              sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
            },
            submittalNumber: {
              value: "SUB-045",
              confidence: "high",
              sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
            },
            requirementReference: {
              value: "SUB-REQ-001",
              confidence: "high",
              sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
            },
            complianceStatement: {
              value: "All materials fully meet or exceed every parameter in Requirement Document SUB-REQ-001.",
              confidence: "high",
              sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
            },
          },
          items: [
            {
              itemId: "cmu",
              label: {
                value: "Concrete Masonry Units (CMU)",
                confidence: "high",
                sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
              },
              productType: {
                value: "Concrete Masonry Units (CMU)",
                confidence: "high",
                sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
              },
              specSection: {
                value: "04 21 00",
                confidence: "high",
                sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
              },
              manufacturer: {
                value: "Acme Block Co.",
                confidence: "high",
                sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
              },
              modelNumber: {
                value: "Standard CMU, 8x8x16",
                confidence: "medium",
                sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
              },
              attributes: [
                {
                  name: "compressiveStrength",
                  value: "1900 psi",
                  confidence: "high",
                  sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
                },
              ],
              requiredDocuments: ["Manufacturer product data sheets"],
              supportingDocuments: [
                "Manufacturer product data sheets",
                "Factory certifications / test reports",
              ],
              confidence: "high",
              sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
            },
          ],
          specSection: {
            value: "04 21 00",
            confidence: "high",
            sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
          },
          productType: {
            value: "Concrete Masonry Units (CMU)",
            confidence: "high",
            sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
          },
          manufacturer: {
            value: "Acme Block Co.",
            confidence: "high",
            sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
          },
          modelNumber: {
            value: "Standard CMU, 8x8x16",
            confidence: "medium",
            sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
          },
          revision: {
            value: "1",
            confidence: "high",
            sources: [{ documentId: "submittal-01", fileName: "perfect.pdf" }],
          },
          extractedAttributes: [],
          missingDocuments: [],
          requiredDocuments: ["Manufacturer product data sheets"],
          supportingDocuments: [
            "Manufacturer product data sheets",
            "Factory certifications / test reports",
          ],
          deviations: [],
          issues: [],
          documentAnalyses: [
            {
              documentId: "submittal-01",
              documentType: "product_data",
              summary: "Masonry package with explicit compliance language.",
              confidence: "high",
            },
          ],
          overallStatus: "parsed",
        };
      }

      if (schemaName === "requirement_document_review") {
        return {
          metadata: {
            projectName: "Greenfield Office Complex",
            projectNumber: "GOC-2026-001",
            requirementDocumentId: "SUB-REQ-001",
            specSection: "04 21 00",
            confidence: "high",
            sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
          },
          items: [
            {
              itemId: "cmu",
              label: "Concrete Masonry Units (CMU)",
              productType: "Concrete Masonry Units (CMU)",
              specSection: "04 21 00",
              manufacturerRequirement: "Acme Block Co.",
              modelNumberRequirement: "Standard CMU, 8x8x16",
              attributes: [
                {
                  key: "compressive_strength",
                  label: "Compressive Strength",
                  expectedValue: "1900 psi",
                  allowedValues: [],
                  required: true,
                  sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
                },
              ],
              requiredDocuments: [
                {
                  key: "product_data",
                  label: "Manufacturer product data sheets",
                  required: true,
                  sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
                },
              ],
              sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
            },
          ],
          requiredDocuments: [
            {
              key: "test_reports",
              label: "Factory certifications / test reports",
              required: true,
              sources: [{ documentId: "requirement-01", fileName: "requirement-1.pdf" }],
            },
          ],
          deviationPolicy: {
            substitutionsRequireApproval: true,
            deviationsRequireApproval: true,
            summary: "Any substitution or deviation must be submitted for approval.",
          },
          assumptions: [],
        };
      }

      if (schemaName === "comparison_result") {
        return {
          status: "compliant",
          matches: [
            {
              field: "item:cmu.manufacturer",
              expected: "Acme Block Co.",
              actual: "Acme Block Co.",
            },
          ],
          mismatches: [],
          unclearItems: [],
          summary: {
            matchCount: 1,
            mismatchCount: 0,
            unclearCount: 0,
          },
        };
      }

      throw new Error(`Unexpected schema: ${schemaName}`);
    },
  });

  const result = await runRealPdfEvaluation({
    submittalFiles: [path.resolve(process.cwd(), "test-pdfs/perfect.pdf")],
    requirementFile: path.resolve(process.cwd(), "test-pdfs/requirement-1.pdf"),
    llmProvider,
  });

  assert.equal(result.parsedRequirementDocument.metadata.requirementDocumentId, "SUB-REQ-001");
  assert.equal(result.requirementSet.requiredItems?.[0]?.label, "Concrete Masonry Units (CMU)");
  assert.equal(result.comparisonResult.status, "compliant");
});
