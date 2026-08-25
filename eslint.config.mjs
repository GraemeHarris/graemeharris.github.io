import js from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";

export default [
  js.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        Response: "readonly",
        HTMLInputElement: "readonly",
        Float32Array: "readonly",
        Uint16Array: "readonly",
      },
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".astro/**",
      ".jampack/**",
      ".husky/**",
      ".vscode/**",
      "public/**",
    ],
  },
];
