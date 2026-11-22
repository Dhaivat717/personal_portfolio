# Adding a Personal project

This checklist is the single workflow both the owner and agents follow to add a **Personal project** and its **Deep dive**. Terms used here (**Home page**, **Section**, **Personal project**, **Deep dive**, **Featured project**, **Visitor**) follow [`GLOSSARY.md`](../GLOSSARY.md).

## Workflow checklist

1. **Create the folder** at `src/content/projects/<slug>/` with an `index.mdx` file.
2. **Write the frontmatter** using the strict schema below (start with `draft: true` while iterating).
3. **Add media**: images next to `index.mdx`, clips in `public/<slug>/` with posters next to `index.mdx`.
4. **Claude drafts copy and diagrams**: write the five-section Deep dive body and `architecture.astro` using the diagram kit.
5. **Owner edits**: review and revise all drafted copy, verify technical claims and metrics, and adjust diagrams or media.
6. **Set `order` and `featured`**: pick the project's `order` (new projects take `980`, `960`, …), decide whether it is a **Featured project** (max 3 total), and remove `draft: true` when ready to publish.
7. **Verify locally**: run `npm run check && npm run build && npm test`.
8. **Open a PR**: push the branch, confirm all CI checks pass, review the Cloudflare Pages preview deploy (drafts render on previews), and squash-merge to `main` to publish.

---

## 1. Folder and media naming

Each Personal project lives in its own folder under `src/content/projects/`. The folder name is the URL slug (`/projects/<slug>`).

- **Slug**: short, lowercase `kebab-case` (e.g., `whatsapp-auto-wish-bot`). Never rename a slug after publishing.
- **Entry file**: `src/content/projects/<slug>/index.mdx` (use `.mdx` so you can import diagrams and images and use `<Media>`).
- **Diagrams**: `architecture.astro` (and optional `approach-<what>.astro`) next to `index.mdx`.
- **Images**: sit next to `index.mdx` so Astro optimizes them at build time:
  - Main image (when not using a clip): `hero.png` / `hero.jpg` / `hero.webp`
  - Clip poster (required for every clip): `hero-poster.jpg` or `<section>-<what>-poster.jpg`
  - Body images: `<section>-<what>.<ext>` (e.g., `approach-query-plan.png`, `results-latency.webp`), lowercase `kebab-case`
- **Clips**: live in `public/<slug>/`:
  - Main clip: `public/<slug>/hero.mp4` (plus an optional `public/<slug>/hero.webm` sibling; `<Media>` auto-discovers the sibling and serves WebM first)
  - Body clips: `public/<slug>/<section>-<what>.mp4` (and optional `.webm`)

```text
src/content/projects/<slug>/
  index.mdx
  architecture.astro
  hero-poster.jpg             # or hero.png if the main media is an image
  approach-diagram-shot.png   # optional body images
  results-demo-poster.jpg     # poster for a body clip

public/<slug>/
  hero.mp4                    # optional hero.webm sibling
  results-demo.mp4            # optional results-demo.webm sibling
```

---

## 2. Frontmatter schema

The schema in `src/content.config.ts` is **strict**: any unknown field or missing required field fails the build. There is no `role` field and no read-time field.

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `title` | `string` | Yes | Non-empty project title. |
| `pitch` | `string` | Yes | Non-empty, **≤ 120 characters**. Used in the Deep dive summary, project rows, meta description, and social preview card. |
| `when` | `string` | Yes | Non-empty free text (e.g., `"2025"`, `"Fall 2024"`). |
| `stack` | `string[]` | Yes | Array of non-empty tech names. First 3 appear on the social preview card. |
| `builtOn` | `{ name, author, url }` | No | Only when extending upstream work. Renders in the Deep dive meta strip. |
| `links.code` | URL string | Yes | Valid repository URL. Renders as `Code ↗`. |
| `links.play` | `{ label, url }[]` | No | Optional playable/live demo links. Give each entry a distinct `label` (e.g., `"Play on itch.io"`). Link Unity WebGL demos out; never embed them. |
| `order` | `number` | Yes | **Unique across all Personal projects (drafts included).** Lowest appears first everywhere. |
| `featured` | `boolean` | Yes | Shows the project in the Home page Projects Section band. **At most 3 projects can have `featured: true` (drafts included).** |
| `icon` | `string` | Yes | Valid [Lucide](https://lucide.dev/icons) icon name (e.g., `cake`, `database`, `cpu`). |
| `media.src` | clip name or image | Yes | Clip filename in `public/<slug>/` (`hero.mp4`) or relative image next to `index.mdx` (`./hero.png`). |
| `media.poster` | image | If clip | Required when `media.src` is a clip; relative image next to `index.mdx` (`./hero-poster.jpg`). |
| `media.caption` | `string` | Yes | Non-empty figure caption. |
| `media.alt` | `string` | Yes | Non-empty accessible description. |
| `draft` | `boolean` | No | Set `true` to hide from production while previewing on PRs and locally. |

### Starter `index.mdx`

```mdx
---
title: My Personal Project
pitch: "One concise sentence describing what it does and why it matters (at most 120 characters)."
when: "2026"
stack: [TypeScript, Node.js]
links:
  code: https://github.com/Dhaivat717/my-personal-project
order: 980
featured: false
icon: cpu
media:
  src: ./hero.png
  caption: "What the main screenshot or clip shows."
  alt: "Accessible description of the main screenshot or clip."
draft: true
---

import Architecture from "./architecture.astro";

## Problem

...

## Architecture

<Architecture />

Walk through the diagram in prose so a Visitor reading without the visual gets the full picture.

## Approach

### First design decision

...

## Results

...

## What I learned

...
```

---

## 3. Deep dive structure and writing rules

### The `h2` spine (enforced at build time)

The Deep dive summary (title, pitch, meta strip, and main media) renders automatically above the body with no heading and is not in the table of contents.

Below the summary, the MDX body must contain **exact `h2` (`##`) headings in this exact order** (checked by `src/deepDive.ts`):

1. `## Problem`
2. `## Architecture`
3. `## Approach`
4. `## Results`
5. `## What I learned`

- Do not add, remove, rename, or reorder `h2` headings—the build will fail.
- Use `h3` (`###`) headings for subsections (especially inside `## Approach`).
- Keep code excerpts short (~20 lines or fewer); they render in dark code blocks in both themes.

### Word count target (800–1,500 words)

Aim for **800–1,500 words** in the MDX body (prose and code excerpts; imports, exports, and JSX tags are excluded). The build prints a warning when a Deep dive falls outside 800–1,500 words without failing the build.

### "I" means Dhaivat's own work only

- Never add a role line.
- First-person **"I"** refers **strictly to work Dhaivat personally designed, wrote, or built**.
- For group projects or projects built on upstream code, state clearly what came from teammates or upstream (and set `builtOn` in frontmatter for upstream repos) rather than attributing it to "I".
- Report only real, verified metrics. Never include private user data or real chat screenshots—use simulated runs with made-up names when demonstrating interactive tools.

---

## 4. Building an architecture diagram from the kit

Every Deep dive's `## Architecture` section must open with a diagram built from `src/components/diagram`, followed by a prose walk-through. The build fails if `## Architecture` has no diagram (`src/architectureCheck.ts`).

- **No external diagram tools**: do not use Mermaid, D2, or exported PNG/SVG files.
- **No hard-coded colors**: the kit renders inline SVG styled exclusively with CSS theme tokens, so diagrams follow light and dark mode with zero JavaScript.
- **Full fidelity**: include edge-case branches (dropped requests, retries, fallbacks) with `branch` arrows.
- **Accessibility**: `<Diagram>` requires a one-sentence `title` (its `aria-label` on `<svg role="img">`). The prose walk-through right after `<Architecture />` is its full text alternative.

### Kit components (`src/components/diagram`)

Import pieces from `../../../components/diagram` inside `architecture.astro`:

- **`<Diagram title width height caption?>`**: root `<figure data-diagram>` and `<svg viewBox="0 0 width height">`. `title` is required.
- **`<Box x y width height?=52 label detail? step? tone?>`**: rounded box with a main label, optional monospace `detail` line, and optional `step` prefix (e.g., `"01"`).
- **`<Arrow points tone? branch? label? labelAt?>`**: polyline through `[[x0, y0], [x1, y1], ...]` ending in an arrowhead. Set `branch` for dashed edge-case paths.
- **`<Group x y width height label? detail? center? tone?>`**: dashed boundary around related parts or a sink box (`center`). Draw `<Group>` *before* the elements it encloses so they sit on top.
- **`<Label x y anchor? detail? tone?>`**: free text (`anchor`: `"start" | "middle" | "end"`; `detail` for monospace).

### Tones

- `default`: a normal part of the system.
- `accent`: the part that matters most, or Dhaivat's own additions.
- `upstream`: someone else's work the project builds on (muted, dashed).

### Example `architecture.astro`

```astro
---
import { Arrow, Box, Diagram, Group } from "../../../components/diagram";
---

<Diagram
  title="Request flow: incoming requests are validated, processed by the core engine, and written to storage; invalid requests are rejected."
  width={680}
  height={240}
  caption="Validation drops malformed input before it reaches the core engine."
>
  <Group x={480} y={24} width={176} height={80} label="Rejected" detail="400 response" center />
  <Box x={24} y={24} width={300} step="01" label="Validate input" detail="schema check" />
  <Box x={24} y={112} width={300} step="02" label="Core engine" detail="transforms payload" tone="accent" />
  <Box x={24} y={180} width={300} label="Storage" detail="persists result" />
  <Arrow points={[[174, 76], [174, 112]]} />
  <Arrow points={[[174, 164], [174, 180]]} />
  <Arrow points={[[324, 50], [480, 50]]} label="invalid" branch />
</Diagram>
```

---

## 5. Media component and size limits

`<Media>` is provided automatically inside Deep dive MDX—do not import it.

### Using `<Media>` in the MDX body

- **Image** (must be imported from next to `index.mdx`; never pass an image path as a string):

  ```mdx
  import queryPlan from "./approach-query-plan.png";

  <Media
    src={queryPlan}
    alt="Query planner routing a join across MySQL and MongoDB."
    caption="The planner splits the query into per-source subqueries."
  />
  ```

- **Clip** (pass the filename in `public/<slug>/` as a string, plus an imported `poster` from next to `index.mdx`):

  ```mdx
  import demoPoster from "./results-demo-poster.jpg";

  <Media
    src="results-demo.mp4"
    poster={demoPoster}
    alt="Simulated run showing the bot sending a birthday wish."
    caption="Simulated chat run with made-up names."
  />
  ```

### Enforced media limits

| Rule | Limit / requirement |
| --- | --- |
| Source image size (`src/content/projects/<slug>/*`) | **≤ 1 MB** (1,000,000 bytes, decimal MB) |
| Clip file size (`public/<slug>/*.{mp4,webm}`) | **≤ 4 MB** (4,000,000 bytes, decimal MB) per file |
| Clip poster | Required for every clip (both frontmatter and body) |
| `alt` and `caption` | Required and non-empty on every `<Media>` and frontmatter `media` |
| Deep dive page budgets (`budgets.json`) | Compressed JS **≤ 15 KB**, compressed first load **≤ 800 KB** (excluding lazy-loaded clips) |

Clips are muted, looping, and lazy-loaded (only the poster loads up front; the clip downloads when scrolled near, plays in view, pauses out of view, and includes a pause/play button). Under reduced motion, clips stay on the poster until the Visitor presses play; without JS, the poster renders.

---

## 6. Ordering, Featured projects, and drafts

### `order` convention

- **Lowest `order` appears first everywhere**: Home page Projects Section band, `/projects`, the Nav Projects drop-down (capped at 8), and Deep dive Previous/Next cards.
- Launch Personal projects use `1000`, `1020`, `1040`, and `1060` (spaced by 20).
- **New Personal projects take `980`, `960`, `940`, …** so newer work appears first without renumbering older projects.
- Every project's `order` must be unique across all projects, including drafts.

### Featured projects

- Set `featured: true` to show a Personal project on the Home page as well as `/projects`.
- **At most 3** Personal projects can be featured at once (drafts included). To feature a new project when 3 are already featured, set `featured: false` on one of the existing Featured projects.

### Drafts

- Set `draft: true` in frontmatter while writing and reviewing.
- **Local dev & PR previews**: drafts render normally (Deep dive page, `/projects`, Nav drop-down, and Home page if featured). Cloudflare automatically adds `X-Robots-Tag: noindex` to preview deploys.
- **Production (`SITE_ENV=production`) and CI (`SHOW_DRAFTS=false`)**: drafts are completely excluded—no page, no row, no sitemap entry, and no social preview card.
- Collection-level checks (schema, `order` uniqueness, `featured` cap, frontmatter media, and body-imported images) still run on drafts even in production builds; page-render checks (`h2` spine, architecture diagram, body `<Media>` clips) run when drafts are rendered locally and on preview deploys.

---

## 7. Social preview cards and verification

Every published Personal project automatically gets a 1200×630 dark-theme PNG social preview card at `/og/projects/<slug>.png` built from its `icon`, `title`, `pitch`, and first 3 `stack` entries (`src/pages/og/[...page].png.ts`). `src/socialCardCheck.ts` verifies it at build time—no extra wiring is needed.

Before opening a PR, run the checks locally:

```sh
npm run check          # TypeScript & Astro typecheck
npm run build          # Production build + all content, diagram, media, and social card checks
npm run test:build     # Seam 1: build-time content check suite
npm run test:site      # Seam 2: Playwright tests (routes, axe, budgets, media, diagrams, SEO)
```

To verify how production will look with drafts hidden:

```sh
SHOW_DRAFTS=false npm run build
```

### What fails the build vs. warns

- **Fails the build**: unknown or missing frontmatter fields; `pitch` > 120 characters; invalid Lucide `icon`; duplicate `order`; > 3 `featured` projects; wrong, extra, missing, or reordered `h2` headings; missing diagram in `## Architecture`; missing media file; clip > 4 MB; source image > 1 MB; clip without a poster; missing `alt` or `caption`; missing or invalid social preview card.
- **Warns only**: Deep dive body outside 800–1,500 words.
