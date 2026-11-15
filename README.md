# personal_portfolio

Source for [dhaivat.dev](https://dhaivat.dev): an Astro static site hosted on Cloudflare Pages.

## Develop

```sh
npm ci
npm run dev          # local dev server
npm run check        # typecheck
npm run build        # production build into dist/
```

Who Dhaivat is (name, role, employer, links) lives in one place: `src/settings.ts`.

## Test

```sh
npx playwright install chromium   # once
npm run build && npm test
```

- `npm run test:build`, **Seam 1:** runs the production build against fixture content in `tests/build/fixtures/` and checks the exit status and message.
- `npm run test:site`, **Seam 2:** Playwright and HTTP tests against `dist/` served by `wrangler pages dev`.

CI (`.github/workflows/ci.yml`) runs both on every PR, building as production (`SITE_ENV=production`, `SHOW_DRAFTS=false`, no secrets).
