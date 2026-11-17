import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    router: {
      basepath: "/gelismis-kollektor-cizimi1",
    },
    spa: {
      enabled: true,
    },
  },
  vite: {
    base: "/gelismis-kollektor-cizimi1/",
  },
});
