// @vitest-environment node
// Every module must keep its tests, checks and rubric in step. This runs on
// every module branch, so authoring mistakes are caught before grading.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadModuleConfig } from "../../scripts/grade/config.mjs";
import { loadRubric } from "../../scripts/grade/rubric.mjs";

const modules = readdirSync("specs").filter((dir) => /^module-\d+/.test(dir));

function testedCriteria(dir: string): Set<string> {
  const tests = join("specs", dir, "tests");
  if (!existsSync(tests)) return new Set();
  const ids = new Set<string>();
  for (const file of readdirSync(tests, { recursive: true }) as string[]) {
    if (!/\.test\.tsx?$/.test(file)) continue;
    for (const m of readFileSync(join(tests, file), "utf8").matchAll(
      /it\(\s*["'`](AC-[\w.]+)/g,
    )) {
      ids.add(m[1]);
    }
  }
  return ids;
}

describe.each(modules)("%s grading setup", (dir) => {
  it("has a rubric", () => {
    expect(loadRubric(join("specs", dir)).length).toBeGreaterThan(0);
  });

  it("lists every tested criterion in the rubric", () => {
    const rubric = new Set(
      loadRubric(join("specs", dir)).map((r) => r.criterion),
    );
    for (const id of testedCriteria(dir))
      expect(rubric, `${id} missing from rubric.md`).toContain(id);
  });

  it("has a test or check for every auto-graded rubric row", async () => {
    const { checks, rubric } = await loadModuleConfig(process.cwd(), dir);
    const covered = new Set([
      ...testedCriteria(dir),
      ...checks.flatMap((c: { criteria?: string[] }) => c.criteria ?? []),
    ]);
    for (const row of rubric.filter(
      (r: { gradedBy: string }) => r.gradedBy === "auto",
    )) {
      expect(covered, `${row.criterion} has no test or check`).toContain(
        row.criterion,
      );
    }
  });
});
