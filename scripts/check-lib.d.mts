export type Criterion = { id: string; description: string; passed: boolean };
export type BrokenFile = { file: string; message?: string };
export function checkPaths(module: number, specDirs?: string[]): string[];
export function criteriaFrom(vitestJson: unknown): Criterion[];
export function brokenFiles(vitestJson: unknown): BrokenFile[];
export function report(
  module: number,
  criteria: Criterion[],
  broken?: BrokenFile[],
): string;
