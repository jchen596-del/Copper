// Built-in check: the module's spec tests (plus earlier modules' tests and any
// hidden tests), run with no secrets in the environment.
import { checkPaths } from "../../check-lib.mjs";
import { safeEnv } from "../proc.mjs";
import { runVitest } from "./vitest-run.mjs";

const testsCheck = {
  id: "tests",
  description: "Spec tests",
  cache: true,
  needsWorkspace: true,
  async run(ctx) {
    const paths = checkPaths(ctx.module, ctx.specDirs).filter(
      (p) => !p.endsWith("/evals"),
    );
    return runVitest(ctx, paths, safeEnv());
  },
};

export default testsCheck;
