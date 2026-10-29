// @vitest-environment node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tempDir } from "../helpers/temp-dir";
import { loadModuleConfig } from "../../scripts/grade/config.mjs";
import { safeEnv } from "../../scripts/grade/proc.mjs";
import { parseRoster } from "../../scripts/grade/roster.mjs";

function fakeModule(files: Record<string, string>) {
  const root = tempDir("grade-config-");
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const RUBRIC =
  "| Criterion | Points | Graded by |\n|---|---|---|\n| AC-9.1 | 5 | auto |\n";

describe("module grading config", () => {
  it("defaults to tests, plus deploy when the rubric has a DEPLOY row", async () => {
    const root = fakeModule({
      "specs/module-9/rubric.md": RUBRIC + "| DEPLOY | 5 | auto |\n",
    });
    const { checks } = await loadModuleConfig(root, "module-9");
    expect(checks.map((c: { id: string }) => c.id)).toEqual([
      "tests",
      "deploy",
    ]);
  });

  it("loads custom checks and settings from the module's grading.mjs", async () => {
    const root = fakeModule({
      "specs/module-9/rubric.md": RUBRIC + "| SCHEMA | 5 | auto |\n",
      "specs/module-9/checks/schema.mjs": `export default {
        id: "schema", criteria: ["SCHEMA"], needsWorkspace: false,
        async run(ctx) { return { results: [{ criterion: "SCHEMA", passed: ctx.sha === "abc", detail: "checked" }], errors: [] }; },
      };`,
      "specs/module-9/grading.mjs": `import schema from "./checks/schema.mjs";
        export default { checks: ["tests", schema], timeoutMs: 5000, deploy: { marker: "Hi" } };`,
    });
    const config = await loadModuleConfig(root, "module-9");
    expect(config.checks.map((c: { id: string }) => c.id)).toEqual([
      "tests",
      "schema",
    ]);
    expect(config.timeoutMs).toBe(5000);
    expect(config.settings.deploy.marker).toBe("Hi");
    const schema = config.checks[1];
    expect(schema.cache).toBe(true); // defaults filled in
    expect((await schema.run({ sha: "abc" })).results[0].passed).toBe(true);
  });

  it("adds evals only when asked", async () => {
    const root = fakeModule({ "specs/module-9/rubric.md": RUBRIC });
    const ids = async (evals: boolean) =>
      (await loadModuleConfig(root, "module-9", { evals })).checks.map(
        (c: { id: string }) => c.id,
      );
    expect(await ids(false)).toEqual(["tests"]);
    expect(await ids(true)).toEqual(["tests", "evals"]);
  });

  it("rejects unknown checks", async () => {
    const root = fakeModule({
      "specs/module-9/rubric.md": RUBRIC,
      "specs/module-9/grading.mjs": `export default { checks: ["nope"] };`,
    });
    await expect(loadModuleConfig(root, "module-9")).rejects.toThrow(
      /unknown or invalid check/,
    );
  });
});

describe("grader helpers", () => {
  it("runs student code without keys or tokens from your shell", () => {
    const original = { ...process.env };
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "secret";
    process.env.GH_TOKEN = "secret";
    try {
      const env: Record<string, string | undefined> = safeEnv();
      expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
      expect(env.GH_TOKEN).toBeUndefined();
      expect(env.PATH).toBe(process.env.PATH);
    } finally {
      process.env = original;
    }
  });

  it("reads the roster CSV, including quoted names", () => {
    expect(
      parseRoster(
        'name,github,vercel_url\n"Lee, Ana",ana-l,https://a.vercel.app\nSam,sam1,\n',
      ),
    ).toEqual([
      { name: "Lee, Ana", github: "ana-l", vercel_url: "https://a.vercel.app" },
      { name: "Sam", github: "sam1", vercel_url: "" },
    ]);
  });
});
