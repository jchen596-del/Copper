# Module 0: Set up the Copper State Labs app

_Fictional — for educational use._

Welcome to CIS 591. All semester you'll build one app for **Copper State Labs**, a fictional Arizona company that makes AI-first devices. Each module adds a feature to the same app.

In this module you get the starter app running on your computer, make your own copy on GitHub, put it on the web, and make one small change that proves everything works.

| | |
|---|---|
| **You'll build** | Nothing new yet: a working setup and one personalized line on the home page |
| **Your repo** | `copper-m0` (public, on your GitHub account) |
| **Points** | 15 from tests, plus 5 for the live site |
| **Submit** | Your repo link, your Vercel link and a screenshot of `npm run check` (see [What to submit](#what-to-submit)) |

---

## Before you start

Install these once. You'll use them all semester.

| Tool | Why | Get it |
|---|---|---|
| GitHub account | Your code lives here | https://github.com/signup |
| GitHub CLI (`gh`) | Creates your repo for you | https://cli.github.com, then run `gh auth login` |
| Node.js 24 | Runs the app | https://nodejs.org (choose version 24) |
| Git | Downloads and saves your code | Included on Mac; https://git-scm.com on Windows |
| Vercel account | Puts your app on the web | https://vercel.com/signup (sign up with GitHub) |
| An AI coding agent | Your main way of working | Claude Code (or Codex) |

You'll also need a free **Google AI Studio** key later in the course, not now. The app runs without it.

Check your setup in a terminal:

```bash
node --version   # should start with v24
git --version
gh auth status   # should say you're logged in
```

## Step 1: Get the starter code and make it yours

```bash
cd ~/Developer        # or wherever you keep your projects
git clone --branch module-0 https://github.com/AliKefel/copper-state-labs-student.git copper-m0
cd copper-m0
npm run start-module  # creates github.com/YOUR-USERNAME/copper-m0 (public)
npm ci
```

`npm run start-module` makes the starter your `main` branch, creates your **public** `copper-m0` repo and pushes the code to it, and keeps the course repo connected under the name `course`. Your repo is public so your instructor can grade it and you can show it to employers.

If it stops with an error, read the message, fix what it says (for example, run `gh auth login`), and run it again. It picks up where it stopped.

## Step 2: Run the app

```bash
npm run dev
```

Open http://localhost:3000. You should see the Copper State Labs logo, "Our new site is under construction.", a highlighted **Week 0 check-in** line, and the footer "Fictional — for educational use." Try the sun/moon button for dark mode.

Stop the server with `Ctrl + C`.

Then see where you're starting from:

```bash
npm run check
```

```
Module 0: acceptance criteria

  ✅ PASS  AC-0.1 (5 pts)  The home page shows the Week 0 line
  ❌ FAIL  AC-0.2 (10 pts)  The Week 0 line was changed from the default text
  ⏳ LATER DEPLOY (5 pts)  The app is live on Vercel (checked when grading)

1 of 2 criteria passed.
5 of 15 points from tests, plus 5 points checked later.
```

The failing criterion is your task. `DEPLOY` is checked when your instructor grades (Step 5).

## Step 3: Personalize the check-in line

1. Open `app/page.tsx` and find the line marked `{/* MODULE 0: change this line */}`.
2. Replace `Week 0 check-in: Hello from Copper State Labs!` with your own sentence, for example `Week 0 check-in: Hi, I'm Jordan and I'm excited to build with AI.`

**Try it with your AI agent.** Open Claude Code (or Codex) in the project folder and ask it to make the change. It shows you a plan and waits for your OK first. That's on purpose: the project's `CLAUDE.md` / `AGENTS.md` tells the agent how to work in this course (see [Working with AI agents](#working-with-ai-agents)).

## Step 4: Check your work

```bash
npm run check   # Module 0 criteria: aim for 2 of 2
npm test        # the app's own tests
```

`npm run check` should say **2 of 2 criteria passed** and **15 of 15 points from tests**.

## Step 5: Push and deploy

```bash
git add app/page.tsx
git commit -m "Module 0: personalize the check-in line"
git push
```

Open `https://github.com/YOUR-USERNAME/copper-m0` to confirm your change is there. A green check mark next to the commit means the automatic tests (CI) passed.

Then put it on the web:

1. Go to https://vercel.com/new.
2. Import your **`copper-m0`** repository.
3. Leave every setting as it is and **don't add any environment variables**. Click **Deploy**.

After a minute you'll get a link like `https://copper-m0-yourname.vercel.app`. Open it and check that your line is there. Every later push to `main` redeploys the site.

## What to submit

In Canvas:

1. Your GitHub repo link (`https://github.com/YOUR-USERNAME/copper-m0`)
2. Your Vercel link
3. A screenshot of `npm run check` showing **2 of 2 criteria passed**

## How it's graded

| Part | Points | How |
|---|---|---|
| AC-0.1: the home page shows the check-in line | 5 | Test |
| AC-0.2: you changed the line to your own words | 10 | Test |
| DEPLOY: live on Vercel | 5 | The grader checks your live site |

Your last commit before the deadline is graded. Tests are run with your instructor's copy, so changing them in your repo doesn't change your grade.

---

## Working with AI agents

The repo comes set up for Claude Code and Codex.

- **Plan first.** The agent shows a plan and waits for your approval. Read it before saying yes.
- **Tests come with every change.** The agent runs `npm test` before saying it's done.
- **Secrets stay secret.** The agent is blocked from reading `.env` files.
- **MCP servers:** the first time you start Claude Code in the project, it asks you to approve two helpers: shadcn (UI components) and next-devtools (Next.js docs). Approve them.
- **Codex users:** Codex doesn't read the project's MCP file. The README has a snippet to paste into `~/.codex/config.toml`.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run check` | Show which of this module's criteria pass |
| `npm test` | Run the app's tests |
| `npm run lint` | Check code style |
| `npm run typecheck` | Check for type errors |
| `npm run format` | Tidy up formatting |

## Rules

- **Never commit `.env` or `.env.local` files, and never paste a key or password into code.** Your repo is public: bots scan GitHub for leaked keys within minutes. Keep keys only in `.env.local` and in Vercel.
- **Don't edit** `specs/*/tests`, `specs/*/evals` or `specs/*/rubric.md`. They're how your work is checked, and your instructor grades with their own copy.
- **Don't "fix" the Product Bible.** Some facts in `docs/copper-state-labs/product-bible.md` deliberately conflict, like an old privacy policy that's still in the system. Later modules depend on them.
- **Everything about Copper State Labs is fictional.** Don't use real company names, logos or products in your work.

## Troubleshooting

| Problem | Fix |
|---|---|
| `node --version` isn't v24 | Install Node 24 from nodejs.org, or run `nvm use` if you have nvm |
| `npm run start-module` says to log in | Run `gh auth login` and choose GitHub.com and HTTPS |
| `npm run start-module` says "already set up" | It already finished. Your repo exists; carry on with `npm ci` |
| `npm run start-module` says it could not push | You already have a `copper-m0` repo with other work in it. Delete it on GitHub (Settings > Delete this repository) and run the command again |
| Port 3000 is in use | Stop the other server, or run `npm run dev -- -p 3001` |
| AC-0.1 fails after your change | You removed the line or its `data-testid="week-0-line"`. Change only the text between the tags |
| `npm run check` shows "could not run" | Something in your code doesn't compile. Run `npm run typecheck` to find it |
| Vercel build fails | Run `npm run build` on your computer and fix the first error it shows |

**Working from another computer?** After Step 1 has created your repo, you can open it on GitHub and choose **Code → Codespaces → Create codespace**. It installs everything and starts the app in your browser, so you can do Steps 2–5 there. Step 1 itself needs Git, `gh` and Node on your own computer; if that's not possible, ask a TA.

Stuck for more than 20 minutes? Post in the course forum with the command you ran and the full error message, or come to office hours.
