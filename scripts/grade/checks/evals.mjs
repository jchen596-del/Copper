// Built-in check (opt-in with --evals): the module's AI evals. They call real
// models, so they only run for students whose spec tests all pass, using the
// key in GRADING_GOOGLE_GENERATIVE_AI_API_KEY (give it a low spending limit).
import { safeEnv } from "../proc.mjs";
import { runVitest } from "./vitest-run.mjs";

const evalsCheck = {
  id: "evals",
  description: "AI evals",
  cache: true,
  needsWorkspace: true,
  async run(ctx) {
    if (ctx.previous.some((r) => r.criterion.startsWith("AC-") && !r.passed)) {
      return { results: [], errors: ["evals skipped: spec tests are failing"] };
    }
    const key = process.env.GRADING_GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key)
      return {
        results: [],
        errors: ["evals skipped: GRADING_GOOGLE_GENERATIVE_AI_API_KEY not set"],
      };
    return runVitest(
      ctx,
      [`specs/${ctx.moduleDirName}/evals`],
      safeEnv({ GOOGLE_GENERATIVE_AI_API_KEY: key }),
    );
  },
};

export default evalsCheck;
