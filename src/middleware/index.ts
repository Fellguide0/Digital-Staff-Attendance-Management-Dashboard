// ============================================================
// middleware/index.ts — Middleware global de seguridad
// ============================================================

import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";
import { sequence } from "astro:middleware";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/scan(.*)",
  "/api/registros(.*)",
  "/api/profesores(.*)",
]);

const isDirectorRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/profesores(.*)",
  "/api/reportes(.*)",
]);

// ---------------------------------------------------------------
// Helper: leer rol del JWT de Clerk
// Clerk puede exponer la metadata en distintas keys según versión
// ---------------------------------------------------------------
function getRoleFromClaims(sessionClaims: Record<string, unknown> | null | undefined): string | undefined {
  if (!sessionClaims) return undefined;
  return (
    (sessionClaims?.publicMetadata as { role?: string })?.role ??
    (sessionClaims?.metadata as { role?: string })?.role ??
    undefined
  );
}

// ---------------------------------------------------------------
// Rate limiting simple en memoria
// ---------------------------------------------------------------
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// ---------------------------------------------------------------
// Middleware de seguridad HTTP
// ---------------------------------------------------------------
async function securityMiddleware(context: any, next: () => Promise<Response>) {
  const ip =
    context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (context.url.pathname.startsWith("/api/")) {
    if (isRateLimited(ip, 30)) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      });
    }
  }

  const response = await next();
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://clerk.com https://*.clerk.accounts.dev",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // <-- Permiso para Google Fonts
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co https://clerk.com https://*.clerk.accounts.dev",
      "frame-src https://clerk.com https://*.clerk.accounts.dev",
      "font-src 'self' https://fonts.gstatic.com",
      "worker-src 'self' blob:", // <-- Permiso para los procesos de Clerk
    ].join("; ")
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  headers.delete("X-Powered-By");
  headers.delete("Server");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ---------------------------------------------------------------
// Middleware de autenticación con Clerk
// ---------------------------------------------------------------
const authMiddleware = clerkMiddleware((auth, context) => {
  const { userId, sessionClaims } = auth();
  const role = getRoleFromClaims(sessionClaims as Record<string, unknown>);
  

  // 1. Ruta protegida sin sesión → login
  if (isProtectedRoute(context) && !userId) {
    return auth().redirectToSignIn({ returnBackUrl: context.url.pathname });
  }

  // 2. Ruta de directora con sesión pero sin rol → sin-permiso
  //    Solo bloqueamos si tiene sesión pero NO es directora
  //    Así evitamos el loop: no redirigimos si no hay sesión (ya lo maneja el paso 1)
  if (isDirectorRoute(context) && userId && role !== "directora") {
    return Response.redirect(new URL("/sin-permiso", context.url));
  }
});

export const onRequest = sequence(securityMiddleware, authMiddleware);