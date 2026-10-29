// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseRubric, score } from "../../scripts/grade/rubric.mjs";

const RUBRIC = `
# Rubric

| Criterion | Points | Graded by | Description |
|---|---|---|---|
| AC-1.1 | 10 | auto | First |
| AC-1.2 | 15 | auto | Second |
| DEPLOY | 5 | auto | Live |
| REFLECT | 20 | manual | Reflection |
`;

describe("rubric", () => {
  it("parses the criterion table", () => {
    expect(parseRubric(RUBRIC)).toEqual([
      {
        criterion: "AC-1.1",
        points: 10,
        gradedBy: "auto",
        description: "First",
      },
      {
        criterion: "AC-1.2",
        points: 15,
        gradedBy: "auto",
        description: "Second",
      },
      { criterion: "DEPLOY", points: 5, gradedBy: "auto", description: "Live" },
      {
        criterion: "REFLECT",
        points: 20,
        gradedBy: "manual",
        description: "Reflection",
      },
    ]);
  });

  it("rejects rows with bad points or grading type", () => {
    expect(() =>
      parseRubric("| Criterion | Points |\n|---|---|\n| AC-1 | ten |"),
    ).toThrow(/bad row/);
    expect(() =>
      parseRubric(
        "| Criterion | Points | Graded by |\n|---|---|---|\n| AC-1 | 5 | robot |",
      ),
    ).toThrow(/auto or manual/);
  });

  it("scores passed auto rows, leaves manual rows for a TA, and flags missing results", () => {
    const result = score(parseRubric(RUBRIC), [
      { criterion: "AC-1.1", passed: true, detail: "ok" },
      { criterion: "AC-1.2", passed: false, detail: "failed" },
      { criterion: "AC-9.9", passed: true, detail: "not in rubric" },
    ]);
    expect(result.autoEarned).toBe(10);
    expect(result.autoMax).toBe(30);
    expect(result.manualMax).toBe(20);
    expect(
      result.rows.find((r: { criterion: string }) => r.criterion === "DEPLOY"),
    ).toMatchObject({
      earned: 0,
      detail: "no result",
    });
    expect(
      result.rows.find((r: { criterion: string }) => r.criterion === "REFLECT")
        ?.earned,
    ).toBeNull();
    expect(
      result.unscored.map((r: { criterion: string }) => r.criterion),
    ).toEqual(["AC-9.9"]);
  });
});
