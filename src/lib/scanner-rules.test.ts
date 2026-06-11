import { describe, expect, it } from "vitest";
import {
  calcScore,
  detectFramework,
  hasReadmeSetupSection,
  dedupeIssues,
  type IssueInput,
} from "./scanner-rules";

describe("hasReadmeSetupSection", () => {
  it("accepts common setup headings", () => {
    expect(hasReadmeSetupSection("# App\n\n## Getting Started\n\nnpm install")).toBe(true);
    expect(hasReadmeSetupSection("## Installation\n\nRun npm i")).toBe(true);
    expect(hasReadmeSetupSection("## Development\n\nnpm run dev")).toBe(true);
  });

  it("rejects readme without setup section", () => {
    expect(hasReadmeSetupSection("# My App\n\nA cool project.")).toBe(false);
    expect(hasReadmeSetupSection(null)).toBe(false);
  });
});

describe("calcScore", () => {
  it("subtracts severity weights from 100", () => {
    const issues: IssueInput[] = [
      {
        category: "CI/CD",
        title: "x",
        severity: "critical",
        why: "y",
        timeSaved: "1h",
        fixId: "github-actions",
      },
      {
        category: "Testing",
        title: "x",
        severity: "high",
        why: "y",
        timeSaved: "1h",
        fixId: "vitest",
      },
    ];
    expect(calcScore(issues)).toBe(75);
  });
});

describe("detectFramework", () => {
  it("detects Next.js from dependencies", () => {
    expect(detectFramework({ dependencies: { next: "14.0.0" } })).toBe("Next.js");
  });

  it("returns unknown without signals", () => {
    expect(detectFramework({})).toBe("unknown");
  });
});

describe("dedupeIssues", () => {
  it("keeps first issue per fixId", () => {
    const issues: IssueInput[] = [
      {
        category: "A",
        title: "1",
        severity: "low",
        why: "x",
        timeSaved: "1h",
        fixId: "vitest",
      },
      {
        category: "B",
        title: "2",
        severity: "high",
        why: "x",
        timeSaved: "1h",
        fixId: "vitest",
      },
    ];
    expect(dedupeIssues(issues)).toHaveLength(1);
  });
});
