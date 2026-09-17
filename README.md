# CommonPlan Web

The React web client for CommonPlan. It provides the browser UI designed in KEY-3 and talks only to the CommonPlan API/BFF; credentials and refresh tokens are not exposed to browser JavaScript.

## Local development

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

The development server runs at <http://localhost:5173>. Start the companion [`commonplan-api`](https://github.com/LeonQC/commonplan-api) stack first so API and authentication endpoints are available at <http://localhost:8000>.

## Build

```bash
pnpm build
```

## Design

The latest [KEY-3 UI design PDF](output/pdf/KEY-3-zhitong-ui-design.pdf) is included here, with its [generator](design/generate_ui_pdf.py). This is the 16-page version that includes GitHub pull-request linking.
