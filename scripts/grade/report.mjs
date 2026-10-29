// Writes grades.csv (for Canvas) and one feedback file per student.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function gradesCsv(rubric, graded) {
  const header = [
    "name",
    "github",
    "status",
    "commit",
    "committed_at",
    ...rubric.map((row) => `${row.criterion} (${row.points})`),
    "auto_points",
    "auto_max",
    "manual_max",
    "notes",
  ];
  const rows = graded.map((g) => [
    g.student.name,
    g.student.github,
    g.status,
    g.sha?.slice(0, 7) ?? "",
    g.committedAt ?? "",
    ...rubric.map((row) => {
      const scored = g.score?.rows.find((r) => r.criterion === row.criterion);
      return scored?.earned ?? ""; // manual rows stay blank for a TA
    }),
    g.score?.autoEarned ?? 0,
    g.score?.autoMax ??
      rubric
        .filter((r) => r.gradedBy === "auto")
        .reduce((t, r) => t + r.points, 0),
    g.score?.manualMax ?? "",
    g.notes.join(" | "),
  ]);
  return (
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n"
  );
}

export function feedback(module, g) {
  const lines = [`# Module ${module} results: ${g.student.name}`, ""];
  if (!g.score) {
    lines.push(`**Not graded:** ${g.notes.join("; ")}`);
    return lines.join("\n") + "\n";
  }
  lines.push(
    `Graded commit \`${g.sha.slice(0, 7)}\` (${g.committedAt})${g.status === "late" ? ". Commits after the deadline were not graded." : "."}`,
    "",
    "| | Criterion | Points | Details |",
    "|---|---|---|---|",
  );
  for (const row of g.score.rows) {
    const mark = row.gradedBy === "manual" ? "📝" : row.passed ? "✅" : "❌";
    const points =
      row.gradedBy === "manual"
        ? `— / ${row.points}`
        : `${row.earned} / ${row.points}`;
    lines.push(
      `| ${mark} | ${row.criterion}: ${row.description} | ${points} | ${row.detail.replaceAll("|", "\\|")} |`,
    );
  }
  lines.push(
    "",
    `**Auto-graded: ${g.score.autoEarned} of ${g.score.autoMax} points.**`,
  );
  if (g.score.manualMax)
    lines.push(`${g.score.manualMax} more points are graded by a TA.`);
  if (g.notes.length) lines.push("", "Notes:", ...g.notes.map((n) => `- ${n}`));
  return lines.join("\n") + "\n";
}

export function writeReports(outDir, module, rubric, graded) {
  mkdirSync(join(outDir, "feedback"), { recursive: true });
  writeFileSync(join(outDir, "grades.csv"), gradesCsv(rubric, graded));
  for (const g of graded) {
    writeFileSync(
      join(outDir, "feedback", `${g.student.github}.md`),
      feedback(module, g),
    );
  }
}
