// @vitest-environment node
// Runs the real grader against fake student repos built from this repo's files.
import { execFile, execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tempDir } from "../helpers/temp-dir";

const exec = promisify(execFile);
const repo = process.cwd();
const tmp = tempDir("grade-e2e-");
const students = join(tmp, "students");
const out = join(tmp, "out");
const DEADLINE = "2026-11-03T23:59:00Z";
const ON_TIME = "2026-11-01T12:00:00Z";
const LATE = "2026-11-05T12:00:00Z";
const DEFAULT_LINE = "Week 0 check-in: Hello from Copper State Labs!";
// Grades Module 0, which stays in specs/ on every branch.
const MODULE_0 = readdirSync("specs").find((dir) => /^module-0(-|$)/.test(dir));
// The starter's Module 0 page. Every fake student starts from this, so the test
// gives the same result on starter, solution and later-module branches.
const STARTER_PAGE = `export default function Home() {
  return <p data-testid="week-0-line">${DEFAULT_LINE}</p>;
}
`;

let server: Server;

function git(cwd: string, date: string, ...args: string[]) {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
      GIT_AUTHOR_NAME: "Student",
      GIT_AUTHOR_EMAIL: "s@example.com",
      GIT_COMMITTER_NAME: "Student",
      GIT_COMMITTER_EMAIL: "s@example.com",
    },
  });
}

function makeStudent(
  github: string,
  edit: (dir: string) => void,
  lateEdit?: (dir: string) => void,
) {
  const dir = join(students, github, "copper-m0");
  cpSync(join(tmp, "template"), dir, { recursive: true });
  edit(dir);
  git(dir, ON_TIME, "init", "-q", "-b", "main");
  git(dir, ON_TIME, "add", ".");
  git(dir, ON_TIME, "commit", "-qm", "on time");
  if (lateEdit) {
    lateEdit(dir);
    git(dir, LATE, "commit", "-qam", "late");
  }
}

const editLine = (dir: string, text: string) => {
  const page = join(dir, "app/page.tsx");
  writeFileSync(page, readFileSync(page, "utf8").replace(DEFAULT_LINE, text));
};

async function grade() {
  const { stdout } = await exec(
    process.execPath,
    [
      "scripts/grade/grade.mjs",
      "--module",
      "0",
      "--roster",
      join(tmp, "roster.csv"),
      "--deadline",
      DEADLINE,
      "--out",
      out,
      "--concurrency",
      "3",
      "--repo-template",
      `file://${students}/{github}/{repo}`,
    ],
    {
      cwd: repo,
      env: { ...process.env, PATH: `${join(tmp, "bin")}:${process.env.PATH}` },
    },
  );
  const [header, ...rows] = readFileSync(join(out, "grades.csv"), "utf8")
    .trim()
    .split("\n");
  const columns = header.split(",");
  const csv = Object.fromEntries(
    rows.map((row) => {
      const values = row.split(",");
      const record = Object.fromEntries(columns.map((c, i) => [c, values[i]]));
      return [record.github, record];
    }),
  );
  return { stdout, csv };
}

let first: Awaited<ReturnType<typeof grade>>;

beforeAll(async () => {
  if (!MODULE_0) return;
  // A live "Vercel" site for ana.
  server = createServer((_, res) =>
    res.end("<footer>Fictional — for educational use.</footer>"),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const site = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // A starter checkout: this repo's files, without node_modules or build output.
  // Works in a git clone or a plain copy (for example, a ZIP download).
  const skip =
    /^(node_modules|\.next|\.git|\.grading|\.vitest-cache|coverage)(\/|$)/;
  cpSync(repo, join(tmp, "template"), {
    recursive: true,
    filter: (source) => !skip.test(relative(repo, source)),
  });
  writeFileSync(join(tmp, "template", "app/page.tsx"), STARTER_PAGE);
  writeFileSync(
    join(tmp, "template", "course.config.json"),
    JSON.stringify({ module: 0, repoPrefix: "copper-m" }),
  );

  makeStudent("ana", (dir) => editLine(dir, "Week 0 check-in: Hi, I'm Ana."));
  makeStudent("ben", (dir) => {
    // Unchanged line, but the AC-0.2 test was weakened to always pass.
    const tests = join(dir, "specs", MODULE_0!, "tests");
    for (const file of readdirSync(tests)) {
      const test = join(tests, file);
      writeFileSync(
        test,
        readFileSync(test, "utf8").replace(".not.toBe(", ".toBe("),
      );
    }
  });
  makeStudent(
    "cam",
    () => {},
    (dir) => editLine(dir, "Week 0 check-in: Cam, a bit late."),
  );

  writeFileSync(
    join(tmp, "roster.csv"),
    `name,github,vercel_url\nAna,ana,${site}\nBen,ben,\nCam,cam,\nDee,dee,\n`,
  );
  // A fake `gh` that reports no deployments, so only the roster URL is found.
  mkdirSync(join(tmp, "bin"));
  writeFileSync(join(tmp, "bin", "gh"), "#!/bin/sh\necho '[]'\n");
  chmodSync(join(tmp, "bin", "gh"), 0o755);

  first = await grade();
}, 240_000);

afterAll(
  () =>
    new Promise<void>((resolve) =>
      server ? server.close(() => resolve()) : resolve(),
    ),
);

describe.runIf(MODULE_0)("npm run grade", () => {
  it("scores a finished, deployed submission in full", () => {
    expect(first.csv.ana).toMatchObject({
      status: "on time",
      "AC-0.1 (5)": "5",
      "AC-0.2 (10)": "10",
      "DEPLOY (5)": "5",
      auto_points: "20",
      auto_max: "20",
    });
  });

  it("grades with your tests, not the student's edited copy", () => {
    expect(first.csv.ben).toMatchObject({
      "AC-0.2 (10)": "0",
      auto_points: "5",
    });
  });

  it("grades the last commit before the deadline and marks later commits late", () => {
    expect(first.csv.cam).toMatchObject({
      status: "late",
      "AC-0.2 (10)": "0",
      auto_points: "5",
    });
    expect(readFileSync(join(out, "feedback", "cam.md"), "utf8")).toContain(
      "Commits after the deadline were not graded",
    );
  });

  it("reports missing repos instead of failing the run", () => {
    expect(first.csv.dee).toMatchObject({
      status: "no submission",
      auto_points: "0",
    });
  });

  it("writes feedback with points and details", () => {
    const feedback = readFileSync(join(out, "feedback", "ana.md"), "utf8");
    expect(feedback).toContain("**Auto-graded: 20 of 20 points.**");
    expect(feedback).toContain("URL from roster");
  });

  it("reuses cached results on a second run", async () => {
    const second = await grade();
    expect(second.stdout).toContain("(3 check results from cache)");
    expect(second.csv).toEqual(first.csv);
  }, 120_000);
});
