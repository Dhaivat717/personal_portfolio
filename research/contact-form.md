# Contact form backend for a static site

Research for issue #4 (map #1). Sources checked 2026-11-13. Prices and limits change, so re-check the linked page before relying on a number.

## Question

How do we back the `dhaivat.dev` contact form with no server of our own? This note compares hosted form services (Formspree, Web3Forms, Basin) with host-native options (Netlify Forms, and a Cloudflare / Vercel function that sends through an email API). It covers free-tier limits, spam protection, deliverability to a personal inbox, privacy, and host lock-in.

## Short answer

- **Host-agnostic default: Web3Forms free tier, with its honeypot plus hCaptcha.** It works on any host and needs no backend code or DNS changes. It has the largest free quota of the hosted services (250/month, per third-party listings; the official pricing page blocked automated fetches). If we change hosts, the only thing to update is the form `action`.
- **On Cloudflare Pages: a Pages Function, Turnstile, and Cloudflare's `send_email` binding to a verified destination address.** This costs $0, needs no third-party form vendor, and we own the code. It requires `dhaivat.dev` to use Cloudflare DNS.
- **On Netlify: Netlify Forms with a honeypot (plus reCAPTCHA if spam gets through).** Submissions are free and unlimited on credit-based plans and setup is a single HTML attribute. The catch: when the team's 300 monthly credits run out, the site *and* the form are paused.
- **On Vercel: a Vercel Function that verifies Turnstile and sends through Resend's free tier.** Vercel has no built-in forms. Resend requires a verified sending domain (use a subdomain).

At portfolio volumes (a handful of messages a month) every option is free. The real differences are setup effort, lock-in, and where the data lives.

## Comparison

| Option | Free tier | Spam protection (free) | Delivery to inbox | Data held by | Lock-in |
|---|---|---|---|---|---|
| **Formspree** | 50 submissions/mo, unlimited forms, 30-day dashboard history [1] | Formshield basic filtering and custom reCAPTCHA; custom honeypot and advanced spam control are paid [1] | Formspree sends the notification from its own domain | Formspree, US infrastructure [2] | None (works on any host) |
| **Web3Forms** | 250 submissions/mo (third-party listings; official page blocked automated fetch [3]) | Server-side spam check on every plan, plus honeypot (`botcheck`) and hCaptcha; reCAPTCHA is Pro only [4]. Turnstile and reCAPTCHA v3 are listed under paid features [5] | Web3Forms sends from its own domain | Web3Forms | None |
| **Basin** | 1 form endpoint, 50 submissions/mo, 30-day retention [6] | "Basic spam protection" on free; reCAPTCHA, hCaptcha, Turnstile, and honeypot are listed, but which tiers include them couldn't be confirmed from the page [6] | Basin sends from its own domain | Basin | None |
| **Netlify Forms** | Free and unlimited on credit-based plans; "no submission limits or tier levels for forms" [7] | Akismet on every submission, plus an optional `netlify-honeypot` and reCAPTCHA 2 (Netlify-provided or custom) [8] | Netlify email notification | Netlify | **High**: `data-netlify` only works on Netlify |
| **Cloudflare Pages Function + `send_email`** | Workers/Pages Functions: 100,000 requests/day, 10 ms CPU per call [9]. Sends to verified destination addresses are free on all plans and don't count toward quota [10] | Turnstile: free, unlimited verifications, 20 widgets [11]; plus our own honeypot | Cloudflare sends from our own domain (SPF/DKIM added at onboarding [12]) to a verified address | Only us (nothing stored unless we add storage) | Medium: the code is ~40 lines of portable JS, but the email binding is Cloudflare-only and needs Cloudflare DNS [12] |
| **Vercel Function + Resend** | Vercel Hobby: 1,000,000 function invocations/mo [13]. Resend free: 3,000 emails/mo, 100/day, 3 domains [14] | Turnstile [11] (works without Cloudflare hosting) plus our own honeypot | Resend sends from our own verified domain or subdomain [15] | Resend (sent-message logs) | Low: a Resend call works from any function host |

## Findings by topic

### Free-tier limits

- **Formspree** caps the free plan at 50 submissions/month with 30 days of dashboard history. Paid plans start at $10/month billed yearly ($15 monthly) [1].
- **Basin** is similar: 1 endpoint, 50 submissions/month, 30-day retention. The lowest paid tier is $12.50/month billed yearly [6].
- **Web3Forms** gives 250/month according to several third-party listings. The official pricing page returned HTTP 403 to automated fetches, so confirm the number in a browser [3].
- **Netlify** credit-based plans make form submissions free and unlimited [7]. However, the Free plan has a hard cap of 300 credits/month: 15 per production deploy, 20 per GB of bandwidth, 2 per 10,000 web requests [16]. Running out pauses every project on the team, and paused projects "don't receive ... form submissions". Free teams can't buy more credits [7]. 300 credits is about 20 production deploys a month with no traffic, so frequent pushes to `main` could plausibly hit the cap.
- **Cloudflare** Pages Functions share the Workers free allowance of 100,000 requests/day [9]. Outbound email to *arbitrary* recipients needs Workers Paid, but sending to *verified destination addresses* is free on every plan [10]. A contact form only ever emails the owner, so the free path is enough.
- **Vercel** Hobby includes 1,000,000 function invocations/month. Over-limit usage on Hobby means waiting 30 days [13]. Vercel's fair-use guidelines restrict Hobby to non-commercial personal use [17]; a personal portfolio fits.
- **Resend** free: 3,000 emails/month, capped at 100/day, 3 domains [14].

### Spam protection

- **Turnstile** is free with unlimited verifications and "can be used independently without requiring other Cloudflare services" [11]. That makes it usable from a Vercel or Netlify function as well as Cloudflare. It is the least intrusive CAPTCHA (often invisible).
- **Honeypot** costs nothing and should be the baseline everywhere. Netlify supports one natively [8], Web3Forms supports `botcheck` [4], and in our own function it is a single `if`.
- **Hosted services** gate their better spam tooling behind payment. Formspree's custom honeypot is paid [1]. Web3Forms makes Turnstile and reCAPTCHA v3 paid but keeps hCaptcha and the honeypot free [4][5].
- **Netlify** runs every submission through Akismet automatically [8]. It is the only option with content-based filtering at zero configuration.

### Deliverability to a personal inbox

- With the hosted services (Formspree, Web3Forms, Basin, Netlify) the vendor sends the notification from its own domain. We change no DNS, but these mails can be filtered as bulk.
- With the **Cloudflare `send_email`** binding, the sender domain must be verified with Cloudflare [12]. Onboarding adds MX, SPF, and DKIM records [12], so mail is authenticated as `dhaivat.dev`. The destination inbox must be verified by clicking a confirmation link [12].
- **Resend** requires a domain we own and recommends a subdomain (e.g. `mail.dhaivat.dev`) to isolate sending reputation [15].
- Whichever option we choose, set the visitor's address as `Reply-To`, not `From`. Spoofing `From` breaks DMARC.

### Privacy

- **Hosted services** store submissions for us. Formspree keeps 30 days of history on free [1] and processes data in the US and other countries where it operates [2]. These vendors become data processors for visitor emails and messages.
- **A self-written function** (Cloudflare or Vercel) stores nothing unless we add storage. The message exists only in transit and in our inbox, plus the email provider's send logs when using Resend.
- **Turnstile** is the privacy-friendlier CAPTCHA. reCAPTCHA sends visitor signals to Google.

### Lock-in to a host

- **Hosted services** have no host lock-in. Moving means changing the form `action` URL (and the access key).
- **Netlify Forms** only works on Netlify; leaving means rewriting the form backend.
- **A function plus an email API** is portable across function hosts. The Turnstile verification and Resend call are plain `fetch` calls. Cloudflare's `send_email` binding is the one Cloudflare-specific piece, and it also requires Cloudflare DNS [12].

## Recommendation per host

| If the host decision lands on... | Use | Why |
|---|---|---|
| **Cloudflare Pages** | Pages Function + Turnstile + honeypot + `send_email` to a verified address | $0, no third-party vendor, no stored submissions, authenticated mail from our own domain. Requires Cloudflare DNS for `dhaivat.dev` (likely anyway on this host). |
| **Netlify** | Netlify Forms + honeypot (add reCAPTCHA 2 if spam appears) | Least effort and Akismet included. Accept the risk that the form pauses if the 300-credit cap is exhausted. If that risk is unacceptable, use Web3Forms instead. |
| **Vercel** | Vercel Function + Turnstile + honeypot + Resend (free) | No native forms. Resend is portable and gives authenticated mail from a `dhaivat.dev` subdomain. |
| **Undecided / other** | Web3Forms (free) + honeypot + hCaptcha | No code, no DNS, works anywhere, largest free quota of the hosted services. |

Open item for the build spec: whichever host wins, the visitor-facing form should be the same (name, email, message, honeypot, CAPTCHA widget), so only the submit target differs.

## Sources

1. Formspree plans: https://formspree.io/plans
2. Formspree privacy policy: https://formspree.io/legal/privacy-policy
3. Web3Forms pricing (HTTP 403 to automated fetch, number from third-party listings): https://web3forms.com/pricing
4. Web3Forms spam protection docs: https://docs.web3forms.com/getting-started/customizations/spam-protection
5. Web3Forms Pro features: https://docs.web3forms.com/getting-started/pro-features
6. Basin pricing: https://usebasin.com/pricing
7. Netlify billing FAQ for credit-based plans: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans
8. Netlify Forms spam filters: https://docs.netlify.com/manage/forms/spam-filters/
9. Cloudflare Workers pricing (applies to Pages Functions): https://developers.cloudflare.com/workers/platform/pricing/
10. Cloudflare Email Service pricing: https://developers.cloudflare.com/email-service/platform/pricing/
11. Cloudflare Turnstile plans: https://developers.cloudflare.com/turnstile/plans/
12. Cloudflare send email from Workers / enable Email Routing: https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/ and https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/
13. Vercel Hobby plan: https://vercel.com/docs/plans/hobby
14. Resend pricing: https://resend.com/pricing
15. Resend domains: https://resend.com/docs/dashboard/domains/introduction
16. Netlify how credits work: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
17. Vercel fair use guidelines: https://vercel.com/docs/limits/fair-use-guidelines
