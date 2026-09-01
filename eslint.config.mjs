import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

/** Flat ESLint config for the plain-JS scripts/ + api/ backend. */
export default [
  {
    ignores: ["dist/**", ".vercel/**", ".nitro/**", "node_modules/**", "site/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  prettier,
];
