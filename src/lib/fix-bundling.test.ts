import { describe, expect, it } from "vitest";
import { expandBundledFixIds, isReadmeBundledWithEnvExample } from "./fix-bundling";

describe("fix bundling", () => {
  it("bundles readme with env-example when both issues exist", () => {
    const scan = ["env-example", "readme", "vitest"];
    expect(isReadmeBundledWithEnvExample(scan)).toBe(true);
    expect(expandBundledFixIds(["env-example"], scan)).toEqual(["env-example", "readme"]);
  });

  it("does not add readme when only env-example is missing", () => {
    const scan = ["env-example", "vitest"];
    expect(expandBundledFixIds(["env-example"], scan)).toEqual(["env-example"]);
  });
});
