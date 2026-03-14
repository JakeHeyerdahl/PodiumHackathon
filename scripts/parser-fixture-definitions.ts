export type FixtureDocumentDefinition = {
  fileName: string;
  lines?: string[];
  rawText?: string;
  invalidPdf?: boolean;
};

export type ParserFixtureDefinition = {
  name:
    | "good-submittal"
    | "missing-doc-submittal"
    | "deviation-submittal"
    | "conflict-submittal"
    | "scan-review-submittal"
    | "malformed-submittal";
  documents: FixtureDocumentDefinition[];
};

export const parserFixtureDefinitions: ParserFixtureDefinition[] = [
  {
    name: "good-submittal",
    documents: [
      {
        fileName: "01-submittal-cover.pdf",
        lines: [
          "Submittal Cover",
          "Submittal Register for RTU Replacement Package",
          "Specification Section 23 73 13",
          "Product Type: Packaged Indoor Air Handling Unit",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Revision: B",
          "Included Documents: Product Data, Shop Drawing, Warranty, Operation and Maintenance Manual",
        ],
      },
      {
        fileName: "02-product-data.pdf",
        lines: [
          "Product Data",
          "Specification Section 23 73 13",
          "Product Type: Packaged Indoor Air Handling Unit",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Revision: B",
          "Airflow: 12,500 CFM",
          "Voltage: 480 V/3PH",
          "Motor: Premium efficiency fan wall assembly",
          "Filter Rating: MERV 13",
        ],
      },
      {
        fileName: "03-shop-drawing.pdf",
        lines: [
          "Shop Drawing",
          "Arrangement Drawing",
          "Specification Section 23 73 13",
          "Unit Model: AHU-9000",
          "Rev: B",
          "Finish: Powder coat gray",
        ],
      },
      {
        fileName: "04-warranty.pdf",
        lines: [
          "Manufacturer Warranty",
          "Warranty period: 18 months from shipment",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
        ],
      },
      {
        fileName: "05-operations-manual.pdf",
        lines: [
          "Operation and Maintenance Manual",
          "Packaged Indoor Air Handling Unit",
          "Routine filter replacement and fan maintenance instructions",
        ],
      },
    ],
  },
  {
    name: "missing-doc-submittal",
    documents: [
      {
        fileName: "01-submittal-cover.pdf",
        lines: [
          "Submittal Cover",
          "Specification Section 23 73 13",
          "Product Type: Packaged Indoor Air Handling Unit",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Revision: B",
          "Included Documents: Product Data, Shop Drawing, Warranty, Operation and Maintenance Manual",
        ],
      },
      {
        fileName: "02-product-data.pdf",
        lines: [
          "Product Data",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Airflow: 12,500 CFM",
          "Voltage: 480 V/3PH",
        ],
      },
      {
        fileName: "03-shop-drawing.pdf",
        lines: ["Shop Drawing", "Unit Model: AHU-9000", "Rev: B"],
      },
      {
        fileName: "04-operations-manual.pdf",
        lines: ["Operation and Maintenance Manual", "Scheduled maintenance instructions"],
      },
    ],
  },
  {
    name: "deviation-submittal",
    documents: [
      {
        fileName: "01-submittal-cover.pdf",
        lines: [
          "Submittal Cover",
          "Specification Section 23 73 13",
          "Product Type: Packaged Indoor Air Handling Unit",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Revision: B",
        ],
      },
      {
        fileName: "02-product-data.pdf",
        lines: [
          "Product Data",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Airflow: 12,500 CFM",
        ],
      },
      {
        fileName: "03-deviation-letter.pdf",
        lines: [
          "Deviation Request",
          "This package includes a substitution request for equivalent filter media.",
          "Exception to specification requested for filter arrangement.",
        ],
      },
    ],
  },
  {
    name: "conflict-submittal",
    documents: [
      {
        fileName: "01-submittal-cover.pdf",
        lines: [
          "Submittal Cover",
          "Specification Section 23 73 13",
          "Product Type: Packaged Indoor Air Handling Unit",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Revision: B",
        ],
      },
      {
        fileName: "02-product-data.pdf",
        lines: [
          "Product Data",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Revision: B",
          "Voltage: 480 V/3PH",
        ],
      },
      {
        fileName: "03-shop-drawing.pdf",
        lines: [
          "Shop Drawing",
          "Unit Model: AHU-9010",
          "Rev: C",
          "Finish: Powder coat gray",
        ],
      },
    ],
  },
  {
    name: "scan-review-submittal",
    documents: [
      {
        fileName: "01-submittal-cover.pdf",
        lines: [
          "Submittal Cover",
          "Specification Section 23 73 13",
          "Product Type: Packaged Indoor Air Handling Unit",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Revision: B",
        ],
      },
      {
        fileName: "02-low-text-scan.pdf",
        lines: ["scan only"],
      },
    ],
  },
  {
    name: "malformed-submittal",
    documents: [
      {
        fileName: "01-submittal-cover.pdf",
        lines: [
          "Submittal Cover",
          "Specification Section 23 73 13",
          "Product Type: Packaged Indoor Air Handling Unit",
          "Manufacturer: Acme Air Systems",
          "Model Number: AHU-9000",
          "Revision: B",
        ],
      },
      {
        fileName: "02-corrupted.pdf",
        rawText: "This is not a valid PDF and should trigger a parser failure.",
        invalidPdf: true,
      },
    ],
  },
];
