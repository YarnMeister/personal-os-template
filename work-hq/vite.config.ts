import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// Local-only Work HQ (ADR-P6-001/ADR-P6-006): plain Vite + TanStack Start, no
// hosting target. Mirrors the proven claude-agents cockpit config.
export default defineConfig({
  plugins: [
    // TanStack Start bundles file-based router generation + the nitro server build.
    // Redirect the bundled server entry to src/server.ts (our SSR error wrapper).
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    // The Work HQ reads OS state from the workspace root (../) — markdown files
    // and docs/data JSON — once the file-backed loaders land (ADR-P6-002).
    fs: { allow: [".."] },
  },
});
