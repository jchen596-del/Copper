// Pure helpers for scripts/check.mjs, kept separate so they can be unit tested.
import { readdirSync } from "node:fs";

const moduleNumber = (dir) =>
  Number(/^module-(\d+)(?:-|$)/.exec(dir)?.[1] ?? NaN);

/** The folder name for a module number, e.g. 0 → "module-0". */
export function moduleDir(module, specDirs = readdirSync("specs")) {
  return specDirs.find((dir) => moduleNumber(dir) === module) ?? null;
}

/** Folders to check: the current module's tests and evals, earlier modules' tests. */
export function checkPaths(module, specDirs = readdirSync("specs")) {
  const number = moduleNumber;
  const paths = [];
  for (const dir of specDirs.filter((d) => !Number.isNaN(number(d))).sort()) {
    if (number(dir) === module)
      paths.push(`specs/${dir}/tests`, `specs/${dir}/evals`);
    else if (number(dir) < module) paths.push(`specs/${dir}/tests`);
  }
  return paths;
}

/**
 * Groups Vitest JSON results by acceptance-criterion ID (the "AC-x.y" at the
 * start of each test name). A criterion passes only if all its tests pass.
 */
const SKIPPED = new Set(["skipped", "pending", "todo", "disabled"]);

export function criteriaFrom(vitestJson) {
  const criteria = new Map();
  for (const file of vitestJson.testResults ?? []) {
    for (const test of file.assertionResults ?? []) {
      const match = /\b(AC-[\w.]+)\s*[:—-]?\s*(.*)/.exec(test.title);
      // Skipped tests (such as an earlier module's retired checks) aren't listed.
      if (!match || SKIPPED.has(test.status)) continue;
      const [, id, description] = match;
      const entry = criteria.get(id) ?? { id, description, passed: true };
      if (test.status !== "passed") entry.passed = false;
      criteria.set(id, entry);
    }
  }
  const byId = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
  return [...criteria.values()].sort(byId);
}

/** Test files that failed before any test ran (for example, a syntax error). */
export function brokenFiles(vitestJson) {
  return (vitestJson.testResults ?? [])
    .filter(
      (f) => f.status === "failed" && (f.assertionResults ?? []).length === 0,
    )
    .map((f) => ({ file: f.name, message: f.message }));
}

export function report(module, criteria, broken = [], rubric = []) {
  const points = new Map(rubric.map((row) => [row.criterion, row.points]));
  const pts = (id) => (points.has(id) ? ` (${points.get(id)} pts)` : "");
  const lines = [`Module ${module}: acceptance criteria`, ""];
  for (const c of criteria) {
    lines.push(
      `  ${c.passed ? "✅ PASS" : "❌ FAIL"}  ${c.id}${pts(c.id)}  ${c.description}`,
    );
  }
  // Rubric rows that the tests don't cover, such as the deployment check.
  const tested = new Set(criteria.map((c) => c.id));
  const later = rubric.filter((r) => !tested.has(r.criterion));
  for (const row of later) {
    const how =
      row.gradedBy === "manual" ? "graded by a TA" : "checked when grading";
    lines.push(
      `  ⏳ LATER ${row.criterion}${pts(row.criterion)}  ${row.description} (${how})`,
    );
  }
  for (const b of broken) {
    lines.push(
      `  ❌ ERROR  ${b.file} could not run: ${b.message ?? "unknown error"}`,
    );
  }
  const passed = criteria.filter((c) => c.passed);
  lines.push("", `${passed.length} of ${criteria.length} criteria passed.`);
  if (rubric.length > 0) {
    const sum = (list) =>
      list.reduce((total, id) => total + (points.get(id) ?? 0), 0);
    const earned = sum(passed.map((c) => c.id));
    const possible = sum(criteria.map((c) => c.id));
    const laterPoints = later.reduce((total, r) => total + r.points, 0);
    lines.push(
      `${earned} of ${possible} points from tests` +
        (laterPoints ? `, plus ${laterPoints} points checked later.` : "."),
    );
  }
  return lines.join("\n");
}
