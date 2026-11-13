import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The framework patch introduces this rule for existing HomePageClient
    // restore/refresh effects. Keep the upgrade scoped; review those effects separately.
    files: ["app/HomePageClient.tsx"],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
]);

export default eslintConfig;
