import nextConfig from "eslint-config-next/core-web-vitals";
import tsConfig from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      ".next/**",
      "app/generated/prisma/**",
      "prisma/migrations/**",
      "node_modules/**"
    ],
  },
  ...nextConfig,
  ...tsConfig,
];
