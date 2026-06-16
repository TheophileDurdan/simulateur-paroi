import { defineConfig } from "vite";

/** Nom du dépôt GitHub (utilisé pour le chemin de base sur GitHub Pages). */
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "simulateur-paroi";
const onGitHubPages = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  root: ".",
  base: onGitHubPages ? `/${repoName}/` : "./",
  server: {
    port: 5174,
    open: true,
  },
  preview: {
    port: 4174,
    open: true,
  },
});
