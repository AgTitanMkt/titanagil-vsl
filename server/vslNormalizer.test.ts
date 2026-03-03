import { describe, expect, it } from "vitest";
import {
  normalizeVslName,
  extractGroupName,
  extractCountry,
  vslNamesMatch,
  findBestMatch,
} from "./services/vslNormalizer";

describe("normalizeVslName", () => {
  it("converts to lowercase", () => {
    expect(normalizeVslName("VSL1_US")).toBe("vsl1_us");
  });

  it("removes numeric sub-versions after dots", () => {
    expect(normalizeVslName("VSL56.2")).toBe("vsl56");
    expect(normalizeVslName("VSL 56.2")).toBe("vsl_56");
  });

  it("normalizes spaces and underscores", () => {
    expect(normalizeVslName("VSL 1 US")).toBe("vsl_1_us");
    expect(normalizeVslName("VSL-1-US")).toBe("vsl_1_us");
    expect(normalizeVslName("VSL_1_US")).toBe("vsl_1_us");
  });

  it("trims whitespace", () => {
    expect(normalizeVslName("  VSL1_US  ")).toBe("vsl1_us");
  });

  it("handles complex names", () => {
    expect(normalizeVslName("MemoryLift_VSL3_BR")).toBe("memorylift_vsl3_br");
    expect(normalizeVslName("Glucosense ADV 04")).toBe("glucosense_adv_04");
  });
});

describe("extractGroupName", () => {
  it("extracts base name before country code", () => {
    expect(extractGroupName("VSL1_US")).toBe("VSL1");
    expect(extractGroupName("VSL2_UK")).toBe("VSL2");
  });

  it("handles names with spaces before country code", () => {
    expect(extractGroupName("VSL 1 US")).toBe("VSL 1");
  });

  it("returns full name if no country code pattern", () => {
    expect(extractGroupName("VSL3")).toBe("VSL3");
  });

  it("removes numeric sub-versions", () => {
    expect(extractGroupName("VSL 56.2")).toBe("VSL 56");
  });

  it("handles complex multi-part names", () => {
    expect(extractGroupName("MemoryLift_VSL3_BR")).toBe("MemoryLift_VSL3");
  });
});

describe("extractCountry", () => {
  it("extracts 2-letter country code", () => {
    expect(extractCountry("VSL1_US")).toBe("US");
    expect(extractCountry("VSL2_UK")).toBe("UK");
    expect(extractCountry("VSL3 BR")).toBe("BR");
  });

  it("returns null when no country code", () => {
    expect(extractCountry("VSL3")).toBeNull();
    expect(extractCountry("Glucosense ADV 04")).toBeNull();
  });
});

describe("vslNamesMatch", () => {
  it("matches case-insensitive names", () => {
    expect(vslNamesMatch("VSL1_US", "vsl1_us")).toBe(true);
  });

  it("matches names with different separators", () => {
    expect(vslNamesMatch("VSL1_US", "VSL1-US")).toBe(true);
    expect(vslNamesMatch("VSL1_US", "VSL1 US")).toBe(true);
  });

  it("matches names with sub-version differences", () => {
    expect(vslNamesMatch("VSL56", "VSL56.2")).toBe(true);
  });

  it("does not match different VSLs", () => {
    expect(vslNamesMatch("VSL1_US", "VSL2_US")).toBe(false);
  });
});

describe("findBestMatch", () => {
  const candidates = ["VSL1_US", "VSL2_UK", "VSL3_BR", "MemoryLift_VSL3_BR"];

  it("finds exact normalized match", () => {
    expect(findBestMatch("vsl1_us", candidates)).toBe("VSL1_US");
    expect(findBestMatch("VSL1-US", candidates)).toBe("VSL1_US");
  });

  it("finds partial match", () => {
    expect(findBestMatch("VSL1", candidates)).toBe("VSL1_US");
  });

  it("returns null when no match", () => {
    expect(findBestMatch("VSL99_JP", candidates)).toBeNull();
  });
});
