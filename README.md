# personal_portfolio

Source for [dhaivat.dev](https://dhaivat.dev), Dhaivat Patel's portfolio. It is a fully static [Astro](https://astro.build) site hosted on Cloudflare Pages.

The full plan lives in the spec, issue [#18](https://github.com/Dhaivat717/personal_portfolio/issues/18). Domain terms (Home page, Section, Personal project, Deep dive, Work highlight, Featured project, Visitor) are defined in [`GLOSSARY.md`](GLOSSARY.md). This README uses them the same way.

> **Status:** v1 shipped and live at [dhaivat.dev](https://dhaivat.dev) ([#18](https://github.com/Dhaivat717/personal_portfolio/issues/18)).

## How the site works

Astro renders every page to plain HTML at build time. Nothing is server-rendered per request, and pages ship no JavaScript unless a component opts in as a React island.

```
 src/settings.ts ─┐
 src/content/   ──┼──▶  astro build  ──▶  dist/  (HTML, CSS, fonts)  ──▶  Cloudflare Pages
 src/pages/     ──┘        │                                                (CDN + Functions)
                           └─ fails the build on bad content (schema, unique order)
```

- **Who Dhaivat is** (name, role, employer, years of experience, GitHub/LinkedIn, canonical origin, Turnstile site key) lives in one place: [`src/settings.ts`](src/settings.ts). Pages read from it, so changing the role there updates the Home page and its title with no other edits.
- **Theme:** colors are CSS custom properties (tokens) in [`src/styles/global.css`](src/styles/global.css), each written as `light-dark(<light>, <dark>)`. Each theme has one accent: light `#c2410c`, dark `#ff8a3d`. Components use tokens only and never hard-code colors. The theme follows the OS (`prefers-color-scheme`) until the Visitor flips the sliding sun/moon "Dark mode" switch (`src/components/ThemeToggle.astro`). The switch sets `data-theme` on `<html>` and saves the choice in `localStorage`, and a tiny inline script in `Base.astro` applies it before first paint so the page never flashes. Without JS the switch is hidden and the OS setting applies.
- **Fonts:** two self-hosted subset `woff2` files (Inter for text, JetBrains Mono for code), served with `font-display: swap`.
- **Content:** each Personal project is one folder in the `projects` content collection. The folder name is the URL slug. Adding a folder adds a row on `/projects` and a Deep dive at `/projects/<slug>`, with no layout changes. Lowest `order` comes first everywhere. Follow [`docs/adding-a-personal-project.md`](docs/adding-a-personal-project.md) when adding a Personal project. Experience roles and Work highlights live in [`src/content/experience.json`](src/content/experience.json), not hard-coded markup.
- **Personal project frontmatter** is strict: an unknown field fails the build. Fields: `title`, `pitch` (≤ 120 characters), `when` (free text), `stack` (list), `builtOn?` `{ name, author, url }`, `links` `{ code, play?: [{ label, url }] }`, `order` (number, unique across all projects, drafts included), `featured`, `icon` (a [Lucide](https://lucide.dev/icons) name), `media` `{ src, poster?, caption, alt }`, `draft?`.
- **Media** (`src/components/Media.astro`, rules in `src/media.ts`): the summary's main media and any `<Media>` in a Deep dive's body (no import needed) render in a framed figure with a caption. Images sit next to the MDX (`hero.png`, or `import shot from "./approach-shot.png"` in the body) so Astro optimizes them. Clips live in `public/<slug>/` (`hero.mp4`, plus `hero.webm` if present) and need a poster image next to the MDX (`hero-poster.jpg`). Other names are `<section>-<what>.<ext>`. A clip is muted and looping: only the poster loads up front, the clip downloads when scrolled near, plays in view, pauses out of view and always has a pause/play button. Under reduced motion it stays on the poster until the Visitor presses play; without JS the poster shows. The build fails on a missing media file, a clip over 4 MB, a source image over 1 MB (decimal MB), a missing alt or caption, or a clip with no poster.
- **Drafts** (`draft: true`) render in local dev and on preview deploys. With `SITE_ENV=production` or `SHOW_DRAFTS=false` they are absent entirely: no page and no row.
- **Dynamic bits**: two Cloudflare Pages Functions, `/api/contact` (contact form with Turnstile and Resend) and `/api/github-stats` (12-month GitHub contributions count from GitHub's GraphQL API, cached for 1 hour at the edge; the Home page swaps the live count into the hero stat box after load and leaves the baked number in place on any failure). Everything else stays static.

## How the code flows

A request for `/` is served straight from `dist/index.html`. At build time, that file was produced like this:

1. **`astro.config.mjs`** sets static output, `trailingSlash: 'never'`, the site origin (from `settings.ts`), and the MDX and React integrations.
2. **`src/content.config.ts`** registers the `projects` collection and its strict schema. Its glob loader reads `src/content/projects/*/index.{md,mdx}`, or the folder in `PROJECTS_DIR` when the build tests point it at fixtures. After each load it checks every project's media files (see Media above); `PUBLIC_DIR` likewise points the public folder at a fixture's. Pages read projects only through **`src/projects.ts`** (`getProjects()`), which drops drafts when they are off, sorts by `order` and fails the build on a duplicate `order`.
3. **`src/pages/*.astro`**: each file is a route. A page imports `settings.ts` for its data and wraps its content in the base layout.
4. **`src/layouts/Base.astro`** renders the HTML shell for every page:
   - `<html lang="en">`, title, description and an optional `noindex`
   - the font preload and the global stylesheet
   - an inline pre-paint script that adds `js` to `<html>` (so the phone menu collapses without a flash) and applies a saved theme
   - **"Skip to content"** as the first focusable element, then the nav, then `<main id="main">`, then the footer
5. **`src/components/Nav.astro`** renders the sticky nav: name (links Home) · Experience · Projects ▾ · Contact · Résumé · Dark mode switch. Section links always point to Home anchors (`/#experience`). It is clear at the top and turns frosted glass once scrolled. **Projects ▾** is a button (`aria-expanded`) that opens on click, Enter or Space (and on hover on desktop). It lists Personal projects from `getProjects()`, each linking to its Deep dive,, lowest `order` first and capped at 8, marks the current one with `aria-current="page"`, and always ends with "All projects →". Esc closes it and returns focus to the button. At phone width (with JS) the links and Résumé collapse into a menu button, with projects as an expandable list inside it; the switch stays in the bar. Without JS every link stays in the bar (on a second row on phones), and Projects is a plain link to `/projects`.
6. **`src/components/Footer.astro`** renders the GitHub/LinkedIn icon links and the current year (at build time). No email address appears anywhere on the site.
6. Astro writes `dist/`. The `404.astro` page becomes `dist/404.html`, which Cloudflare Pages serves with status **404** for any unknown path.

## Major files and folders

| Path | What it is |
| --- | --- |
| `src/settings.ts` | **Site settings module:** the one source for name, role, employer, years of experience, baked GitHub contributions count, links, origin, Turnstile site key. |
| `src/pages/` | Routes. `index.astro` is the Home page (hero plus `#experience`, `#projects`, `#contact` Section anchors); `404.astro` is the noindexed Not Found page; `projects/index.astro` lists every Personal project; `projects/[slug].astro` is a Deep dive (summary with main media, table of contents, body, previous/next); `og/[...page].png.ts` renders 1200×630 dark-theme social preview cards at build time (checked by `src/socialCardCheck.ts`). |
| `src/layouts/Base.astro` | Shared page shell: lang, meta, skip link, nav, `<main>`, footer. |
| `src/components/` | Reusable Astro components (`Hero.astro`, `Nav.astro`, `ThemeToggle.astro`, `Footer.astro`, `ProjectRow.astro`, `Icon.astro`, `Media.astro`, `ContactForm.astro`). React islands go here too, only where interactivity is needed. |
| `functions/api/` | Cloudflare Pages Functions: `contact.ts` (`POST /api/contact`) and `github-stats.ts` (`GET /api/github-stats`). |
| `src/styles/global.css` | `@font-face`, the light/dark **color tokens**, base styles, the `:focus-visible` ring (2px solid accent, 2px offset), layout widths. |
| `src/content.config.ts` | Content collections. `projects` loads one folder per Personal project, with a strict schema and media checks (`src/media.ts`); `experience` loads `src/content/experience.json`. |
| `src/projects.ts` | **Projects module:** `getProjects()` and `getFeaturedProjects()`, the one way pages read Personal projects (drafts, ordering, unique `order`, featured cap of 3). |
| `src/icons.ts` | The shared icon set (Lucide, via `@iconify-json/lucide`): name check and SVG markup. |
| `src/content/projects/` | Personal project folders: `<slug>/index.mdx` plus images next to it. |
| `public/` | Files copied as-is into `dist/` (fonts, `resume.pdf`, `_headers`, and project clips under `public/<slug>/`). |
| `tests/build/` | **Seam 1:** runs the real production build against fixture content in `tests/build/fixtures/<name>/` (optionally with `SITE_ENV`/`SHOW_DRAFTS` overrides) and checks the exit status, the output and the built pages. A fixture's clips go in `tests/build/fixtures/<name>/public/<slug>/`. |
| `tests/site/` | **Seam 2:** Playwright and plain HTTP tests against `dist/` served by `wrangler pages dev`, Cloudflare's local runtime. |
| `.github/workflows/ci.yml` | The CI workflow that runs on every PR. |
| `prototype/visual-design/` | Throwaway visual reference (variant D is the chosen design). Not part of the build. |
| `GLOSSARY.md`, `docs/` | Domain vocabulary, the ["Adding a Personal project"](docs/adding-a-personal-project.md) checklist, and the agent workflow docs (`docs/agents/`). |

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

For local Pages Functions (`npm run serve`), create a gitignored `.dev.vars` at the repo root:

```ini
# Fine-grained personal access token (public repositories read-only) for GET /api/github-stats
GITHUB_TOKEN=github_pat_...

# Contact form secrets for POST /api/contact
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
RESEND_API_KEY=re_...
CONTACT_TO=you@example.com
```

## Test

```sh
npx playwright install chromium   # once
npm run build && npm test         # Seam 1, then Seam 2
```

Tests check only what a Visitor or the owner can observe: HTTP status, rendered pages, and whether the build passes and what it prints. They never check component internals.

- `npm run test:unit` (fast unit checks, vitest): runs `tests/unit/` (`token-contrast`, `no-em-dashes`, `budgets`, `routes`) in about a second without running fixture builds.
- `npm run test:build` (Seam 1 + unit, vitest): each build test builds the site into a temp folder with `PROJECTS_DIR` pointing at a fixture, then checks the exit status, the message and, where relevant, the built pages (e.g. that a draft is absent). Add one passing and one failing fixture per content rule. The media size-cap tests write their large files just before building (they're gitignored), so the repo never holds multi-megabyte fixtures.
- `npm run test:site` (Seam 2, Playwright): starts `wrangler pages dev dist` and checks routes, structure, keyboard behavior, both themes, clip behavior (lazy loading, pause/play, reduced motion, no JS) and the Deep dive JS and first-load budgets. **Build first.** This seam tests whatever is in `dist/`.

## Deployment

The site deploys through **Cloudflare Pages' built-in Git integration**. GitHub Actions only checks; it never deploys.

```
 feature branch ──push──▶ PR ──▶ GitHub Actions: build + site tests (required checks)
                            └──▶ Cloudflare Pages: preview deploy at <branch>.<project>.pages.dev
 merge to main (squash) ─────▶ Cloudflare Pages: production build ──▶ https://dhaivat.dev
```

- **CI** (`.github/workflows/ci.yml`) runs on every PR and push to `main`, building as production (`SHOW_DRAFTS=false`, no secrets; `SITE_ENV` stays unset so analytics stay off):
  - `build`: `npm ci`, then the typecheck, the production build and Seam 1. It uploads `dist/`.
  - `contrast`: token-contrast checks across both themes.
  - `site`: downloads `dist/`, then runs Seam 2 against `wrangler pages dev`.
  - `axe`: axe-core accessibility audit across every page, both themes, mobile and desktop.
  - `budgets`: compressed JS and first-load transfer budgets.
  - `lighthouse`: Lighthouse CI on Home, `/projects` and a Deep dive.
- **Previews:** every branch and PR gets its own Pages deploy, linked on the PR. Drafts show there, and Cloudflare adds `X-Robots-Tag: noindex` automatically.
- **Production:** merging to `main` triggers the production deploy. `SITE_ENV=production` is set only in the Pages Production environment. It hides drafts, turns on analytics and drops the `[preview]` contact-subject prefix.
- **Protection:** a ruleset on `main` requires a PR and the required CI checks with an up-to-date branch. It allows squash merges only, with no bypass.
- **Config and secrets**: `GITHUB_TOKEN`, `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` are Pages secrets. `CONTACT_TO` and `SITE_ENV` are Pages variables. Local dev uses a gitignored `.dev.vars` (see Develop above).
- **Domains:** `dhaivat.dev` is the canonical domain, and `www` 301-redirects to it. HTTPS is enforced, with HSTS.

The one-time Cloudflare setup (Pages project, variables, domains, analytics, Email Routing, Turnstile, Search Console, ruleset) is the manual **launch checklist** in [#18](https://github.com/Dhaivat717/personal_portfolio/issues/18).
