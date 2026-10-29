# specs/

Each module of the course has a folder here, named `module-N` (for example
`module-2`). `module-0/` sets up the starter app. The starter app's own spec
is [`docs/starter-app.md`](../docs/starter-app.md).

## What's in a module folder

| Path | What it is |
|---|---|
| `spec.md` | What to build, and the acceptance criteria with IDs like `AC-2.3` |
| `instructions.md` | Step-by-step instructions for the module |
| `assets/` | Images and other files the module uses |
| `data/` | Data files (for example review datasets or golden question sets) |
| `tests/` | Acceptance tests. Each test name starts with its criterion ID |
| `evals/` | AI quality evals (`*.eval.ts`), scored against a threshold |
| `rubric.md` | Points for each criterion: a table with `Criterion \| Points \| Graded by \| Description` (`auto` or `manual`) |
| `grading.mjs`, `checks/` | Optional: which grading checks run, and module-specific checks (instructors only) |
| `reflection.md` | Reflection questions to answer when you finish |
| `CLAUDE.md` | Optional extra rules for AI agents working on this module |

## Rules

- **Don't edit `tests/`, `evals/`, `rubric.md`, `grading.mjs` or `checks/`.** They're how your work is checked; the grader uses its own copy.
- Run `npm run check` to see which criteria pass. It runs this module's tests and evals plus earlier modules' tests, using the module number in `course.config.json`.
- `npm test` runs the app's own tests in `tests/` and skips `specs/`.
