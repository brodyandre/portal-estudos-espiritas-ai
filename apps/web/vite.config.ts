import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRootName = path.basename(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
);

const resolveBase = () => {
  if (process.env.GITHUB_PAGES !== "true") {
    return "/";
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || repoRootName;

  return `/${repositoryName}/`;
};

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  server: {
    port: 5173,
  },
});
