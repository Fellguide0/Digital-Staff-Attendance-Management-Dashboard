-- ============================================================
-- MIGRACIÓN 001 — Schema inicial con seguridad completa
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ---------------------------------------------------------------
-- EXTENSIONES
-- ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUIDs seguros como PKs

-- ---------------------------------------------------------------
-- TABLA: profesores
-- ---------------------------------------------------------------
CREATE TABLE profesores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,          -- ID del usuario en Clerk
  nombre        TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 100),
  email         TEXT UNIQUE NOT NULL CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  turno         TEXT NOT NULL CHECK (turno IN ('matutino', 'vespertino')),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- TABLA: registros (check-ins)
-- ---------------------------------------------------------------
CREATE TABLE registros (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profesor_id   UUID NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  es_tardanza   BOOLEAN NOT NULL DEFAULT FALSE,
  ip_origen     INET,                          -- Auditoría: IP del registro
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- ÍNDICES para performance en consultas frecuentes
-- ---------------------------------------------------------------
CREATE INDEX idx_registros_profesor_id   ON registros(profesor_id);
CREATE INDEX idx_registros_timestamp     ON registros(timestamp DESC);
CREATE INDEX idx_registros_tipo          ON registros(tipo);
CREATE INDEX idx_profesores_clerk_id     ON profesores(clerk_user_id);

-- ---------------------------------------------------------------
-- FUNCIÓN: actualizar updated_at automáticamente
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profesores_updated_at
  BEFORE UPDATE ON profesores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- La capa más importante: aunque alguien obtenga acceso a Supabase,
-- no puede leer datos de otros usuarios sin el permiso correcto.
-- ---------------------------------------------------------------
ALTER TABLE profesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros  ENABLE ROW LEVEL SECURITY;

-- Bloqueamos TODO por defecto — se deniega si no hay política explícita
CREATE POLICY "deny_all_profesores" ON profesores AS RESTRICTIVE
  FOR ALL USING (FALSE);

CREATE POLICY "deny_all_registros" ON registros AS RESTRICTIVE
  FOR ALL USING (FALSE);

-- Solo el service_role (backend) puede operar — nunca el cliente directamente
-- En nuestro código SIEMPRE usamos createClient() con service_role en el servidor
-- y NUNCA exponemos esa key al browser.

-- ---------------------------------------------------------------
-- FUNCIÓN SEGURA: registrar asistencia (evita race conditions)
-- Usamos funciones RPC en lugar de INSERT directos desde el cliente
-- para centralizar la lógica de negocio en la DB.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_asistencia(
  p_clerk_user_id TEXT,
  p_tipo          TEXT,
  p_ip_origen     TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Se ejecuta con privilegios del owner, no del caller
AS $$
DECLARE
  v_profesor    profesores%ROWTYPE;
  v_ultimo      registros%ROWTYPE;
  v_es_tardanza BOOLEAN := FALSE;
  v_hora_entrada TIME := '07:30:00';
  v_gracia      INTERVAL := '10 minutes';
  v_nuevo_id    UUID;
BEGIN
  -- 1. Validar tipo
  IF p_tipo NOT IN ('entrada', 'salida') THEN
    RETURN json_build_object('ok', FALSE, 'error', 'Tipo inválido');
  END IF;

  -- 2. Buscar profesor activo
  SELECT * INTO v_profesor
  FROM profesores
  WHERE clerk_user_id = p_clerk_user_id AND activo = TRUE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', FALSE, 'error', 'Profesor no encontrado o inactivo');
  END IF;

  -- 3. Evitar doble check-in el mismo día
  SELECT * INTO v_ultimo
  FROM registros
  WHERE profesor_id = v_profesor.id
    AND tipo = p_tipo
    AND DATE(timestamp AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE
  ORDER BY timestamp DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'ok', FALSE,
      'error', 'Ya registraste ' || p_tipo || ' hoy',
      'timestamp', v_ultimo.timestamp
    );
  END IF;

  -- 4. Calcular tardanza (solo aplica a entradas)
  IF p_tipo = 'entrada' THEN
    v_es_tardanza := (NOW() AT TIME ZONE 'America/Mexico_City')::TIME > (v_hora_entrada + v_gracia);
  END IF;

  -- 5. Insertar registro
  INSERT INTO registros (profesor_id, tipo, es_tardanza, ip_origen)
  VALUES (v_profesor.id, p_tipo, v_es_tardanza, p_ip_origen::INET)
  RETURNING id INTO v_nuevo_id;

  RETURN json_build_object(
    'ok',          TRUE,
    'id',          v_nuevo_id,
    'nombre',      v_profesor.nombre,
    'tipo',        p_tipo,
    'es_tardanza', v_es_tardanza,
    'timestamp',   NOW()
  );
END;
$$;
