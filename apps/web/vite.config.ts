import { resolve } from "node:path";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

import { devRuntimeConfigPlugin } from "./src/config/vite-dev-runtime-config";

const config = defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      enableRouteTreeFormatting: false,
    }),
    devtools({ removeDevtoolsOnBuild: true, consolePiping: { enabled: false } }),
    react(),
    babel({
      plugins: [
        "babel-plugin-react-compiler",
        ["@babel/plugin-proposal-decorators", { version: "2023-11" }],
      ],
    }),
    tailwindcss(),
    visualizer({
      open: process.env.ANALYZE === "true",
      gzipSize: true,
      brotliSize: true,
      filename: "build/stats.html",
    }),
    devRuntimeConfigPlugin(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        redirect: resolve(__dirname, "redirect.html"),
      },
      external: [/\.storybook\//, /\.stories\./, /\.test\./, /\.spec\./],
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }

          // @tanstack/react-store and @tanstack/store also live here — they use React
          // hooks internally and placing them in vendor-router caused a
          // vendor-router ↔ vendor-react circular chunk import.
          if (
            id.includes("react-i18next") ||
            id.includes("@tanstack/react-store") ||
            id.includes("@tanstack/store")
          ) {
            return "vendor-react";
          }

          // TanStack Router (separate from Query — different release cadence + size)
          if (
            id.includes("@tanstack/react-router") ||
            id.includes("@tanstack/router") ||
            id.includes("@tanstack/history")
          ) {
            return "vendor-router";
          }

          // TanStack Query
          if (id.includes("@tanstack/react-query") || id.includes("@tanstack/query-core")) {
            return "vendor-query";
          }

          // Azure auth stack split to keep auth chunks below warning limits
          if (id.includes("@azure/msal-browser")) {
            return "vendor-msal-browser";
          }

          if (id.includes("@azure/msal")) {
            return "vendor-msal-core";
          }

          // i18n stack
          if (id.includes("i18next")) {
            return "vendor-i18n";
          }

          // Radix UI primitives
          if (id.includes("@radix-ui")) {
            return "vendor-ui";
          }

          // Icons
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          // Forms + validation
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("/zod/")) {
            return "vendor-forms";
          }
        },
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});

export default config;
