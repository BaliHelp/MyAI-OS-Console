import nextConfig from "eslint-config-next";

// Next 16 removed the `next lint` wrapper (which used to read .eslintrc.json for you) in
// favor of plain ESLint 9 flat config, and there was no eslint.config.js at all — `npm run
// lint` couldn't find any config and failed outright, not degraded linting. eslint-config-next
// already ships a native flat-config array as its default export (Next 13+), so it's used
// directly here rather than adapted through @eslint/eslintrc's FlatCompat, which re-validates
// it against the legacy schema and errors on a circular reference in eslint-plugin-react's
// config object.
const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["db.json"],
  },
];

export default eslintConfig;
