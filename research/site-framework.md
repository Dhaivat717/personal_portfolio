# Research: Static site framework for a growing portfolio

Ticket: #3 (child of map #1). Researched 2026-11-13.

## Question

Which framework best fits a mostly static, content-heavy portfolio: a Home page, Sections, Deep dives written in Markdown/MDX now, Personal projects added later, a few interactive touches, excellent performance, and easy deploys to a managed host? Compare Astro, Next.js (static export), and at least one other credible option on content collections, MDX, image handling, dark mode, SEO and social cards, ecosystem maturity, and host compatibility. The owner knows React and has no stack preference.

## Recommendation

**Astro 7, built as a fully static site (no adapter), with `@astrojs/mdx` for Deep dives and `@astrojs/react` for the few interactive islands.**

Why:

1. **Content collections fit the site's shape.** Deep dives, and later Personal projects, each become a collection defined in `src/content.config.ts`. A `glob()` loader reads the Markdown or MDX files, and a Zod schema validates frontmatter and generates TypeScript types. Adding Personal projects later means adding one new collection and one new route. Next.js has nothing equivalent built in.
2. **Zero JavaScript by default, React only where it's needed.** Pages ship as HTML. React components hydrate only where a `client:*` directive marks them, including inside MDX. The owner keeps using React without paying its runtime cost on every page, which serves the "excellent performance" goal directly.
3. **Image optimization works in a static build with no extra service.** `<Image>` and `<Picture>` use Sharp to produce AVIF and WebP output with responsive `srcset` at build time. In Next.js static export, the default `next/image` loader is unsupported, so you'd need a third-party image CDN.
4. **Any managed host works with no adapter.** A static build is plain `dist/`. Astro has official deploy guides for Vercel, Netlify, Cloudflare, and GitHub Pages.
5. **The project is mature and funded.** Astro 7.0 shipped in June 2026 and 7.4 in October 2026, with releases roughly monthly. The core team joined Cloudflare in January 2026. The license stays MIT, and the team has committed to keep supporting deploy targets beyond Cloudflare.

**Runner-up: Next.js 16 with `output: 'export'`.** It's a credible choice if the owner wants React everywhere. But a static export gives up built-in image optimization, has no typed content layer or native frontmatter, and ships the React runtime on every page.

**Not recommended: Eleventy, now called Build Awesome.** It's excellent at static output, but it isn't React-first. The project is also mid-rebrand, with v4 still in alpha.

## Comparison

| Criterion | Astro 7.4 (`astro@7.4.12`) | Next.js 16.4 static export (`next@16.4.6`) | Eleventy 3.1 (`@11ty/eleventy@3.1.8`, now "Build Awesome") |
|---|---|---|---|
| Content collections | Built in: `glob()` and `file()` loaders, Zod schemas, generated types, `reference()` between collections [A1] | None built in. MDX files are imported or read with `fs`/globby, and you assemble indexes yourself [N2] | Built-in collections via tags and the data cascade, without schema validation |
| MDX | Official `@astrojs/mdx`. Frontmatter supported by default. Astro and React components work inside MDX, and React needs a `client:*` directive to hydrate [A3] | Official `@next/mdx`. `mdx-components.tsx` is required. **Frontmatter isn't supported by default**, so you need remark plugins or `export const metadata`. Plugins with non-serializable options don't work under Turbopack [N2] | Supported as a template language [E2], but JSX/React isn't the native model |
| Image handling | `<Image>` and `<Picture>` with Sharp at build time, AVIF and WebP, a responsive `layout` prop for `srcset` and `sizes` (since 5.10), and an `image()` schema helper for frontmatter images [A2] | `next/image` with the **default loader is unsupported** in static export. You need a custom loader pointing at an external service such as Cloudinary [N1] | `@11ty/eleventy-img` with Sharp. An HTML transform processes every `<img>`, with AVIF, WebP, and `srcset` [E2] |
| Dark mode (follows the system) | Plain CSS `prefers-color-scheme`. No framework feature needed | Same | Same |
| SEO and social cards | Full control of `<head>`. Official `@astrojs/sitemap`. OG images aren't built in: generate them at build time with a static endpoint plus satori, or a community package [A5] | Metadata API, and `opengraph-image.tsx` with `ImageResponse` is "statically optimized (generated at build time)" unless it uses request-time APIs [N3] | Manual `<head>` templates. Community OG plugins |
| Interactive touches | React, Preact, Svelte, or Vue islands, opt-in per component | The whole site is a React app with client navigation, so React ships on every page | Vanilla JS or WebC. React would mean a separate bundling setup |
| Ecosystem maturity | 7.x line, releases roughly monthly in 2026 (7.0 June 22, 7.4 Oct 15) [A4]. Core team at Cloudflare since Jan 2026, still MIT [A6] | Very mature, backed by Vercel. Static export has been supported since 13.3/14 [N1] | Long-lived and stable, but renamed to Build Awesome in March 2026, funded through a Kickstarter, v4 in alpha [E1] |
| Host compatibility | Static `dist/` works anywhere, no adapter needed for static sites. Official guides for Vercel, Netlify, Cloudflare, GitHub Pages, and many more [A5] | Static `out/` works on any static host. Rewrites, redirects, and headers in `next.config` **are not supported** in export, so they must be set in host config [N1] | Static output works anywhere |

## Key facts and caveats

- **Next.js static-export limits** [N1]: unsupported features include default-loader image optimization, Server Actions, ISR, rewrites, redirects, headers, cookies, middleware/proxy, and dynamic routes without `generateStaticParams()`. Route handlers must be `GET` with `dynamic = 'force-static'`. **The contact form can't be a Server Action.** It has to post to an external form service or a host function. That's true for Astro static builds too, so it isn't a differentiator, but it settles the contact-form ticket either way.
- **Astro live collections** need an adapter (on-demand rendering) and don't support MDX [A1]. This site doesn't need them, since build-time collections cover everything.
- **Astro build time:** responsive images add build cost when there are many images [A2]. That's negligible at portfolio scale.
- **Astro 7** moved to Vite 8 and a new Rust compiler [A4]. Use 7.x from the start so you don't face a major upgrade early.
- **Social cards in Astro** take a small amount of setup (satori plus a static `.png.ts` endpoint, or a community package). Next has a first-class file convention for this. It's the one area where Next is clearly more ergonomic.

## Sources

Astro
- [A1] Content collections, https://docs.astro.build/en/guides/content-collections/
- [A2] Images, https://docs.astro.build/en/guides/images/
- [A3] `@astrojs/mdx`, https://docs.astro.build/en/guides/integrations-guide/mdx/
- [A4] Astro blog (7.0 to 7.4 release posts), https://astro.build/blog/
- [A5] Deploy guides, https://docs.astro.build/en/guides/deploy/ ; Endpoints (static file endpoints), https://docs.astro.build/en/guides/endpoints/
- [A6] "The Astro Technology Company joins Cloudflare," https://astro.build/blog/joining-cloudflare/ ; Cloudflare press release (2026-01-16), https://www.cloudflare.com/press/press-releases/2026/cloudflare-acquires-astro-to-accelerate-the-future-of-high-performance-web-development/

Next.js
- [N1] Static exports (last updated 2026-08-09), https://nextjs.org/docs/app/guides/static-exports
- [N2] MDX guide (last updated 2026-08-10), https://nextjs.org/docs/app/guides/mdx
- [N3] `opengraph-image` file convention (last updated 2026-07-09), https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image

Eleventy / Build Awesome
- [E1] Eleventy blog (rename to Build Awesome Mar 2026, Kickstarter, 3.1 release), https://www.11ty.dev/blog/
- [E2] Image plugin, https://www.11ty.dev/docs/plugins/image/ ; MDX, https://www.11ty.dev/docs/languages/mdx/

Versions are from the npm registry (`npm view <pkg> version`) on 2026-11-13: astro 7.4.12, @astrojs/mdx 8.1.6, @astrojs/react 7.1.9, next 16.4.6, @11ty/eleventy 3.1.8.
