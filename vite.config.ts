import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "/gelismis-kollektor-cizimi1/",
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart({
      router: {
        basepath: "/gelismis-kollektor-cizimi1",
      },
      spa: {
        enabled: true,
      },
    }),
    viteReact(),
  ],
});
