import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  // Test doubles (in-memory fake repositories) are loosely typed on purpose; production code stays strict.
  { files: ["tests/**/*.ts"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
  { ignores: [".next/**", "node_modules/**", "src/generated/**", "next-env.d.ts", "coverage/**"] },
];
export default config;
