// src/pages/api/configuracion/index.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { requireDirectorRole } from "../../../lib/auth";

export const PATCH: APIRoute = async (context) => {
  // 1. Verificamos rol
  const authResult = await requireDirectorRole(context);
  if ("error" in authResult) return authResult.error;

  // 2. Leemos la nueva configuración
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
  }

  const { hora_entrada, minutos_tolerancia } = body;

  // 3. Actualizamos la tabla (siempre el id 1)
  const { error } = await supabase
    .from("configuracion")
    .update({ 
      hora_entrada, 
      minutos_tolerancia: parseInt(minutos_tolerancia) 
    })
    .eq("id", 1);

  if (error) {
    console.error("Error actualizando config:", error);
    return new Response(JSON.stringify({ error: "Error al guardar la configuración" }), { status: 500 });
  }

  return new Response(JSON.stringify({ mensaje: "Configuración actualizada" }), { status: 200 });
};