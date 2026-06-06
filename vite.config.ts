import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
  },
  plugins: [tsconfigPaths({
    projects: ["./tsconfig.json"],
  }), tailwindcss(), tanstackStart({
    server: {
      entry: "./src/server.ts",
    },
  }), react(), cloudflare({
    viteEnvironment: {
      name: "ssr"
    }
  })],
});