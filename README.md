# CommonPlan Web

The React web client for CommonPlan. It provides the browser UI designed in KEY-3 and talks only to the CommonPlan API/BFF; credentials and refresh tokens are not exposed to browser JavaScript.

## Local development

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

The development server runs at <http://localhost:5173>. Start the companion [`commonplan-api`](https://github.com/LeonQC/commonplan-api) stack first so API and authentication endpoints are available at <http://localhost:8000>.

GitHub pull-request links and integration health are supplied by the API. For local webhook forwarding and repository configuration, use the API repository's `docs/github-integration-local.md` guide.

## Build

```bash
pnpm build
```

## Browser end-to-end checks

The Playwright suite runs against the complete local API/Auth/Web stack. Start the API stack and this Web app first, then install the browser once and run:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Use `pnpm test:e2e:ui` for the interactive runner. CI retains traces, screenshots, and video on failure. The initial fast-feedback project uses Chromium; add Firefox and WebKit once the critical-path suite is stable.

## Design

The latest [KEY-3 UI design PDF](output/pdf/KEY-3-zhitong-ui-design.pdf) is included here, with its [generator](design/generate_ui_pdf.py). This is the 16-page version that includes GitHub pull-request linking.
