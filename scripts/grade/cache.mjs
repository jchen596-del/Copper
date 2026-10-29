// Caches each student's results by graded commit + grading fingerprint, so a
// re-run only grades what changed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function createCache(dir, enabled = true) {
  if (enabled) mkdirSync(dir, { recursive: true });
  const file = (student, check) => join(dir, `${student}--${check}.json`);
  return {
    get(student, check, key) {
      if (!enabled || !existsSync(file(student, check))) return null;
      const entry = JSON.parse(readFileSync(file(student, check), "utf8"));
      return entry.key === key ? entry.results : null;
    },
    set(student, check, key, results) {
      if (enabled)
        writeFileSync(file(student, check), JSON.stringify({ key, results }));
    },
  };
}
