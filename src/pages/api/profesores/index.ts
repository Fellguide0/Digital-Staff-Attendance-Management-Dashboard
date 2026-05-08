// ============================================================
// pages/api/profesores/index.ts — CRUD de profesores
// ============================================================

import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { requireDirectorRole } from "../../../lib/auth";
import { parseBody, CrearProfesorSchema } from "../../../lib/validators";
import { clerkClient } from "@clerk/astro/server"; // <-- NUEVO: Importamos Clerk

// GET — Listar todos los profesores (SE QUEDA IGUAL)
export const GET: APIRoute = async (context) => {
  const authResult = await requireDirectorRole(context);
  if ("error" in authResult) return authResult.error;

  const { data, error } = await supabase
    .from("profesores")
    .select("id, nombre, numero_lista, grado_grupo, activo, clerk_user_id, created_at")
    .order("numero_lista");

  if (error) {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ profesores: data ?? [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// POST — Crear profesor (MODIFICADO PARA INTEGRAR CLERK)
export const POST: APIRoute = async (context) => {
  const authResult = await requireDirectorRole(context);
  if ("error" in authResult) return authResult.error;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400 });
  }

  const parsed = parseBody(CrearProfesorSchema, body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Datos inválidos", campos: parsed.errors }), { status: 422 });
  }

  try {
    // 1. Crear el usuario en Clerk de forma silenciosa
    const user = await clerkClient(context).users.createUser({
      emailAddress: [parsed.data.email], 
      firstName: parsed.data.nombre.split(' ')[0],
      password: "Password.2026!", // <-- Ponemos una contraseña genérica temporal para que Clerk no lo rebote
      publicMetadata: { role: 'profesor' } 
    });

    // 2. Insertar en Supabase
    const { data, error } = await supabase
      .from("profesores")
      .insert({
        ...parsed.data,
        clerk_user_id: user.id 
      })
      .select("id, nombre, numero_lista, grado_grupo")
      .single();

    // 3. Rollback en caso de fallo en DB
    if (error) {
      await clerkClient(context).users.deleteUser(user.id);
      if (error.code === "23505") {
        return new Response(JSON.stringify({ error: "El número de lista ya está registrado en la base de datos" }), { status: 409 });
      }
      return new Response(JSON.stringify({ error: "Error de base de datos" }), { status: 500 });
    }

    return new Response(JSON.stringify({ profesor: data }), { status: 201 });

  } catch (err: any) {
    // Clerk manda el detalle real del error dentro de un arreglo llamado "errors"
    console.error("[POST Profesor Error]:", JSON.stringify(err.errors || err));
    const detalleClerk = err.errors ? err.errors[0].longMessage : err.message;
    
    return new Response(JSON.stringify({ error: `Clerk dice: ${detalleClerk}` }), { status: 400 });
  }
};

// PATCH — Actualizar profesor (SE QUEDA IGUAL)
export const PATCH: APIRoute = async (context) => {
  const authResult = await requireDirectorRole(context);
  if ("error" in authResult) return authResult.error;

  const profesor_id = context.url.searchParams.get("id");
  if (!profesor_id) {
    return new Response(JSON.stringify({ error: "Falta el ID del profesor" }), { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400 });
  }

  const camposPermitidos = ["nombre", "numero_lista", "grado_grupo", "activo", "clerk_user_id"];
  const actualizacion = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([k]) => camposPermitidos.includes(k))
  );

  if (Object.keys(actualizacion).length === 0) {
    return new Response(JSON.stringify({ error: "No hay campos válidos para actualizar" }), { status: 400 });
  }

  const { data, error } = await supabase
    .from("profesores")
    .update(actualizacion)
    .eq("id", profesor_id)
    .select("id, nombre, numero_lista, grado_grupo, activo")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
  }

  return new Response(JSON.stringify({ profesor: data }), { status: 200 });
};