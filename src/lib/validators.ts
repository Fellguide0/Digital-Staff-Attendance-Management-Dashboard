// ============================================================
// lib/validators.ts — Validación de inputs con Zod
// ============================================================
// Zod valida Y sanitiza todos los datos antes de tocar la DB.
// Como Supabase usa queries parametrizadas internamente,
// la combinación Zod + Supabase hace SQL injection imposible.
// ============================================================

import { z } from "zod";

// ---------------------------------------------------------------
// Profesor — consistente con la tabla `profesores` en Supabase
// ---------------------------------------------------------------
export const CrearProfesorSchema = z.object({
  nombre: z
    .string()
    .min(2, "El nombre es muy corto")
    .max(100, "El nombre es muy largo")
    .regex(/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s'-]+$/, "El nombre contiene caracteres inválidos")
    .transform((v) => v.trim()),

  email: z
    .string({ required_error: "El correo es obligatorio" })
    .email("Formato de correo institucional inválido")
    .transform((v) => v.toLowerCase().trim()), // Sanitizamos a minúsculas

  turno: z
    .enum(["matutino", "vespertino"], { required_error: "El turno es obligatorio" }),

  numero_lista: z
    .number({ invalid_type_error: "El número de lista debe ser un número" })
    .int("Debe ser un número entero")
    .min(1, "Mínimo 1")
    .max(99, "Máximo 99"),

  grado_grupo: z
    .string()
    .regex(/^[1-6][A-Z]$/, "Formato inválido — debe ser como 3A, 6B"),
});

export const ActualizarProfesorSchema = CrearProfesorSchema.partial().extend({
  activo: z.boolean().optional(),
});

// ---------------------------------------------------------------
// Registro de asistencia
// ---------------------------------------------------------------
export const RegistroSchema = z.object({
  tipo: z.enum(["entrada", "salida"]),
  observaciones: z
    .string()
    .max(500, "Las observaciones son demasiado largas")
    .optional(),
});

// ---------------------------------------------------------------
// Filtros del historial (panel directora)
// ---------------------------------------------------------------
export const FiltrosHistorialSchema = z.object({
  fecha_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),

  fecha_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),

  profesor_id: z
    .string()
    .uuid("ID de profesor inválido")
    .optional(),

  solo_tardanzas: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),

  pagina: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().min(1).max(1000))
    .default("1"),
});

// ---------------------------------------------------------------
// Helper: parsear y retornar error formateado
// ---------------------------------------------------------------
export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.errors.forEach((e) => {
      const field = e.path.join(".");
      errors[field] = e.message;
    });
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}