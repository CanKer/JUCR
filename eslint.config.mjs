import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".nyc_output/**",
      "**/*.cjs"
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "off"
    }
  },
  js.configs.recommended,
  {
    files: ["**/*.cjs"],
    rules: {
      "no-undef": "off"
    }
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
];
