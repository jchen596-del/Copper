// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  brokenFiles,
  checkPaths,
  criteriaFrom,
  report,
} from "../scripts/check-lib.mjs";

const result = (title: string, status: string) => ({ title, status });

describe("npm run check", () => {
  it("checks the current module's tests and evals and earlier modules' tests", () => {
    expect(
      checkPaths(2, [
        "README.md",
        "module-0",
        "module-1",
        "module-2",
        "module-3",
      ]),
    ).toEqual([
      "specs/module-0/tests",
      "specs/module-1/tests",
      "specs/module-2/tests",
      "specs/module-2/evals",
    ]);
  });

  it("groups tests by criterion ID; a criterion passes only if all its tests pass; skipped tests aren't listed", () => {
    const criteria = criteriaFrom({
      testResults: [
        {
          status: "failed",
          assertionResults: [
            result("AC-3.10 Ten", "passed"),
            result("AC-3.2 Two, first test", "passed"),
            result("AC-3.2 Two, second test", "failed"),
            result("helper without an ID", "passed"),
            result("AC-0.1 Retired in this module", "skipped"),
          ],
        },
      ],
    });
    expect(criteria.map((c) => [c.id, c.passed])).toEqual([
      ["AC-3.2", false],
      ["AC-3.10", true],
    ]);
  });

  it("prints a checklist and a summary line", () => {
    const text = report(0, [
      { id: "AC-0.1", description: "Shows the line", passed: true },
      { id: "AC-0.2", description: "Changed the line", passed: false },
    ]);
    expect(text).toContain("✅ PASS  AC-0.1  Shows the line");
    expect(text).toContain("❌ FAIL  AC-0.2  Changed the line");
    expect(text).toContain("1 of 2 criteria passed.");
  });

  it("reports test files that couldn't run", () => {
    const broken = brokenFiles({
      testResults: [
        {
          name: "specs/module-1/tests/a.test.ts",
          status: "failed",
          message: "SyntaxError",
          assertionResults: [],
        },
      ],
    });
    expect(report(1, [], broken)).toContain(
      "a.test.ts could not run: SyntaxError",
    );
  });
});
