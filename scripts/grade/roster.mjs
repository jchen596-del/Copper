// Reads the roster CSV: a header row with at least `github`; optional `name`
// and `vercel_url` (a fallback when no deployment is found through GitHub).
import { readFileSync } from "node:fs";

function parseLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseRoster(csv) {
  const [header, ...rows] = csv.split(/\r?\n/).filter((line) => line.trim());
  const columns = parseLine(header).map((c) => c.toLowerCase());
  if (!columns.includes("github"))
    throw new Error("roster needs a `github` column");
  return rows.map((row) => {
    const values = parseLine(row);
    const student = Object.fromEntries(
      columns.map((c, i) => [c, values[i] ?? ""]),
    );
    return { name: student.name || student.github, ...student };
  });
}

export const loadRoster = (path) => parseRoster(readFileSync(path, "utf8"));
