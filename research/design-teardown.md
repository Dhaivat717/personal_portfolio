# Research: Design teardown of the inspiration sites, Apple, and Google

Ticket: #5 (child of map #1). Researched 2026-11-13.

## Question

What concrete design patterns make the inspiration sites work, and which fit a simple, developer-leaning portfolio? Tear down https://sawad.framer.website/, https://prakharpatel.vercel.app/, https://vivek-ghodadra.web.app/, plus apple.com and Google's product and design pages. Cover layout and grid, typography, color and dark mode, motion, navigation, how work is presented, and developer-flavored touches. End with a shortlist of patterns to borrow and patterns to avoid, as input to the visual design prototype (#11).

## How each source was read (and what that means for confidence)

No site here was viewed as a rendered page or screenshot. Each one was read through whatever it ships over HTTP, so visual claims such as exact spacing or how an animation feels are inferences.

| Source | What was readable | Confidence |
|---|---|---|
| sawad.framer.website | Framer pre-renders the HTML, so the copy, section order, font declarations, color tokens, and breakpoints are all in the markup [S1]. | Good for structure and tokens. Weak for motion. |
| prakharpatel.vercel.app | The HTML is an empty `<div id="root">` (Vite + React SPA) [P1]. WebFetch returned only the `<title>`. Everything below comes from the shipped CSS [P2] and JS bundle [P3]: copy strings, data shapes, theme tokens. | Medium. Section order and grid are inferred. |
| vivek-ghodadra.web.app | The SPA shell plus a `<noscript>` fallback [V1]. WebFetch returned only the `<title>`. The details come from the shipped CSS [V2] and JS [V3]. | Medium. Same caveats as above. |
| apple.com/macbook-pro | Rendered text via WebFetch [A1], plus the page's stylesheets [A2][A3]. | Good. |
| m3.material.io | **JS-only: WebFetch returned only the title** [G1]. Material 3 values here come from the canonical design tokens in `material-components/material-web` [G2][G3][G4][G5]. | Good for tokens, nothing on page layout. |
| design.google | Rendered text via WebFetch [G6]. The font comes from the raw HTML [G7]. | Medium. |

## Inspiration site 1: sawad.framer.website

**It's a Framer template demo, not a real person's portfolio.** The hero name is a placeholder ("Aaabad Ahmed"), and the page opens with "Use Template for Free / More Templates / Video Tutorial" links. Its blog excerpts repeat near-identical filler text [S1]. Treat it as a style reference only.

- **Layout:** one long scrolling page. Order: hero (name plus a one-line claim, "A Software Engineer who has developed countless innovative solutions") → role headline "SOFTWARE ENGINEER" → a **stats row** ("+12 years of experience", "+46 projects completed", "+20 worldwide clients") → skills → RECENT PROJECTS → 12 YEARS OF EXPERIENCE → PREMIUM TOOLS → DESIGN THOUGHTS (blog) → LET'S WORK TOGETHER CTA → footer [S1]. Framer breakpoints sit at 810, 1080, and 1440 px [S1].
- **Typography:** Poppins is the main face (about 61 declarations), with Satoshi and Inter as secondary faces. The scale jumps from small body sizes (12, 14, 16, 18 px) straight to display sizes (50, 60, 70 px) with little in between, and section titles are ALL CAPS [S1]. That gap is what makes it feel bold.
- **Color:** dark by default. The tokens include `#151312` (warm near-black), `#fff`, a muted `#998f8f`, and two loud accents: orange `#f46c38` and lime `#c5ff41`. `#faf7f3` (off-white) and `#111` also appear [S1]. No system-following theme switch was evident. The only `prefers-color-scheme` media queries found were on `<link>` tags (likely favicons) [S1].
- **Motion:** 11 `data-framer-appear-id` elements and `will-change: transform` point to Framer's appear-on-load and scroll reveals [S1]. How they look and feel wasn't observable.
- **Navigation:** no header menu in the markup. You just scroll, and the footer holds a couple of links [S1].
- **Work presentation:** projects are thin text links to template pages, with no case studies. Experience is three plain entries with dates [S1].
- **Developer flavor:** none. Next.js and ReactJS appear only as words in a tool list [S1].

## Inspiration site 2: prakharpatel.vercel.app

React + Vite + Tailwind [P1][P2].

- **Layout:** a single page with anchored sections, each led by an eyebrow and a heading pair: "Who I am / About Me", "Where I've worked / Work Experience", "Featured work / Projects", "What I work with / Skills & Expertise", "Few Nice Words / Recommendations", "Recognition & Learning / Awards & Certifications", "Get in touch / Contact Me" [P3]. The hero carries a "Scroll to explore" cue and an "Explore My Work" CTA. Stats use label/value pairs ("7+" Years, Companies, Engineers, Projects) [P3]. Content widths step through Tailwind's 42–72 rem containers [P2].
- **Typography:** the system UI stack (`ui-sans-serif, system-ui, …`) for text and the `ui-monospace, SFMono-Regular, Menlo…` stack for code [P2]. The JS also references Inter [P3].
- **Color and dark mode:** clean, token-driven theming. Light mode has a white background, `rgb(10 10 10)` text, and slate borders. Dark mode uses slate-950 (`rgb(2 6 23)`). The accent is indigo `#6366f1` (`#818cf8` in dark), the secondary is cyan, and success and warning colors are defined [P2]. The theme follows `prefers-color-scheme` until the visitor toggles it, and the choice is saved in `localStorage('theme')` [P3].
- **Motion:** only Tailwind's stock `pulse`, `ping`, `bounce`, and `spin` animations [P2]. No `prefers-reduced-motion` handling was found in the CSS [P2].
- **Work presentation (the strongest part):** each project card has a one-sentence **summary** that states scale, such as "Enterprise call center and franchise management platform powering 5,500+ franchises across North America and Europe". Below it, two **metric-led `cardHighlights`** such as "Supported 5,500+ franchise locations with 99.9%+ uptime via scalable micro-frontend architecture" and "Increased transaction success rates by 18% through Worldpay payment integration…", then tech-stack chips. **"View details"** opens a modal dialog (`role="dialog"`, `aria-modal`, rendered through `createPortal`) with an overview, a context field, and longer highlights [P3]. Experience entries show team size ("Leading a team of …"). A résumé link reads "Résumé / Download PDF" [P3].
- **Developer flavor:** GitHub and LinkedIn are shown as stripped URLs (`github.com/PrakharPatel96`), and the footer says "Built with React · Tailwind · Vite" [P3].

## Inspiration site 3: vivek-ghodadra.web.app

React SPA, Inter, a shadcn-style HSL token system [V1][V2]. This is the most polished of the three and the most Apple-like.

- **Layout:** a single page with anchored sections: home, about, why-hire-me, ai-work, projects, skills, experience, education, contact, plus a "Skip to main content" link [V3]. Reading columns are narrow (`max-width` 620–900 px) [V2].
- **Typography:** Inter is preloaded as a variable woff2 [V1], with `ui-monospace` for code [V2]. Headlines are tracked tight (`letter-spacing: -.06em` / `-.035em`). Eyebrows are spaced uppercase (`.08–.13em`), such as "SELECTED WORK", "HOW I WORK", "GET IN TOUCH" [V2][V3].
- **Apple-style copy:** short declarative titles that end in a period: "Apps I've worked on.", "A little about me.", "Let's talk.", "Ready for launch.", "Made for real life.", "Always in sync." Subtitles echo Apple's taglines: "One product. Two platforms.", "Thoughtful details. Native feel." [V3]
- **Color and dark mode:** neutral grays (light background `hsl(0 0% 98%)`, dark `hsl(0 0% 6%)`, cards at 100% / 10%) with **one** warm accent, `#f3a35f`. The CSS aliases every other named hue (`--blue`, `--violet`, `--mint`, …) to that one accent, so the site is a single-accent palette by design [V1][V2]. Separate `--accent-ink` values (`#9b4d16` in light, the accent itself in dark) keep accent text readable [V2]. Theme switching uses a `.dark` class with a "Toggle color theme" button [V2][V3].
- **Materials:** "glass" surface tokens (`--glass-bg` around 78% white, blur 10–28 px, soft large shadows) on the nav shell, mobile menu, buttons, and the availability badge. A `@supports not (backdrop-filter)` fallback switches them to solid cards [V2]. The radius is `1rem` [V2].
- **Motion:** named keyframes `hero-enter`, `skill-enter`, `phone-content-enter`, `status-pulse`, `caret-blink`, and `cue-drift` [V2]. A WebGL background ("Lightfall", built on the `ogl` library) is lazy-loaded with a dynamic `import()` [V3]. `prefers-reduced-motion` is handled [V2].
- **Work presentation:** "Selected work / Apps I've worked on." shows each app with a 2–3 sentence description, App Store / Google Play / TestFlight / Website links, and a section framing ("A selection of my work in education, logistics, finance, lifestyle, and community apps.") [V3]. The stats include "Years of experience" and "Products showcased" [V3].
- **Developer flavor (the standout):** the hero has an **illustrative code editor that types out a React Native component**, beside an iPhone mockup (clock reads "9:41") that updates on "save". Steps are labeled "01 Edit / 02 Save / 03 Live", the accessible description reads "Simulated Fast Refresh workflow", and a blinking caret completes it [V3][V2]. There are also syntax-highlight color tokens (`--syntax-keyword`, `--syntax-string`) [V2] and a live demo of a "Product listing catalogue" with search, loading, empty, and error states [V3]. The site also ships JSON-LD `Person` structured data and full OG/Twitter cards [V1].

## Apple (apple.com/macbook-pro)

- **Layout grid:** two content widths dominate: **1068 px** for wide modules and **734 px** for text columns. A 480 px breakpoint covers small phones [A2]. The page stacks one product module after another (image → tagline → spec icon grid → CTAs) rather than using a card grid [A1].
- **Typography:** SF Pro Display for headlines and SF Pro Text for body [A2]. Headlines are weight 600 at line-height 1 with slightly negative tracking that tightens as size grows: 48 px at −0.003em, 64 px at −0.009em, 80 px at −0.015em. Body is 17 px / 400 / −0.022em, and captions are 12–14 px [A2]. The scale is large but uses only two weights.
- **Copy:** the title is just "MacBook Pro". Taglines are a single sentence in sentence case that ends with a period: "A powerful laptop for every kind of pro." Feature labels are terse noun phrases ("Tandem OLED", "Mini-LED"). Numbers carry qualifiers ("Up to 24 hours", "1000 nits") [A1].
- **Stats:** label/value pairs with a small icon, with the key figures emphasized. Claims link to numbered footnotes that disclose test conditions [A1].
- **Color:** near-white surfaces (`rgb(250 250 252)`), a dark variant at `rgb(22 22 23)`, gray text (`#424245`, `#d2d2d7`), and **one** link and action blue, `#0071e3` [A2][A3]. Buttons are pills (`border-radius: 980px`) [A2].
- **Navigation:** a global nav on top, then a **sticky local nav** that becomes translucent on scroll (`rgba(250,250,252,0.8)` with `backdrop-filter: saturate(180%) blur(20px)`) and has a dark-theme equivalent [A3]. A breadcrumb sits at the foot of the page [A1].
- **CTAs:** a quiet text link ("Learn more") next to one primary pill ("Buy"), repeated for each module [A1].

## Google (Material 3 and design.google)

- **Type scale (M3 tokens) [G2]:** display 57/64, 45/52, 36/44. Headline 32/40, 28/36, 24/32. Title 22/28, 16/24, 14/20. Body 16/24, 14/20, 12/16. Label 14/20, 12/16, 11/16 (px, size/line-height). The token default typeface is Roboto [G3]. design.google itself now uses **Google Sans Flex** [G7].
- **Shape [G4]:** corner radii are 8 / 12 / 16 / 28 px, and `full` is 9999 px for pills.
- **Motion [G5]:** durations come in short (50–200 ms), medium (250–400 ms), and long (450–600 ms) steps. The standard easing is `cubic-bezier(0.2, 0, 0, 1)`, and emphasized-decelerate (for entering elements) is `cubic-bezier(0.05, 0.7, 0.1, 1)`. These are concrete, defensible defaults for hover, reveal, and theme transitions.
- **design.google layout [G6]:** an editorial index with two featured entries up top, then sections (Recent, Typography, UX, Guides). Each article is one clickable block containing a title, a one-line summary, and category and tag links. That card anatomy (title → one-line summary → tags) maps directly onto a Work highlight card.

## Cross-cutting observations

1. **Every polished example uses one accent color.** Apple uses `#0071e3`, Vivek uses `#f3a35f`, and Prakhar mostly sticks to indigo. Sawad's two loud accents read as "template", not "engineer".
2. **Apple's restraint comes from two widths, two weights, and big tight-tracked headlines.** Vivek copies this almost exactly and gets the Apple feel without imitating Apple's look.
3. **Metric-led work cards answer the recruiter's 30-second question.** Prakhar's "summary that states scale, plus two metric bullets, plus stack chips, then View details" is the closest existing match to the map's Home → Deep dive shape.
4. **The developer signal is strongest when it demonstrates the craft.** Vivek's hero editor shows his actual workflow (Fast Refresh). Listing frameworks as words (Sawad) signals nothing.
5. **JS-only rendering costs both sites visibility.** Two of the three inspiration sites render nothing without JS, so link previews, crawlers, and tools like WebFetch saw only a title [P1][V1]. Vivek partly makes up for it with a `<noscript>` block, JSON-LD, and OG tags.

## Shortlist: patterns to borrow

1. **One neutral palette plus a single accent**, defined as tokens with light and dark values. Include an accent-ink variant so accent text stays readable on both themes (Vivek [V2], Apple [A2]).
2. **System-following dark mode with an optional saved override** (Prakhar's `prefers-color-scheme` + `localStorage('theme')` [P3]). This matches the map's "system-following dark mode" requirement.
3. **Apple's two-width grid:** about 1068 px for wide modules and about 734 px for reading columns [A2]. Deep dive body copy sits in the narrow column.
4. **A big, tight headline scale in two weights:** 600 for headlines, 400 for body. Use Apple's tracking curve (−0.003em at 48 px down to −0.015em at 80 px) [A2], or the M3 display/headline sizes [G2]. Use one sans face (Inter, or the system stack) plus a monospace face for code.
5. **Short declarative headlines that end in a period**, under small uppercase eyebrows ("Selected work / Things I've built.") [V3][A1].
6. **Work highlight cards** that read: one-line summary with scale → 2 metric bullets → stack chips → "Read the deep dive" [P3][G6]. Use a real page per Deep dive, not a modal, so each one gets its own URL and social card.
7. **Label/value stat rows** (years, scale numbers) with qualifiers and, where honest, footnoted context, in the Apple style [A1][S1].
8. **One demonstration-style developer touch in the hero**, such as a small typed code snippet or terminal that resolves into the headline. Keep the focus on what you've built (Vivek's editor → preview [V3]). Use syntax-color tokens that work in both themes [V2].
9. **A sticky translucent nav**, using `backdrop-filter: saturate(180%) blur(20px)` over about 80% opaque surface, with a solid fallback [A3][V2].
10. **Material motion tokens:** 150–300 ms, `cubic-bezier(0.2,0,0,1)`, with emphasized-decelerate for reveals [G5]. Honor `prefers-reduced-motion` [V2].
11. **SEO and preview basics from Vivek:** JSON-LD `Person`, OG/Twitter large cards, and a canonical URL [V1]. Render to static HTML so none of it depends on JS.
12. **Small honest dev details:** stripped `github.com/handle`-style links, a "Built with …" footer line, and "Résumé · Download PDF" [P3].

## Shortlist: patterns to avoid

1. **Client-only rendering**, which left two of the three inspiration sites as an empty `<div id="root">` to crawlers and link unfurlers [P1][V1].
2. **Several loud accents** (Sawad's orange plus lime [S1]), and "glass everywhere". Keep blur to the nav.
3. **Heavy WebGL or decorative backgrounds** (Vivek's lazy-loaded `ogl` Lightfall [V3]). They cost performance and add nothing to the "what does he build, at what scale" message.
4. **Template-filler content:** inflated vanity counters ("+46 projects"), "Premium tools" lists, placeholder blog cards [S1], and long technology-only skill lists (Vivek's `knowsAbout` lists 40 technologies [V1]). Show scale through the work instead.
5. **Project details only in modals** [P3]. A modal can't be linked, shared, or given its own preview card, and Deep dives need all three.
6. **Typing and terminal gimmicks that block content.** If you use a code animation, the real headline must already be in the HTML and readable without the animation. Don't fake a full IDE.
7. **ALL-CAPS display headings and huge jumps in the type scale** (Sawad [S1]). These feel like a Framer template rather than Apple or Google.
8. **Stock Tailwind `bounce`/`ping` animations and no reduced-motion handling** [P2].

## Sources

- [S1] https://sawad.framer.website/ — the pre-rendered HTML (copy, `font-family` declarations, `--token-*` colors, breakpoints, `data-framer-appear-id`), fetched 2026-11-13, plus a WebFetch text extraction.
- [P1] https://prakharpatel.vercel.app/ — the HTML shell (title, meta description, `<div id="root">`). WebFetch returned only the title.
- [P2] https://prakharpatel.vercel.app/assets/index-DQvdL6-n.css — `:root` and `.dark` tokens, font stacks, keyframes.
- [P3] https://prakharpatel.vercel.app/assets/index-C2jxIcvZ.js — UI strings, project data (`summary`, `cardHighlights`), dialog markup, theme logic.
- [V1] https://vivek-ghodadra.web.app/ — the HTML shell (meta, OG/Twitter, JSON-LD, `<noscript>`, inline brand tokens, Inter preload). WebFetch returned only the title.
- [V2] https://vivek-ghodadra.web.app/assets/main-DKkO0dbT.css — tokens, glass materials, keyframes, reduced-motion handling, letter-spacing, widths.
- [V3] https://vivek-ghodadra.web.app/assets/main-qWH1oh53.js — UI strings, section ids, project descriptions, the hero editor demo, the `ogl` Lightfall import.
- [A1] https://www.apple.com/macbook-pro/ — rendered text via WebFetch (structure, copy, spec presentation, CTAs, footnotes).
- [A2] https://www.apple.com/v/macbook-pro/b/built/styles/overview.built.css — fonts, type scale, widths, colors, pill radius.
- [A3] https://www.apple.com/ac/localnav/9/styles/ac-localnav.built.css — sticky translucent local nav, light and dark.
- [G1] https://m3.material.io/styles/typography/type-scale-tokens — JS-only. WebFetch returned only the title.
- [G2] https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-typescale.scss
- [G3] https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-ref-typeface.scss
- [G4] https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-shape.scss
- [G5] https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-motion.scss
- [G6] https://design.google/ — rendered text via WebFetch (index layout, article card anatomy).
- [G7] https://design.google/ — raw HTML (Google Sans Flex).
