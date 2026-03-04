import eslintJs from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["dist/", "node_modules/", "bun.lock", "curio-agent-sdk-*.tgz"]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tsParser,
      globals: {
        console: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      ...eslintJs.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...prettier.rules,
      "no-console": "off",
      "no-undef": "off"
    }
  }
];

