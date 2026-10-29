import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

// Week 0 checks the placeholder page, which Module 1 replaces with the landing
// page, so these tests only run during Module 0.
const { module } = JSON.parse(readFileSync("course.config.json", "utf8"));

const DEFAULT_LINE = "Week 0 check-in: Hello from Copper State Labs!";

describe.runIf(module === 0)("Module 0 sample", () => {
  it("AC-0.1 The home page shows the Week 0 line", () => {
    render(<Home />);
    expect(screen.getByTestId("week-0-line")).toBeInTheDocument();
  });

  it("AC-0.2 The Week 0 line was changed from the default text", () => {
    render(<Home />);
    expect(screen.getByTestId("week-0-line").textContent?.trim()).not.toBe(
      DEFAULT_LINE,
    );
  });
});
