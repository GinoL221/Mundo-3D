const {
  classifyRiskTier,
  classifyFile,
  generateRiskMap,
} = require("../../scripts/generate-coverage-risk-map.js");

// Locks in the Reproducible Risk Baseline requirement (spec S10): coverage
// gaps must be risk-classified, Tier 0 (security, data integrity, cart,
// stock, migrations) gaps must stay visible, and the map must be
// reproducible from the same inputs — never silently marked as fixed.

describe("classifyRiskTier", () => {
  it("classifies security infrastructure as tier0", () => {
    expect(classifyRiskTier("src/infrastructure/security/Bcrypt.ts")).toBe("tier0");
  });

  it("classifies cart behavior as tier0", () => {
    expect(classifyRiskTier("src/application/use-cases/SyncCartUseCase.ts")).toBe("tier0");
  });

  it("classifies stock behavior as tier0", () => {
    expect(classifyRiskTier("src/application/use-cases/AdjustProductStockUseCase.ts")).toBe(
      "tier0",
    );
  });

  it("classifies migrations as tier0", () => {
    expect(classifyRiskTier("src/database/migrations/20260724000000-baseline.js")).toBe("tier0");
  });

  it("classifies unrelated domain entities as tier1", () => {
    expect(classifyRiskTier("src/domain/entities/Category.ts")).toBe("tier1");
  });
});

describe("classifyFile", () => {
  it("marks a tier0 file below the guardrail as a gap", () => {
    const entry = classifyFile("src/infrastructure/security/JwtSecret.ts", {
      statements: { pct: 10 },
      branches: { pct: 10 },
      functions: { pct: 10 },
      lines: { pct: 10 },
    });

    expect(entry).toMatchObject({ tier: "tier0", status: "gap" });
  });

  it("marks a fully covered file as covered, not a gap", () => {
    const entry = classifyFile("src/domain/entities/Category.ts", {
      statements: { pct: 100 },
      branches: { pct: 100 },
      functions: { pct: 100 },
      lines: { pct: 100 },
    });

    expect(entry).toMatchObject({ tier: "tier1", status: "covered" });
  });
});

describe("generateRiskMap", () => {
  const fixtureCoverageSummary = {
    total: {
      statements: { pct: 60 },
      branches: { pct: 55 },
      functions: { pct: 65 },
      lines: { pct: 60 },
    },
    "src/infrastructure/security/JwtSecret.ts": {
      statements: { pct: 20 },
      branches: { pct: 15 },
      functions: { pct: 25 },
      lines: { pct: 20 },
    },
    "src/domain/entities/Category.ts": {
      statements: { pct: 90 },
      branches: { pct: 90 },
      functions: { pct: 90 },
      lines: { pct: 90 },
    },
  };

  it("excludes the aggregate 'total' key from the per-file classification", () => {
    const riskMap = generateRiskMap({
      coverageSummary: fixtureCoverageSummary,
      revision: "abc123",
      lockfileHash: "hash123",
      generatedAt: "2026-07-29T00:00:00.000Z",
    });

    expect(riskMap.files.map((entry) => entry.file)).not.toContain("total");
  });

  it("surfaces a pre-existing tier0 gap honestly, without claiming it fixed", () => {
    const riskMap = generateRiskMap({
      coverageSummary: fixtureCoverageSummary,
      revision: "abc123",
      lockfileHash: "hash123",
      generatedAt: "2026-07-29T00:00:00.000Z",
    });

    expect(riskMap.tier0Gaps).toHaveLength(1);
    expect(riskMap.tier0Gaps[0]).toMatchObject({
      file: "src/infrastructure/security/JwtSecret.ts",
      status: "gap",
    });
  });

  it("echoes revision and lockfile identity for reproducibility", () => {
    const riskMap = generateRiskMap({
      coverageSummary: fixtureCoverageSummary,
      revision: "abc123",
      lockfileHash: "hash123",
      generatedAt: "2026-07-29T00:00:00.000Z",
    });

    expect(riskMap.revision).toBe("abc123");
    expect(riskMap.lockfileHash).toBe("hash123");
  });

  it("is reproducible: identical inputs produce identical output", () => {
    const input = {
      coverageSummary: fixtureCoverageSummary,
      revision: "abc123",
      lockfileHash: "hash123",
      generatedAt: "2026-07-29T00:00:00.000Z",
    };

    const first = generateRiskMap(input);
    const second = generateRiskMap(input);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("throws when the coverage summary payload is missing", () => {
    expect(() => generateRiskMap({ coverageSummary: null })).toThrow();
  });
});
