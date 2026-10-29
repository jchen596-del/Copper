# Module 1: Build the Copper State Labs landing page

_Fictional — for educational use._

The Copper State Labs site still says "under construction." This module, you replace it with a real landing page: the products, Copper Plus pricing and an honest privacy section, built with your AI agent from a spec.

The full requirements are in **`specs/module-1/spec.md`**. Read it before you start. This page walks you through the steps.

| | |
|---|---|
| **You'll build** | A one-page landing page: hero, products, showcase, Copper Plus pricing and privacy |
| **Your repo** | `copper-m1` (public, on your GitHub account; a new repo, separate from `copper-m0`) |
| **Points** | 75 from tests, plus 10 for design (a TA) and 15 for the live site |
| **Submit** | Your repo link, your Vercel link and a screenshot of `npm run check` (see [What to submit](#what-to-submit)) |

---

## Before you start

- Module 0 is done: you have a `copper-m0` repo and a live Vercel site.
- Your tools still work: `node --version` starts with v24, and `gh auth status` says you're logged in.

## Step 1: Get the starter code and make it yours

Each module starts in a new repo. Your `copper-m0` repo stays as it is.

```bash
cd ~/Developer        # or wherever you keep your projects
git clone --branch module-1 https://github.com/AliKefel/copper-state-labs-student.git copper-m1
cd copper-m1
npm run start-module  # creates github.com/YOUR-USERNAME/copper-m1 (public)
npm ci
```

If `npm run start-module` stops with an error, fix what the message says and run it again. It picks up where it stopped.

Check where you're starting from:

```bash
npm run check
```

Every Module 1 criterion fails (**0 of 12 criteria passed**). That's your to-do list. `DESIGN` and `DEPLOY` show as "checked later".

## Step 2: Move the images (spec Step 0)

Do this before writing any page code. Open your AI agent in the project folder and give it the prompt from **Step 0 in `spec.md`** exactly as written. It moves the images from `specs/module-1/assets/` to `public/assets/` with `git mv` and commits.

Then check that you have these six files:

```
public/assets/cutouts/copper-home.png
public/assets/cutouts/copper-notes.png
public/assets/lifestyle/copper-home-desert-light.png
public/assets/lifestyle/copper-notes-stone-desk.png
public/assets/lifestyle/copper-notes-golden-hour.png
public/assets/brand/copper-mascot.png
```

`npm run check` should now pass **AC-2.3**.

## Step 3: Build the page with your agent

Work **one section at a time**, in the order the spec lists them. For each section:

1. Ask the agent to read `specs/module-1/spec.md` and plan just that section.
2. Read the plan before you approve it. Check that it uses the right `data-testid`, `id`, and components.
3. After it's built, run `npm run dev` and look at it at http://localhost:3000, then run `npm run check`.
4. Commit when the section works.

A good first prompt:

```
Read specs/module-1/spec.md and lib/copper/catalog.ts. Plan the hero section
only: the data-testid and id, the h1, the tagline, the See products link and
the two product cutouts. Use next/image and the shadcn Button. Don't write
code yet.
```

**Things the checks look for**, so tell your agent about them:

- **Prices and plan details come from the catalog.** Use `getProducts()`, `getPlans()` and `getPrivacySummary()` from `lib/copper/catalog.ts`, and format values with `formatUsd()`, `formatMemory()` and `formatNotesHours()`. Never type `$149` into the page: the grader changes the prices and checks your page follows.
- **Images use `next/image`** with paths like `/assets/cutouts/copper-home.png`, and every image has alt text that says what's in it ("Copper Home smart speaker in Patina Teal"), not "image" or a file name.
- **"See products" is a link** (`<a href="#products">`), styled with the shadcn `Button` (`<Button asChild>`) so it's Copper.
- **Use only the brand colors.** Prefer the theme classes (`bg-primary`, `text-muted-foreground`, `bg-secondary`). If your agent writes a color like `#333333` or `text-[#f5f5f5]`, ask it to use a theme color instead.
- **One page only.** Don't add other pages or routes.
- **Privacy: follow the 2026 policy.** Use `getPrivacySummary()`. Some older Copper documents say "Copper never records you." That's not true, and the page must not say it.
- **Reuse the starter's header and footer pieces** in `components/copper/` (`Logo`, `ModeToggle`) rather than starting over.

## Step 4: Check it at three screen sizes

The design is reviewed by a TA at phone, tablet and desktop widths, so check them yourself:

1. Run `npm run dev` and open http://localhost:3000.
2. Open your browser's developer tools and turn on the device toolbar (Chrome: `Cmd + Shift + M` on Mac, `Ctrl + Shift + M` on Windows).
3. Look at the page at **375**, **768** and **1280** pixels wide. There should be no sideways scrolling, nothing should overlap, and the sections should stack neatly on a phone.

The design rubric in `spec.md` is what the TA uses. Read it before you finish.

## Step 5: Check your work

```bash
npm run check       # Module 1 criteria: aim for 12 of 12
npm test            # the app's own tests
npm run lint        # code style
npm run typecheck   # type errors
```

`npm run check` should say **12 of 12 criteria passed** and **75 of 75 points from tests**.

## Step 6: Push and deploy

```bash
git push
```

Then put it on the web:

1. Go to https://vercel.com/new.
2. Import your **`copper-m1`** repository (a new Vercel project, separate from Module 0).
3. Leave every setting as it is and don't add environment variables. Click **Deploy**.

Open your Vercel link and check the whole page, including on your phone. The grader looks for the tagline "From raw ideas to refined answers." on your live site.

## What to submit

In Canvas:

1. Your GitHub repo link (`https://github.com/YOUR-USERNAME/copper-m1`)
2. Your Vercel link
3. A screenshot of `npm run check` showing **12 of 12 criteria passed**

## How it's graded

| Part | Points | How |
|---|---|---|
| AC-1: sections and navigation | 20 | Tests |
| AC-2: images | 20 | Tests |
| AC-3: content from the catalog, privacy | 20 | Tests |
| AC-4.1: button color and brand colors | 15 | Test |
| DESIGN: how it looks at three widths | 10 | A TA, using the design rubric in `spec.md` |
| DEPLOY: live on Vercel | 15 | The grader checks your live site |

Your last commit before the deadline is graded. Tests are run with your instructor's copy, so changing them in your repo doesn't change your grade.

## Rules

- **Don't edit** `specs/*/tests`, `specs/*/rubric.md`, `lib/copper/catalog.ts` or `lib/copper/data/`. Don't rename or change the images after Step 2.
- **Don't "fix" the Product Bible.** Its conflicting documents are deliberate.
- **Never commit `.env` files or paste keys into code.** This module needs no keys at all.
- **Everything about Copper State Labs is fictional.** Don't use real company names, logos or products.

## Troubleshooting

| Problem | Fix |
|---|---|
| Images don't show | Check the path starts with `/assets/` (not `public/assets/`), and that Step 2 moved the files |
| "Image is missing required width property" | Give `next/image` a `width` and `height` (or use `fill` inside a sized container) |
| AC-3.1 fails after prices look right | A value is typed into the page. Use the catalog and the `format…()` helpers |
| AC-1.2 fails | "See products" must be a link to `#products`, not a button with a click handler |
| AC-1.3 fails | Only one `h1` on the whole page, in the hero, 10 words or fewer. Use `h2` for section titles |
| AC-4.1 fails | The message names the file and color. Swap it for a theme class |
| Every criterion fails at once | The page doesn't render, or the hero's `data-testid="hero"` is missing. Run `npm run typecheck` |
| `npm run start-module` says "already set up" | It already finished. Your repo exists; carry on with `npm ci` |
| `npm run start-module` says it could not push | You already have a `copper-m1` repo with other work in it. Delete it on GitHub (Settings > Delete this repository) and run the command again |
| `npm run check` says "could not run" | A compile error. `npm run typecheck` shows it |
| Vercel build fails | Run `npm run build` on your computer and fix the first error |

Stuck for more than 20 minutes? Post in the course forum with the command you ran and the full error message, or come to office hours.
