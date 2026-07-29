const fastConfig = require("../../jest.config.js");
const integrationConfig = require("../../jest.integration.config.js");
const backendPackageJson = require("../../package.json");

// Locks in deterministic test-class selection (spec: Deterministic
// Test-Class Selection, S1/S4): the fast command must stay DB-independent
// by excluding both real-DB integration extensions, and the dedicated
// integration command must keep retaining both.

describe("fast jest config (jest.config.js)", () => {
  const sampleJsIntegrationPath =
    "/repo/backend/src/database/__tests__/migrate.integration.test.js";
  const sampleTsIntegrationPath =
    "/repo/backend/src/infrastructure/repositories/__tests__/SequelizeProductRepository.integration.test.ts";
  const sampleUnitPath =
    "/repo/backend/src/application/__tests__/CreateProductUseCase.test.ts";

  const isIgnored = (filePath) =>
    fastConfig.testPathIgnorePatterns.some((pattern) => new RegExp(pattern).test(filePath));

  it("ignores .integration.test.js files", () => {
    expect(isIgnored(sampleJsIntegrationPath)).toBe(true);
  });

  it("ignores .integration.test.ts files", () => {
    expect(isIgnored(sampleTsIntegrationPath)).toBe(true);
  });

  it("does not ignore regular unit test files", () => {
    expect(isIgnored(sampleUnitPath)).toBe(false);
  });
});

describe("integration jest config (jest.integration.config.js)", () => {
  it("selects .integration.test.ts files", () => {
    expect(integrationConfig.testMatch).toContain("**/src/**/*.integration.test.ts");
  });

  it("selects .integration.test.js files", () => {
    expect(integrationConfig.testMatch).toContain("**/src/**/*.integration.test.js");
  });
});

describe("deterministic command contract", () => {
  it("backend package.json exposes a dedicated fast test command", () => {
    expect(backendPackageJson.scripts).toHaveProperty("test:fast");
  });

  it("backend package.json keeps the dedicated real-DB integration command", () => {
    expect(backendPackageJson.scripts).toHaveProperty("test:integration");
    expect(backendPackageJson.scripts["test:integration"]).toContain("jest.integration.config.js");
  });

  it("backend package.json exposes a dedicated coverage command", () => {
    expect(backendPackageJson.scripts).toHaveProperty("test:coverage");
  });
});
