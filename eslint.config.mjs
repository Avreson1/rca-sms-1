import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The realtime-store hydrates many small slices of state from
      // localStorage inside effects (an intentional, well-understood pattern
      // here). Downgraded to warn so `npm run lint` stays actionable; these
      // are performance hints, not correctness bugs.
      "react-hooks/set-state-in-effect": "warn",
      // Legacy store/types code uses `any` in places; migrating the whole
      // store to strict types is tracked separately. New code should avoid it.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
