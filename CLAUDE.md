## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on Dhaivat717/personal_portfolio, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Social preview cards

Every new indexable page in `src/pages/` (anything without `noindex` on `<Base>`) must have a 1200×630 PNG social preview card: pass `ogImage="/og/<page>.png"` to `src/layouts/Base.astro` and add its template/route in `src/og.ts` and `src/pages/og/[...page].png.ts`. New Personal projects in `src/content/projects/` get `/og/projects/<slug>.png` automatically. `src/socialCardCheck.ts` fails the build if any indexable page is missing its card.
