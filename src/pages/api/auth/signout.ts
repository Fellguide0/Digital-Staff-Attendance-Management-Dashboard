import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) => {
  return context.redirect("/");
};