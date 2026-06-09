module.exports = {
  testEnvironment: "node",
  testMatch: ["**/src/**/*.test.js"],
  collectCoverageFrom: ["src/services/**/*.js"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
