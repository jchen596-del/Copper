// Loads what to grade for a module. A module can add
// specs/module-N/grading.mjs to choose checks and settings:
//
//   import schemaCheck from "./checks/schema.mjs";
//   export default {
//     checks: ["tests", "deploy", schemaCheck],  // built-in names or check objects
//     deploy: { marker: "Review Radar" },        // text the live page must show
//     timeoutMs: 180_000,                        // per student, per check
//   };
//
// A check is { id, run(ctx) → { results: [{ criterion, passed, detail }], errors: [] } }.
// Optional fields: criteria (rubric IDs it produces), cache (default true),
// needsWorkspace (default true). Without grading.mjs, the module runs "tests",
// plus "deploy" if its rubric has a DEPLOY row.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import deploy from "./checks/deploy.mjs";
import evals from "./checks/evals.mjs";
import tests from "./checks/tests.mjs";
import { loadRubric } from "./rubric.mjs";

export const BUILT_IN_CHECKS = { tests, deploy, evals };

export async function loadModuleConfig(
  root,
  moduleDirName,
  { evals: withEvals = false } = {},
) {
  const dir = join(root, "specs", moduleDirName);
  const rubric = loadRubric(dir);
  const file = join(dir, "grading.mjs");
  const settings = existsSync(file)
    ? (await import(pathToFileURL(file).href)).default
    : {};

  const names = settings.checks ?? [
    "tests",
    ...(rubric.some((row) => row.criterion === "DEPLOY") ? ["deploy"] : []),
  ];
  const wanted = names.filter((c) => c !== "evals");
  if (withEvals) wanted.push("evals");

  const checks = wanted.map((check) => {
    const resolved = typeof check === "string" ? BUILT_IN_CHECKS[check] : check;
    if (!resolved?.id || typeof resolved.run !== "function") {
      throw new Error(
        `${moduleDirName}/grading.mjs: unknown or invalid check ${JSON.stringify(check)}`,
      );
    }
    return { cache: true, needsWorkspace: true, ...resolved };
  });
  return { checks, rubric, settings, timeoutMs: settings.timeoutMs ?? 180_000 };
}
