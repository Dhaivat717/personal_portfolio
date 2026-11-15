import { describe, expect, test } from "vitest";
import { buildWithFixture } from "./build";

describe("production build", () => {
  test("succeeds with valid content", () => {
    const { status, output } = buildWithFixture("valid");
    expect(output).toContain("Complete!");
    expect(status).toBe(0);
  });

  test("fails and names the file when a Personal project's frontmatter is malformed", () => {
    const { status, output } = buildWithFixture("malformed-frontmatter");
    expect(status).not.toBe(0);
    expect(output).toMatch(/broken[\\/]index\.mdx/);
  });
});
