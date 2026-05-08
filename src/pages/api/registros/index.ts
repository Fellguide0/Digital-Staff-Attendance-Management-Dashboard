// src/pages/api/registros/index.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { requireDirectorRole } from "../../../lib/auth";

export const PATCH: APIRoute = async (context) => {
  // 1. Verificamos que quien intenta modificar la nota sea la directora
  const authResult = await requireDirectorRole(context);
  if ("error" in authResult) return authResult.error;

  // 2. Extraemos el ID del registro de la URL
  const registro_id = context.url.searchParams.get("id");
  if (!registro_id) {
    return new Response(JSON.stringify({ error: "Falta el ID del registro" }), { status: 400 });
  }

  // 3. Leemos el contenido que nos envía el formulario
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Datos inválidos en la petición" }), { status: 400 });
  }

  // 4. Actualizamos únicamente la columna observaciones de ese registro
  const { data, error } = await supabase
    .from("registros")
    .update({ observaciones: body.observaciones })
    .eq("id", registro_id)
    .select()
    .single();

  if (error) {
    console.error("❌ Error Supabase (PATCH Registro):", error);
    return new Response(JSON.stringify({ error: "Error al guardar la nota en la base de datos" }), { status: 500 });
  }

  return new Response(JSON.stringify({ registro: data }), { status: 200 });
};