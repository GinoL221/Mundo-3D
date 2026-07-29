#!/usr/bin/env node
"use strict";

/**
 * Generates a reproducible coverage risk map from Jest's coverage-summary.json.
 *
 * Classifies covered/uncovered production source files by risk tier and
 * reports Tier 0 gaps (security, data integrity, cart, stock, migrations)
 * honestly: a pre-existing gap is surfaced, never silently marked fixed.
 * This is verification tooling only — it does not change product behavior.
 *
 * Usage: node scripts/generate-coverage-risk-map.js
 * Reads:  coverage/coverage-summary.json (produced by `jest --coverage`,
 *         see jest.config.js coverageReporters: ["text", "lcov", "json-summary"]).
 * Writes: coverage/risk-map.json
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

// Tier 0 = highest-priority uncovered behavior per the proposal: security,
// data integrity/migrations, cart, and stock. Everything else is tier1.
const TIER0_PATTERNS = [
  /[\\/]infrastructure[\\/]security[\\/]/i,
  /[\\/]middlewares[\\/]auth\.ts$/i,
  /JwtSecret/i,
  /[\\/]database[\\/]migrations[\\/]/i,
  /[\\/]database[\\/]migrate\.js$/i,
  /Cart/i,
  /Stock/i,
];

// Matches the coverage guardrail (jest.config.js coverageThreshold.global);
// a file scoring below this on any metric is reported as a gap.
const GAP_THRESHOLD = 50;

function classifyRiskTier(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/");
  return TIER0_PATTERNS.some((pattern) => pattern.test(normalized)) ? "tier0" : "tier1";
}

function metricPercent(metric) {
  if (!metric || typeof metric.pct !== "number" || Number.isNaN(metric.pct)) {
    return 0;
  }
  return metric.pct;
}

function classifyFile(filePath, metrics) {
  const tier = classifyRiskTier(filePath);
  const coverage = {
    statements: metricPercent(metrics.statements),
    branches: metricPercent(metrics.branches),
    functions: metricPercent(metrics.functions),
    lines: metricPercent(metrics.lines),
  };
  const lowest = Math.min(coverage.statements, coverage.branches, coverage.functions, coverage.lines);

  return {
    file: filePath,
    tier,
    coverage,
    status: lowest < GAP_THRESHOLD ? "gap" : "covered",
  };
}

function generateRiskMap({ coverageSummary, revision, lockfileHash, generatedAt }) {
  if (!coverageSummary || typeof coverageSummary !== "object") {
    throw new Error("generateRiskMap requires a coverage-summary.json payload");
  }

  const files = Object.entries(coverageSummary)
    .filter(([key]) => key !== "total")
    .map(([filePath, metrics]) => classifyFile(filePath, metrics))
    .sort((a, b) => a.file.localeCompare(b.file));

  const tier0Gaps = files.filter((entry) => entry.tier === "tier0" && entry.status === "gap");
  const otherGaps = files.filter((entry) => entry.tier !== "tier0" && entry.status === "gap");

  return {
    revision: revision || null,
    lockfileHash: lockfileHash || null,
    generatedAt: generatedAt || null,
    summary: {
      totalFiles: files.length,
      tier0Files: files.filter((entry) => entry.tier === "tier0").length,
      tier0Gaps: tier0Gaps.length,
      otherGaps: otherGaps.length,
    },
    tier0Gaps,
    files,
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hashLockfile(lockfilePath) {
  if (!fs.existsSync(lockfilePath)) {
    return null;
  }
  return crypto.createHash("sha256").update(fs.readFileSync(lockfilePath)).digest("hex");
}

function currentRevision() {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: path.join(__dirname, "..", ".."),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function main() {
  const coverageSummaryPath = path.join(__dirname, "..", "coverage", "coverage-summary.json");
  const coverageSummary = readJsonIfExists(coverageSummaryPath);

  if (!coverageSummary) {
    process.stderr.write(
      `generate-coverage-risk-map: missing ${coverageSummaryPath}. Run "pnpm --filter backend test:coverage" first.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const riskMap = generateRiskMap({
    coverageSummary,
    revision: currentRevision(),
    lockfileHash: hashLockfile(path.join(__dirname, "..", "..", "pnpm-lock.yaml")),
    generatedAt: new Date().toISOString(),
  });

  const outputPath = path.join(__dirname, "..", "coverage", "risk-map.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(riskMap, null, 2)}\n`, "utf8");

  process.stdout.write(
    `Coverage risk map written to ${outputPath} (tier0 gaps: ${riskMap.summary.tier0Gaps}, other gaps: ${riskMap.summary.otherGaps}).\n`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyRiskTier,
  classifyFile,
  generateRiskMap,
};
