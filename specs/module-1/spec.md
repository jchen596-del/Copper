# Module 1 Spec: Copper State Labs Landing Page

_Fictional — for educational use._

## Scenario

Copper State Labs' website still says "under construction." Before the fall launch, CEO Priya Nair wants one polished landing page that makes a shopper want Copper Home and Copper Notes. It should use the product photography the team already has, explain Copper Plus, and be honest about privacy.

## User story

As a **shopper visiting the Copper State Labs site**, I want to **see the products, understand what they do and cost, and know how my data is handled**, so that **I can decide whether to buy**.

## What you have to work with

| Where | What |
|---|---|
| `specs/module-1/assets/cutouts/` | Product cutouts on transparent backgrounds: `copper-home.png`, `copper-notes.png` |
| `specs/module-1/assets/lifestyle/` | Lifestyle photos in Arizona settings: `copper-home-desert-light.png`, `copper-notes-stone-desk.png`, `copper-notes-golden-hour.png` |
| `specs/module-1/assets/brand/` | The Copper robot mascot: `copper-mascot.png` |
| `components/copper/` | `<Logo />`, `<SiteHeader />`, `<SiteFooter />` and `<ModeToggle />` from the starter |
| `lib/copper/catalog.ts` | `getProducts()`, `getPlans()`, `getPrivacySummary()`: all prices, plan details, features, colors, image paths and privacy facts. Format them with `formatUsd()`, `formatMemory()` and `formatNotesHours()` |
| `components/ui/` | The shadcn components already installed |
| Brand | Copper `#B87333`, Patina Teal `#4A8C82`, Desert Sand `#EFE3D0`, Sonoran Sunset `#E8663D`, Night Sky `#1C2333`, Hard-Hat Yellow `#F2C230` (already in the theme) |

## Step 0: Move the assets into `public/` (do this first)

The images ship with this spec, but a Next.js site can only serve images from `public/`. Before building anything, ask Claude Code:

```
Move the images for this module into public/ so the site can use them:
1. Run: git mv specs/module-1/assets public/assets
   (If public/assets already exists, move each subfolder in instead:
    git mv specs/module-1/assets/cutouts public/assets/cutouts, and the same for lifestyle and brand.)
2. Keep every folder name and file name exactly as it is. Don't rename, resize, convert or delete any file.
3. List what's now in public/assets/cutouts, public/assets/lifestyle and public/assets/brand, so I can check nothing is missing.
4. Commit with the message "Move Module 1 assets to public".
```

Check the list against the folder you started with, then continue. After this step, images are referenced in code as `/assets/cutouts/<file>`, `/assets/lifestyle/<file>` and `/assets/brand/<file>`.

**Why `git mv` and no renaming:** the grader looks for these exact paths, and `git mv` keeps the files' history.

## Page layout

One page at `/`, with these sections in this order. Each section has the `id` and `data-testid` shown.

| # | `data-testid` / `id` | Contents | Design direction |
|---|---|---|---|
| 1 | `site-header` | Logo; links to Products, Copper Plus, Privacy | Sticky, slim, Night Sky or white |
| 2 | `hero` / `top` | Your headline (10 words or fewer) in the only `h1`; the tagline "From raw ideas to refined answers."; a "See products" button | Large Copper Home and Copper Notes **cutouts** on a Desert Sand or Night Sky background. Text on one side, products on the other (stacked on phones) |
| 3 | `products` / `products` | One `product-card` per product (`data-product="copper-home"` / `"copper-notes"`): cutout, name, price, three features | Two cards side by side on desktop. Color swatches under each cutout are a nice touch |
| 4 | `showcase` / `showcase` | At least one **lifestyle photo** per product, each with a one-line caption | Full-width or alternating image/text rows |
| 5 | `plus-pricing` / `plus` | Free vs. Copper Plus: monthly and annual price, memory kept, Notes recording hours, Refined answers | Two-column comparison card; Copper Plus highlighted in Copper |
| 6 | `privacy-summary` / `privacy` | How Copper handles recordings under the 2026 policy | Calm, plain layout. Patina Teal works well here |
| 7 | `site-footer` | "Fictional — for educational use." and the logo | Night Sky background |

The design direction is guidance, not a test. Make it your own.

## Acceptance criteria

Each criterion's ID matches its test in `specs/module-1/tests/`. Run `npm run check` to see which pass.

### AC-1: One page, every section, working navigation
- **AC-1.1** All seven sections exist in the order above, with their `data-testid`s and `id`s.
- **AC-1.2** Header links go to `#products`, `#plus` and `#privacy`, and "See products" is a link to `#products`.
- **AC-1.3** There is exactly one `h1`, it's in the hero, and it's 10 words or fewer. The tagline appears exactly as written.
- **AC-1.4** The site is a single page at `/`. No other pages or routes are added.

### AC-2: Product images used correctly
- **AC-2.1** The hero shows the Copper Home cutout and the Copper Notes cutout.
- **AC-2.2** Each product card shows that product's cutout, and the showcase shows at least one lifestyle photo of each product.
- **AC-2.3** The images were moved with Step 0: `public/assets/cutouts/`, `public/assets/lifestyle/` and `public/assets/brand/` exist with the original file names, and `specs/module-1/assets/` no longer exists.
- **AC-2.4** Every image uses the Next.js `Image` component, comes from `public/` (`/assets/…`, or the logo), and has alt text describing what's shown (not "image" or a file name).
- Images keep their proportions: nothing is stretched or squashed. *(Checked in the design review.)*

### AC-3: Content is correct and comes from the catalog
- **AC-3.1** Prices and plan details come from `lib/copper/catalog.ts`, never typed into the page. The page shows Copper Home **$149**, Copper Notes **$129**, Copper Plus **$7.99/month** and **$79/year**, memory of **30 days** (Free) vs. **12 months** (Plus), and Notes recording of **10 hours/month** (Free) vs. **Unlimited** (Plus). If the catalog changes, the page changes with it: the test swaps in different prices and checks the page follows.
- **AC-3.2** The privacy section says nothing goes to the cloud until "Hey Copper" is heard, requests are saved after the wake word for 30 days (Free) or 12 months (Plus), and users can delete them in the Copper app.
- **AC-3.3** No text on the page says Copper "never records."

### AC-4: Looks good on every screen
- **AC-4.1** The "See products" button is Copper (`bg-primary`, which is `#B87333`), and the page's code uses only brand colors (white is fine).
- **DESIGN** At 375px (phone), 768px (tablet) and 1280px (desktop) wide: no horizontal scrolling, no overlapping text and images, and sections stack cleanly on phones. A TA scores the live site at each width against the design rubric below.

### AC-5: Deployed and shippable
- **DEPLOY** Your app is live on Vercel and the live page shows the landing page (the tagline). Vercel builds it with no environment variables, so a successful deploy also proves `npm run build` works.
- `npm run lint` and `npm test` pass (the green check on your commits).

## Design rubric (DESIGN review)

Scored from screenshots at the three widths. Each row is 0–2 points.

| | 0 | 1 | 2 |
|---|---|---|---|
| **First impression** | Hero is mostly text or images look pasted in | Products visible but hero feels unbalanced | Products are the clear focus; headline and button are easy to find |
| **Visual hierarchy** | Everything looks the same size | Some sections stand out | Clear order: headline → products → details |
| **Use of imagery** | Images small, cropped badly or repetitive | Images fit but feel like placeholders | Cutouts and lifestyle photos work together and tell a story |
| **Brand consistency** | Off-brand colors or fonts | Mostly on-brand | Feels like one company, start to finish |
| **Spacing and polish** | Cramped or uneven | Mostly consistent | Generous, even spacing; aligned edges; no visual glitches |

## Non-goals

- No other pages, logins, sign-up forms, checkout or database writes.
- No AI features or API calls.
- No new UI or animation libraries.
- Don't edit `lib/copper/catalog.ts` or its data files, don't rename or change the images after Step 0, and don't edit the tests in `specs/module-1/tests/`.

## How it's graded

| Criterion | How it's checked | Points |
|---|---|---|
| AC-1.1 – AC-1.4 | Tests that render the page | 20 |
| AC-2.1 – AC-2.4 | Tests check image paths, `Image` use, alt text and the Step 0 move | 20 |
| AC-3.1 – AC-3.3 | Tests; AC-3.1 also swaps in a changed catalog and checks the page follows | 20 |
| AC-4.1 | Test of the button color and the colors in your code | 15 |
| DESIGN | A TA scores the live site at three widths with the design rubric | 10 |
| DEPLOY | The grader finds your live Vercel site and checks it shows the tagline | 15 |

`specs/module-1/rubric.md` has the full list. Tests are graded with the instructor's copy, so editing them changes nothing.
