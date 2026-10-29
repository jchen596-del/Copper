// Reads a module's rubric.md and scores results against it.
// Shared by `npm run check` and `npm run grade`.
//
// rubric.md must contain a table with these columns:
// | Criterion | Points | Graded by | Description |
// "Graded by" is "auto" (a test or check decides) or "manual" (a TA decides).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function parseRubric(markdown) {
  const lines = markdown.split("\n").map((line) => line.trim());
  const isRow = (line) => line.startsWith("|") && line.endsWith("|");
  const cells = (line) =>
    line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());

  for (let i = 0; i < lines.length; i++) {
    if (!isRow(lines[i])) continue;
    const header = cells(lines[i]).map((c) => c.toLowerCase());
    const col = (name) => header.indexOf(name);
    if (col("criterion") === -1 || col("points") === -1) continue;

    const rows = [];
    for (let j = i + 2; j < lines.length && isRow(lines[j]); j++) {
      const row = cells(lines[j]);
      const points = Number(row[col("points")]);
      if (!row[col("criterion")] || Number.isNaN(points)) {
        throw new Error(`rubric.md: bad row "${lines[j]}"`);
      }
      const gradedBy = (row[col("graded by")] ?? "auto").toLowerCase();
      if (gradedBy !== "auto" && gradedBy !== "manual") {
        throw new Error(
          `rubric.md: "Graded by" must be auto or manual in "${lines[j]}"`,
        );
      }
      rows.push({
        criterion: row[col("criterion")],
        points,
        gradedBy,
        description: row[col("description")] ?? "",
      });
    }
    return rows;
  }
  throw new Error("rubric.md has no table with Criterion and Points columns");
}

/** The rubric for a module folder (e.g. "specs/module-2"), or [] if it has none. */
export function loadRubric(moduleDir) {
  const path = join(moduleDir, "rubric.md");
  return existsSync(path) ? parseRubric(readFileSync(path, "utf8")) : [];
}

/**
 * Scores results ({ criterion, passed, detail }) against the rubric.
 * Auto rows earn their points when passed; manual rows are left for a TA.
 */
export function score(rubric, results) {
  const byCriterion = new Map(results.map((r) => [r.criterion, r]));
  const rows = rubric.map((row) => {
    if (row.gradedBy === "manual")
      return { ...row, earned: null, detail: "graded by a TA" };
    const result = byCriterion.get(row.criterion);
    return {
      ...row,
      passed: result?.passed ?? false,
      earned: result?.passed ? row.points : 0,
      detail: result?.detail ?? "no result",
    };
  });
  const auto = rows.filter((r) => r.gradedBy === "auto");
  const sum = (list, key) =>
    list.reduce((total, r) => total + (r[key] ?? 0), 0);
  return {
    rows,
    autoEarned: sum(auto, "earned"),
    autoMax: sum(auto, "points"),
    manualMax: sum(
      rows.filter((r) => r.gradedBy === "manual"),
      "points",
    ),
    unscored: results.filter(
      (r) => !rubric.some((row) => row.criterion === r.criterion),
    ),
  };
}
