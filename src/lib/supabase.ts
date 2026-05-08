// ============================================================
// lib/supabase.ts — Cliente de Supabase SOLO para el servidor
// ============================================================
// ⚠️  IMPORTANTE: Este archivo NUNCA debe importarse desde
//     componentes de React o scripts del cliente (.client.ts).
//     La SERVICE_ROLE_KEY da acceso total a la DB — si la
//     expones en el browser, cualquiera puede leer/borrar todo.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase. Revisa tu archivo .env.local"
  );
}

// Cliente con service_role — bypasea RLS, solo para operaciones de servidor
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,   // Sin sesión en el servidor
  },
});

// ---------------------------------------------------------------
// Tipos TypeScript derivados del schema
// ---------------------------------------------------------------
export type Profesor = {
  id: string;
  clerk_user_id: string;
  nombre: string;
  email: string;
  turno: "matutino" | "vespertino";
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Registro = {
  id: string;
  profesor_id: string;
  tipo: "entrada" | "salida";
  timestamp: string;
  es_tardanza: boolean;
  ip_origen: string | null;
  created_at: string;
};

export type RegistroConProfesor = Registro & {
  profesores: Pick<Profesor, "nombre" | "email" | "turno">;
};
