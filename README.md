# PodiumHackathon

Minimal Next.js project scaffold for the hackathon.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run intake:fixture <fixture-path> -- --summary`
- `npm run requirements:test`
- `npm run workflow:run <fixture-path>`
- `npm run workflow:test`

## Backend Notes

The backend intake step is intentionally narrow right now:

- validates that the payload includes at least one usable document
- extracts `fullText` from PDF documents
- returns the extracted text without inferring categories, package labels, or submittal metadata

The richer workflow behavior starts after intake:

- parser extracts structured facts from document text
- requirements reconstructs the comparison target
- completeness, comparison, routing, and executive make the downstream workflow decisions

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
