import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Scoped, because these rules come from plugins that eslint-config-next
    // registers only for app sources. Left unscoped, any other file type in the
    // tree (a scratch .cjs script, for instance) makes the whole run fail with
    // "could not find plugin react-hooks" instead of reporting anything useful.
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs"],
    rules: {
      // The realtime-store hydrates many small slices of state from
      // localStorage inside effects (an intentional, well-understood pattern
      // here). Downgraded to warn so `npm run lint` stays actionable; these
      // are performance hints, not correctness bugs.
      "react-hooks/set-state-in-effect": "warn",
      // Legacy store/types code uses `any` in places; migrating the whole
      // store to strict types is tracked separately. New code should avoid it.
      "@typescript-eslint/no-explicit-any": "warn",
      // `const { password: _password, ...safe } = account` is how this codebase
      // keeps a secret out of what it returns. The discarded name is the point,
      // so it is not an unused variable.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored second copy of the portal with its own tsconfig/eslint config.
    // Not part of this build; see the matching `exclude` in tsconfig.json.
    "rca-sms/**",
    // Throwaway browser-check scripts written while verifying a fix by hand.
    // Never committed, so they must not join the lint run or the CI gate.
    ".verify/**",
  ]),
]);

export default eslintConfig;
