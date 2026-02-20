/** @type {import('jest').Config} */
module.exports = {
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
      testEnvironment: "node",
      testTimeout: 30000
    }
  ]
};
