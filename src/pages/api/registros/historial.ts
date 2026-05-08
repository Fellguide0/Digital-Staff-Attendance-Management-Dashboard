// ============================================================
// pages/api/registros/historial.ts — Historial (solo directora)
// ============================================================

import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { requireDirectorRole } from "../../../lib/auth";
import { parseBody, FiltrosHistorialSchema } from "../../../lib/validators";

const PAGE_SIZE = 50;

export const GET: APIRoute = async (context) => {
  // 1. Solo directora puede acceder
  const authResult = await requireDirectorRole(context);
  if ("error" in authResult) return authResult.error;

  // 2. Parsear query params
  const params = Object.fromEntries(context.url.searchParams.entries());
  const parsed = parseBody(FiltrosHistorialSchema, params);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Filtros inválidos", campos: parsed.errors }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { fecha_inicio, fecha_fin, profesor_id, solo_tardanzas, pagina } = parsed.data;

  // 3. Query con filtros — Supabase usa queries parametrizadas,
  //    nunca concatenación de strings → SQL injection imposible
  let query = supabase
    .from("registros")
    .select(
      `
      id,
      tipo,
      timestamp,
      es_tardanza,
      profesores (
        nombre,
        email,
        turno
      )
      `,
      { count: "exact" }
    )
    .order("timestamp", { ascending: false })
    .range((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE - 1);

  // Aplicar filtros opcionales
  if (fecha_inicio) {
    query = query.gte("timestamp", `${fecha_inicio}T00:00:00Z`);
  }
  if (fecha_fin) {
    query = query.lte("timestamp", `${fecha_fin}T23:59:59Z`);
  }
  if (profesor_id) {
    query = query.eq("profesor_id", profesor_id);
  }
  if (solo_tardanzas) {
    query = query.eq("es_tardanza", true);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[historial] Error:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      datos: data,
      paginacion: {
        pagina,
        por_pagina: PAGE_SIZE,
        total: count ?? 0,
        paginas: Math.ceil((count ?? 0) / PAGE_SIZE),
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
