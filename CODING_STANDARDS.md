# Coding Standards

Judgement-call standards for code review. Mechanical checks (schema, media caps, architecture diagrams, social cards, token contrast, em dashes, axe, budgets, Lighthouse, no-JS and reduced-motion behavior) are enforced by tests and CI and are omitted here.

- **Domain language:** Use the terms defined in `GLOSSARY.md` (`Home page`, `Section`, `Deep dive`, `Work highlight`, `Personal project`, `Featured project`, `Visitor`) consistently in docs, comments, and UI copy.
- **Public employer names only:** Use public product and company names (e.g. "Amazon Ads", "Amazon DSP") in Experience and Hero copy. Keep internal service, team, colleague, and customer names out of the repo.
- **Honest attribution in Deep dives:** First-person "I" describes Dhaivat's own work. When a Personal project builds on upstream open-source work, credit it in `builtOn` and separate upstream pieces from Dhaivat's additions in the prose and Architecture diagram.
- **Theme tokens only:** Style components and inline SVG diagrams with CSS custom properties from `src/styles/global.css` rather than raw hex or RGB literals (exceptions: `src/og.ts`, which renders dark-only PNG cards via Satori, and `src/styles/global.css` itself).
