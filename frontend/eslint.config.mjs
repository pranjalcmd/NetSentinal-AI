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
    rules: {
      // The backend returns JSON whose shape varies per endpoint — AI reports,
      // pathfinder results, per-detector metadata. Those land as `any` at the
      // client boundary and are narrowed where they are read. Raising it to an
      // error would only push the same looseness behind a cast, so it stays a
      // warning to keep the real errors visible.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
