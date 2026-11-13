# Domain registrar & host options for dhaivat.dev

Research for issue #2 (child of map #1). All sources were checked on **2026-11-13**. Prices are in USD, exclude tax, and are for a standard (non-premium) name.

## Answer

**Buy `dhaivat.dev` at Cloudflare Registrar and host on Cloudflare Pages.** If you'd rather not keep the domain at Cloudflare, use **Porkbun** instead.

- **Price:** Cloudflare is about $8.20 for the first year and $12.20 to renew. Porkbun is $8.75, then $12.87. Both include free WHOIS privacy. Namecheap and Squarespace cost more to renew.
- **Why Cloudflare:** It sells at cost, so renewals never jump. The registrar, DNS, host and analytics all sit in one dashboard. Cloudflare Pages can only serve an apex domain (`dhaivat.dev`, not `www.`) if the zone already uses Cloudflare nameservers, and a Cloudflare Registrar domain does that from day one.
- **Trade-off (lock-in):** A domain registered at Cloudflare **must use Cloudflare nameservers**. If DNS ever needs to live somewhere else, the domain has to move to another registrar first. Every registrar also has the ICANN 60-day transfer lock after registration. This barely matters here. Cloudflare DNS can point at any host (Vercel, Netlify, GitHub Pages), and you can transfer out after 60 days.
- **Fallback:** Pick Porkbun if you want to keep the registrar separate from the host. It lets you use any nameservers, and its price is confirmed through its public API.

## Is dhaivat.dev available?

**Partly verified.** The `.dev` registry (Google Registry / Charleston Road Registry) returned **404 "dhaivat.dev not found"** from its RDAP endpoint (`https://pubapi.registry.google/rdap/domain/dhaivat.dev`) on 2026-11-13. That means **the name is not currently registered**.

RDAP can't show whether a name is reserved or premium-priced. I couldn't run a registrar cart check, because registrar search pages block automated clients. Confirm in the registrar's search at purchase time that the name shows as available at the standard price.

## Registrars

| Registrar | 1st year | Renewal | WHOIS privacy | DNS / nameservers | Transfer notes | Source quality |
|---|---|---|---|---|---|---|
| **Cloudflare Registrar** | ~$8.20 | ~$12.20 | Free redaction | **Must use Cloudflare nameservers.** Good DNS, one-click DNSSEC | Locked by default. ICANN 60-day lock after registration or registrant change. To change nameservers you have to transfer out | At-cost policy is primary. The $ figures come from a third-party tracker (see below) |
| **Porkbun** | $8.75 (sale; list $12.87) | $12.87 | Free | Any nameservers. Free DNS hosting and URL forwarding | Transfer-in $12.87 (includes 1 yr) | **Primary** (public pricing API + product page) |
| **Namecheap** | ~$10.78 | ~$20.98 | Free (long-standing policy, not re-verified) | Any nameservers. Free BasicDNS | Standard ICANN 60-day lock | Secondary (aggregator, 2026-09-23). Namecheap's page blocked automated fetch |
| **Squarespace Domains** | ~$20–30 | ~$20–30 | Included | Any nameservers. Simpler DNS UI | Standard ICANN 60-day lock | Secondary only. Sources disagree, and Squarespace publishes the price only at checkout |

Notes:
- **Cloudflare pricing:** Cloudflare says "Registration, transfer, and renewal prices are always at or below what registries and ICANN charge us" and "does not mark up domain prices at all" ([cloudflare.com/products/registrar](https://www.cloudflare.com/products/registrar/)). Its own price list couldn't be fetched (bot protection). The $8.20 / $12.20 figures come from [cfdomainpricing.com](https://cfdomainpricing.com/) (third-party, "last updated 2026-11-13"). The lower first-year figure probably reflects a registry promo passed through at cost. Treat both numbers as approximate until you see them at checkout.
- **Cloudflare nameserver rule:** "All domains on Cloudflare Registrar use Cloudflare nameservers". To use different nameservers "you will have to move your domain to another Registrar". ICANN "prohibits domain transfers within 60 days of a change to the WHOIS data or registrar" ([Cloudflare Registrar FAQ](https://developers.cloudflare.com/registrar/faq/)).
- **Porkbun:** Its public pricing API (`POST https://api.porkbun.com/api/json/v3/pricing/get`) returned `dev: registration 8.75, renewal 12.87, transfer 12.87`, plus a one-time $1-off first-year coupon `AWESOMENESS`. This matches [porkbun.com/products/domains](https://porkbun.com/products/domains). Porkbun "includes FREE WHOIS Privacy for all participating domains" ([porkbun.com/products/whois_privacy](https://porkbun.com/products/whois_privacy)).
- **Namecheap:** [domainoffer.net/tld/dev/namecheap](https://domainoffer.net/tld/dev/namecheap) (2026-09-23). Primary page not reachable by automated fetch.
- **Squarespace:** [costgoat.com](https://costgoat.com/pricing/squarespace-domains) says $30, and [stackscored.com](https://www.stackscored.com/pricing/domain-registrars/squarespace-domains/) says $20 (marked unverified). It's clearly the most expensive option with no advantage for this project.

## Static hosts

`.dev` is on the HSTS preload list: "browsers will only load .dev sites over a secure HTTPS connection" ([registry.google/domains/dev](https://www.registry.google/domains/dev/)). So **the site won't load at all until the host has issued a TLS certificate**. HTTP-only verification steps won't work in a browser either. All four hosts issue certificates automatically, so the only practical effect is an expected few-minute gap between adding the domain and the site loading.

| | Cloudflare Pages | Vercel (Hobby) | Netlify (Free) | GitHub Pages |
|---|---|---|---|---|
| Bandwidth | No limit stated | 100 GB/mo Fast Data Transfer | Metered: 20 credits/GB from 300 credits/mo | Soft 100 GB/mo |
| Builds / deploys | 500 builds/mo, 1 at a time | 100 deploys/day, 1 concurrent, 45 min/build | 15 credits per production deploy (~20 deploys/mo if nothing else is used) | Soft 10 builds/hr (not applied to Actions workflows) |
| Size limits | 20,000 files, 25 MiB/file | 100 MB static upload (CLI) | n/a | 1 GB site |
| Custom domain + HTTPS | Auto TLS. **Apex requires the zone on Cloudflare nameservers.** Subdomains work via CNAME from any DNS | Auto TLS. Apex via A record or Vercel nameservers. 50 domains/project | Auto TLS ("Custom domains with SSL") | Auto Let's Encrypt after DNS check. Extra apex records block issuance |
| Git deploys | Yes (GitHub/GitLab) | Yes. Hobby can't connect repos owned by a GitHub org (personal repo is fine) | Yes | Yes (branch or Actions) |
| Preview deploys | Yes, per branch and PR: `<hash>.<project>.pages.dev` and `<branch>.<project>.pages.dev` | Yes | Unlimited, not metered | No |
| Built-in analytics | Cloudflare Web Analytics, "privacy-first", available on all plans | Web Analytics: 50,000 events/mo, 1-month window, collection pauses past limit | Not on Free (Pro has 30-day analytics) | None |
| Commercial use | Allowed | Hobby is personal/non-commercial (a personal portfolio fits) | Allowed | "not intended for… your online business" (a portfolio is fine) |

Sources: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [Pages preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/), [Workers vs Pages migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/), [Vercel limits](https://vercel.com/docs/limits) (updated 2026-09-16), [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines) (updated 2026-11-12), [Vercel Web Analytics pricing](https://vercel.com/docs/analytics/limits-and-pricing), [Netlify pricing](https://www.netlify.com/pricing/), [Netlify credit-based plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

Host observations:
- **Netlify Free** is the weakest fit for frequent pushes. Each production deploy costs 15 of 300 monthly credits, the limit is hard, and you can't buy more on Free. Its docs didn't confirm what happens at the limit (likely a pause).
- **GitHub Pages** has no preview deploys and no analytics. Both are v1 requirements or near-requirements, so it's out.
- **Vercel Hobby** is a strong alternative, especially for Next.js. Its analytics limit (50k events/mo, 1-month window) is fine for a portfolio. The contact form will need a serverless function, and Vercel functions on Hobby cover that.
- **Cloudflare** now steers static sites toward Workers Static Assets, which has "a distinctly broader set of features" and also supports Git builds and preview URLs. Pages still works fine. Choosing between Pages and Workers can wait for the stack/hosting ticket.

## How registrar and host choice interact

- **Cloudflare Registrar → Cloudflare DNS is forced.** That's ideal for Cloudflare Pages, since apex custom domains require a Cloudflare zone. It also works with other hosts: add Vercel/Netlify/GitHub records in Cloudflare DNS, set to "DNS only" (grey cloud). Don't proxy in front of another host's TLS.
- **Porkbun (or Namecheap) → free choice.** Keep DNS at the registrar, or delegate nameservers to Cloudflare or Vercel. To use Cloudflare Pages on the apex later, you'd add the zone to Cloudflare (free plan) and change nameservers at Porkbun.
- **Squarespace** brings nothing for a non-Squarespace site.

## Recommendation summary

1. Confirm `dhaivat.dev` shows as available at standard price in the Cloudflare dashboard (Domain Registration → Register Domains), then buy it. Expect about $8.20, then about $12.20/yr. WHOIS redaction is automatic.
2. Default host is Cloudflare Pages (or Workers Static Assets), connected to the GitHub repo. It gives preview deploys per branch, no stated bandwidth cap, and free privacy-first analytics, all on one account with the DNS. The apex `dhaivat.dev` works natively.
3. If the stack ticket picks Next.js-heavy features, Vercel Hobby is the drop-in alternative. Keep the domain at Cloudflare and point DNS-only records at Vercel.
4. Fallback registrar is Porkbun ($8.75, then $12.87/yr, free privacy, any nameservers) if staying registrar-independent matters more than one dashboard.

## Unverified / open

- Cloudflare's exact `.dev` price comes from a third-party tracker. Its own price list wasn't machine-readable.
- Namecheap and Squarespace prices come from secondary aggregators only.
- Whether `dhaivat.dev` is reserved or premium (RDAP only confirms it isn't registered).
- What Netlify Free does when credits run out (pause behavior not confirmed in the docs fetched).
