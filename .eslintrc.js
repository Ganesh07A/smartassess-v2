/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ["next/core-web-vitals", "next/typescript"],
  ignorePatterns: [".next/", "app/generated/prisma/", "prisma/migrations/", "node_modules/"],
};
