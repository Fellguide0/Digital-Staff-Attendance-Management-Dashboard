import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel/serverless";
import clerk from "@clerk/astro";

export default defineConfig({
  output: "server", // SSR obligatorio — nada se expone al cliente sin pasar por servidor
  adapter: vercel(),
  integrations: [clerk(), react()],
});
