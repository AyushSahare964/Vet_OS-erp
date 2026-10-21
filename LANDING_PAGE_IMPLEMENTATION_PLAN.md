# Landing Page → Request Demo → Choose Plan → Register Clinic: Implementation Plan

Status: **plan only, nothing built yet.** Reference copy of the landing page is cloned (untouched) at
`C:\Guidelify\landing-dashboard` (from `sanskrutiruyarkar24-source/DashBoard`, last commit `d91ee8b`).

## 1. Target flow

```
Landing (/)  ──►  Request Demo (form)            [lead saved + sales notified by email]
   │
   ├──►  Sign In  ──►  /login  ──►  ERP dashboard
   │
   └──►  Pricing (/pricing)  ──►  pick a plan  ──►  /register-clinic?plan=<id>
                                                      (plan preselected, 5-step wizard)
                                                      ──►  trial starts, welcome email, ERP opens
```

Header (top right, in this order): `[ Sign In ]  [ Request Demo → ]`
(Assumed from "request demo, then next to it sign in". The landing's current "Staff Portal" link becomes **Sign In → /login**; the primary purple "Request Demo Access" button stays as the right-most item.)

## 2. What exists today

### Landing page (reference repo)
- Vite 5 + React 18 + **Tailwind 3** + framer-motion 11, plain **JSX**, **no router** (`App.jsx` checks `location.pathname === '/pricing'`).
- Sections: Boot splash, Header (scroll-spy nav, mobile drawer), HeroPetsIntro (dog/cat/rabbit video intro), Bento, Showcase, Walkthrough, Metrics (+ "View Plans & Pricing" CTA strip), Footer. Pricing page with 3 plan cards.
- Assets: ~8.7 MB (`public/hero-pets/*.webm/webp`, logos). Global CSS (`index.css`, `pets.css`, per-section css) plus a `tailwind.config.js` with custom colours, shadows and gradients.
- Placeholders still open in its code: `ERP_URL = 'https://YOUR-ERP-LOGIN-URL-HERE'`, `SUPPORT_EMAIL`, `startPayment()` (Razorpay stub, disabled). Every "Request Demo Access" button just scrolls to `#briefing-form`, which is only a link to pricing, so **there is no demo form or backend**.
- `pricing/page.tsx` and `design-reference/`, `code.html`, `DESIGN.md` are Next.js / design leftovers, not used.

### Our ERP
- TanStack Start (SSR) + React 19 + **Tailwind 4** + TypeScript. Cloudflare deploy (`wrangler.toml`).
- `/` is the **logged-in dashboard** (`RequireLogin` sends logged-out users to `/login`). `/login`, `/register-clinic` (5-step wizard, plan chosen in step 4), `/pending-approval` exist.
- Registration (`registerTenantFn` in `serverFns/platform.ts`): creates tenant + admin, plan ∈ `plan_basic | plan_professional | plan_enterprise`, **14-day TRIAL, no payment step**, features gated per plan (`lib/erp/features.ts`), welcome email via EmailJS.
- Email: EmailJS (`lib/email/emailjs.ts`), 3 templates today. No demo-request model or notification.

## 3. Conflicts to resolve (need your call, see section 8)

| # | Conflict | Landing | ERP | Recommendation |
|---|----------|---------|-----|----------------|
| 1 | Plan catalogue | Starter ₹0 (30-day trial), Pro ₹2,000/mo, Max "coming soon" | Basic ₹999, Professional ₹2,499, Enterprise ₹5,999 (feature gates + `planId` enum) | Use the ERP's 3 tiers as the single source; rewrite landing copy from `SUBSCRIPTION_PLANS` so price/features can't drift |
| 2 | Trial length | 30 days | 14 days | One constant shared by both (pick 14 or 30) |
| 3 | Payment | Razorpay stub | none; every plan starts a trial | Phase 1 = trial-only (matches ERP). Razorpay is a later phase |
| 4 | `/` route | Landing | Dashboard (login-gated) | `/` shows landing to logged-out visitors, dashboard to signed-in users |
| 5 | Brand spelling | VetechIQ | emails use "VetTechIQ" | Pick one; ERP UI already says VetechIQ |

## 4. Approach

Port the landing **into this app** (single deploy, no cross-domain links, plan data shared). The cloned folder stays as a read-only reference.

- Convert JSX → TSX under `src/components/landing/`; routes `src/routes/pricing.tsx`, `src/routes/request-demo.tsx`.
- Tailwind 3 → 4: move the landing's `tailwind.config.js` tokens into a scoped `@theme` / CSS variables.
- **Scope all landing CSS under a `.vx-page` wrapper** so it cannot leak into the ERP (fonts, `.btn-primary`, body styles).
- Load Poppins and Material Symbols only on landing routes via the route `head()` links (same pattern as `doctorHeadLinks`).
- SSR safety: `window`, `matchMedia`, `<video>` autoplay and scroll-spy only inside effects; respect `prefers-reduced-motion`.
- Assets to `public/landing/`; videos lazy-loaded with poster images.

## 5. Phases

**Phase 1: Landing shell and routing**
1. Port Header, Hero, Bento, Showcase, Walkthrough, Metrics, Footer; header = `Sign In` + `Request Demo`.
2. `/` → landing when logged out, dashboard when logged in (change `RequireLogin` use on `/`; other routes keep redirecting to `/login`).
3. Replace every `#briefing-form` / placeholder link with real routes; delete `ERP_URL` placeholders.
*Check:* logged-out `/` shows landing; signed-in `/` still shows the dashboard; ERP styles unchanged.

**Phase 2: Request Demo**
1. `/request-demo` page (or modal from the header): name, clinic, phone, email, city, clinic size, preferred time, message. Zod validation, honeypot field, simple rate limit.
2. New `DemoRequest` model (not tenant-scoped, public write) and `requestDemoFn` server function.
3. Notify sales via EmailJS (new template or reuse) and confirm to the requester.
4. Lead list for platform admins (Hospital → Tenants hub tab) so requests are not lost. Can be deferred.
*Check:* submit saves a row, emails arrive, bad input is rejected.

**Phase 3: Pricing and plan choice**
1. `/pricing` with 3 cards fed from the shared plan source; "Start free trial" → `/register-clinic?plan=<planId>`.
2. `register-clinic` gets `validateSearch` for `plan`; wizard preselects it, step 4 still lets the user change it.
3. Trial length and plan names in emails and success messages read from the same constants.
*Check:* each card lands on the wizard with the right plan; the created tenant has that `planId` and features.

**Phase 4: Polish and tests**
1. Mobile drawer, scroll-spy, SEO/OG tags, performance pass (video weight, LCP).
2. Playwright e2e: landing → pricing → register with plan; demo form validation; existing logged-in `/` specs still pass.
3. `tsc` clean for touched files; Lighthouse sanity check.

**Phase 5 (later, only if wanted):** Razorpay checkout and paid conversion at trial end, plan upgrade inside the ERP.

## 6. Files expected to change

- New: `src/components/landing/**`, `src/routes/pricing.tsx`, `src/routes/request-demo.tsx`, `src/lib/mongodb/models/DemoRequest.ts`, `src/lib/mongodb/serverFns/demo.ts`, `public/landing/**`, e2e spec.
- Edited: `src/routes/index.tsx` (landing vs dashboard), `src/routes/register-clinic.tsx` (`?plan=`), `src/lib/erp/features.ts` (marketing copy per plan), `src/lib/email/emailjs.ts` (demo template), `src/routes/login.tsx` (back-to-home link).

## 7. Risks

- Global CSS collisions between the landing and the ERP theme (mitigated by `.vx-page` scoping).
- 8.7 MB of video hurting first load (lazy load, posters, reduced-motion fallback).
- Public demo endpoint = spam target (honeypot + rate limit + email validation).
- Changing `/` could break existing e2e that assume the dashboard at `/` when signed in; they sign in first, so they should be unaffected, but they must be re-run.

## 8. Decisions needed before building

1. **Plans:** use the ERP's Basic / Professional / Enterprise (recommended), or keep the landing's Starter / Pro / Max and map them onto ERP tiers?
2. **Trial length:** 14 days (ERP today) or 30 days (landing copy)?
3. **Request Demo UX:** a dedicated `/request-demo` page, or a popup form on the landing?
4. **Where demo requests go:** which email address should receive them?
5. Header order: confirm `Sign In` left of `Request Demo` (right side of the header).
