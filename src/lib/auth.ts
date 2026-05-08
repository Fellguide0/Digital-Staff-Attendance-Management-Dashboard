import type { APIContext } from "astro";

// ============================================================
// lib/auth.ts — Utilidades de autenticación para endpoints API
// ============================================================

/**
 * Verifica si la petición tiene una sesión activa de Clerk.
 * Retorna el clerkUserId si es válido, o un objeto Response (401) si no lo es.
 */
export const requireAuth = async (context: APIContext): Promise<string | Response> => {
  // En Astro, Clerk inyecta la info de sesión en locals
  const auth = context.locals.auth();
  const userId = auth?.userId;

  if (!userId) {
    return new Response(JSON.stringify({ error: "No autorizado. Inicia sesión." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return userId;
};

/**
 * Extrae la IP real del cliente desde los headers.
 * Útil para la auditoría en la base de datos (Supabase).
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // A veces vienen múltiples IPs separadas por coma, tomamos la primera
    return forwardedFor.split(",")[0].trim();
  }
  
  // IP de fallback local si no hay headers proxy
  return "127.0.0.1";
} 

/**
 * Verifica si el usuario tiene sesión activa Y si tiene el rol de "directora".
 * Retorna { userId } si tiene éxito, o { error: Response } si falla.
 */
export const requireDirectorRole = async (context: APIContext) => {
  const auth = context.locals.auth();
  const userId = auth?.userId;
  const sessionClaims = auth?.sessionClaims;

  if (!userId) {
    return { 
      error: new Response(JSON.stringify({ error: "No autorizado. Inicia sesión." }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      }) 
    };
  }

  // Extraemos el rol desde la metadata de Clerk
  const role = (sessionClaims?.publicMetadata as { role?: string })?.role ??
               (sessionClaims?.metadata as { role?: string })?.role;

  if (role !== "directora") {
    return { 
      error: new Response(JSON.stringify({ error: "Acceso denegado. Se requiere rol de directora." }), { 
        status: 403,
        headers: { "Content-Type": "application/json" }
      }) 
    };
  }

  return { userId };
};