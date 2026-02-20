/** @type {import('jest').Config} */
module.exports = {
  testTimeout: 30000,
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node"
    },
    {
      displayName: "e2e",
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node"
    }
  ]
};
