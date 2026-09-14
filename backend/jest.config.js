// Backend unit tests (src/**/__tests__). The rules engine lives in
// @splendor/engine and is tested there; DB-backed flows are covered by the E2E
// suite (test/*.e2e-spec.ts, own config at test/jest-e2e.json).
//
// Coverage is enforced only over the pure / mockable units these tests target
// (security guards & pipes, metrics, the exception filter, the in-memory
// queue). DB-heavy services are deliberately excluded here — their contract is
// verified end-to-end — so the threshold stays honest instead of averaging in
// files this suite can't exercise without a database.
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  passWithNoTests: true,
  collectCoverageFrom: [
    "src/common/cors.ts",
    "src/common/ws-rate-limit.guard.ts",
    "src/common/ws-validation.pipe.ts",
    "src/metrics/metrics.service.ts",
    "src/observability/all-exceptions.filter.ts",
    "src/matchmaking/matchmaking.queue.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 70,
      lines: 85,
      functions: 80,
    },
  },
};
