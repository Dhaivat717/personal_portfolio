# personal_portfolio

Source for [dhaivat.dev](https://dhaivat.dev), Dhaivat Patel's portfolio. It is a fully static [Astro](https://astro.build) site hosted on Cloudflare Pages.

The full plan lives in the spec, issue [#18](https://github.com/Dhaivat717/personal_portfolio/issues/18). Domain terms (Home page, Section, Personal project, Deep dive, Work highlight, Featured project, Visitor) are defined in [`GLOSSARY.md`](GLOSSARY.md). This README uses them the same way.

> **Status:** walking skeleton ([#19](https://github.com/Dhaivat717/personal_portfolio/issues/19)). The Home page shows the name, role and employer, with a footer and a 404 page, and builds, tests and CI are in place. Items marked _(planned)_ below come in later tickets.

## How the site works

Astro renders every page to plain HTML at build time. Nothing is server-rendered per request, and pages ship no JavaScript unless a component opts in as a React island.

```
 src/settings.ts ─┐
 src/content/   ──┼──▶  astro build  ──▶  dist/  (HTML, CSS, fonts)  ──▶  Cloudflare Pages
 src/pages/     ──┘        │                                                (CDN + Functions)
                           └─ fails the build on bad content (planned: content checks)
```

- **Who Dhaivat is** (name, role, employer, years of experience, GitHub/LinkedIn, canonical origin, Turnstile site key) lives in one place: [`src/settings.ts`](src/settings.ts). Pages read from it, so changing the role there updates the Home page and its title with no other edits.
- **Theme:** colors are CSS custom properties (tokens) in [`src/styles/global.css`](src/styles/global.css), each written as `light-dark(<light>, <dark>)`. Each theme has one accent: light `#c2410c`, dark `#ff8a3d`. Components use tokens only and never hard-code colors. The theme follows the OS (`prefers-color-scheme`) until the Visitor clicks the sun/moon toggle (`src/components/ThemeToggle.astro`). The toggle sets `data-theme` on `<html>` and saves the choice in `localStorage`, and a tiny inline script in `Base.astro` applies it before first paint so the page never flashes. Without JS the toggle is hidden and the OS setting applies.
- **Fonts:** two self-hosted subset `woff2` files (Inter for text, JetBrains Mono for code), served with `font-display: swap`.
- **Content** _(planned)_: each Personal project is one folder in the `projects` content collection. The folder name is the URL slug. Experience data (Work highlights) is data the pages read, not hard-coded markup.
- **Dynamic bits** _(planned)_: two Cloudflare Pages Functions, `/api/contact` (contact form with Turnstile and `send_email`) and `/api/github-stats` (contributions count). Everything else stays static.

## How the code flows

A request for `/` is served straight from `dist/index.html`. At build time, that file was produced like this:

1. **`astro.config.mjs`** sets static output, `trailingSlash: 'never'`, the site origin (from `settings.ts`), and the MDX and React integrations.
2. **`src/content.config.ts`** registers the `projects` collection. Its glob loader reads `src/content/projects/*/index.{md,mdx}`, or the folder in `PROJECTS_DIR` when the build tests point it at fixtures.
3. **`src/pages/*.astro`**: each file is a route. A page imports `settings.ts` for its data and wraps its content in the base layout.
4. **`src/layouts/Base.astro`** renders the HTML shell for every page:
   - `<html lang="en">`, title, description and an optional `noindex`
   - the font preload and the global stylesheet
   - **"Skip to content"** as the first focusable element, then `<main id="main">`, then the footer
5. **`src/components/Footer.astro`** renders the GitHub/LinkedIn icon links and the current year (at build time). No email address appears anywhere on the site.
6. Astro writes `dist/`. The `404.astro` page becomes `dist/404.html`, which Cloudflare Pages serves with status **404** for any unknown path.

## Major files and folders

| Path | What it is |
| --- | --- |
| `src/settings.ts` | **Site settings module:** the one source for name, role, employer, links, origin, Turnstile site key. |
| `src/pages/` | Routes. `index.astro` is the Home page (hero plus `#experience`, `#projects`, `#contact` Section anchors); `404.astro` is the noindexed Not Found page. _(planned)_ `projects/index.astro`, `projects/[slug].astro`, `og/*.png` social cards. |
| `src/layouts/Base.astro` | Shared page shell: lang, meta, skip link, `<main>`, footer. |
| `src/components/` | Reusable Astro components (`Footer.astro`, `ThemeToggle.astro`). React islands go here too, only where interactivity is needed. |
| `src/styles/global.css` | `@font-face`, the light/dark **color tokens**, base styles, the `:focus-visible` ring (2px solid accent, 2px offset), layout widths. |
| `src/content.config.ts` | Content collections. `projects` loads one folder per Personal project. _(planned)_ strict schema and build-time content checks. |
| `src/content/projects/` | Personal project folders: `<slug>/index.mdx` plus images next to it. Empty for now. |
| `public/` | Files copied as-is into `dist/` (fonts today; _(planned)_ `resume.pdf`, project clips under `public/<slug>/`, `_headers`). |
| `tests/build/` | **Seam 1:** runs the real production build against fixture content in `tests/build/fixtures/<name>/` and checks the exit status and output. |
| `tests/site/` | **Seam 2:** Playwright and plain HTTP tests against `dist/` served by `wrangler pages dev`, Cloudflare's local runtime. |
| `.github/workflows/ci.yml` | The CI workflow that runs on every PR. |
| `prototype/visual-design/` | Throwaway visual reference (variant D is the chosen design). Not part of the build. |
| `GLOSSARY.md`, `docs/agents/` | Domain vocabulary and the agent workflow docs (issue tracker, triage labels). |

## Develop

Needs Node 26 (see `.nvmrc`).

```sh
npm ci
npm run dev          # local dev server with hot reload
npm run check        # typecheck (astro check)
npm run build        # production build into dist/
npm run serve        # serve dist/ in Cloudflare's local runtime on :8788
```

To change who the site says Dhaivat is, edit `src/settings.ts`. To change colors, edit the tokens in `src/styles/global.css`. Don't put color values in components.

## Test

```sh
npx playwright install chromium   # once
npm run build && npm test         # Seam 1, then Seam 2
```

Tests check only what a Visitor or the owner can observe: HTTP status, rendered pages, and whether the build passes and what it prints. They never check component internals.

- `npm run test:build` (Seam 1, vitest): each test builds the site into a temp folder with `PROJECTS_DIR` pointing at a fixture, then checks exit status and message. Add one passing and one failing fixture per content rule.
- `npm run test:site` (Seam 2, Playwright): starts `wrangler pages dev dist` and checks routes, structure, keyboard behavior and both themes. **Build first.** This seam tests whatever is in `dist/`.

## Deployment

The site deploys through **Cloudflare Pages' built-in Git integration**. GitHub Actions only checks; it never deploys.

```
 feature branch ──push──▶ PR ──▶ GitHub Actions: build + site tests (required checks)
                            └──▶ Cloudflare Pages: preview deploy at <branch>.<project>.pages.dev
 merge to main (squash) ─────▶ Cloudflare Pages: production build ──▶ https://dhaivat.dev
```

- **CI** (`.github/workflows/ci.yml`) runs on every PR and push to `main`, building as production (`SHOW_DRAFTS=false`, no secrets; `SITE_ENV` stays unset so analytics stay off):
  - `build`: `npm ci`, then the typecheck, the production build and Seam 1. It uploads `dist/`.
  - `site`: downloads that `dist/`, then runs Seam 2 against `wrangler pages dev`.
  - _(planned)_ axe-core, Lighthouse CI, size budgets and the token-contrast test, each as its own required status.
- **Previews:** every branch and PR gets its own Pages deploy, linked on the PR. Drafts show there, and Cloudflare adds `X-Robots-Tag: noindex` automatically.
- **Production:** merging to `main` triggers the production deploy. `SITE_ENV=production` is set only in the Pages Production environment. It hides drafts, turns on analytics and drops the `[preview]` contact-subject prefix.
- **Protection** _(planned)_: a ruleset on `main` requires a PR and the CI checks with an up-to-date branch. It allows squash merges only, with no bypass.
- **Config and secrets** _(planned)_: `GITHUB_TOKEN` and the Turnstile secret are Pages secrets. `CONTACT_TO` and `SITE_ENV` are Pages variables. `wrangler.toml` holds the `send_email` binding. Local dev uses a gitignored `.dev.vars`.
- **Domains:** `dhaivat.dev` is the canonical domain, and `www` 301-redirects to it. HTTPS is enforced, with HSTS.

The one-time Cloudflare setup (Pages project, variables, domains, analytics, Email Routing, Turnstile, Search Console, ruleset) is the manual **launch checklist** in [#18](https://github.com/Dhaivat717/personal_portfolio/issues/18).
