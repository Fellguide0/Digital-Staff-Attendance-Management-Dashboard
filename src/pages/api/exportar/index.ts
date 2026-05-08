// src/pages/api/exportar/index.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { requireDirectorRole } from "../../../lib/auth";

export const GET: APIRoute = async (context) => {
  // 1. Verificamos rol
  const authResult = await requireDirectorRole(context);
  if ("error" in authResult) return authResult.error;

  // 2. Leer parámetros de fecha desde la URL (si existen)
  const url = new URL(context.request.url);
  const fechaInicio = url.searchParams.get('inicio');
  const fechaFin = url.searchParams.get('fin');

  // 3. Construimos la consulta base a Supabase
  let query = supabase
    .from('registros')
    .select(`
      timestamp,
      tipo,
      es_tardanza,
      observaciones,
      profesores ( numero_lista, nombre, grado_grupo )
    `)
    .order('timestamp', { ascending: false });

  // 4. Si la directora mandó fechas, aplicamos el filtro
  if (fechaInicio && fechaFin) {
    // Forzamos el uso horario de México (UTC-6) para que tome el día completo
    const inicioAjustado = new Date(`${fechaInicio}T00:00:00.000-06:00`).toISOString();
    const finAjustado = new Date(`${fechaFin}T23:59:59.999-06:00`).toISOString();
    
    query = query.gte('timestamp', inicioAjustado).lte('timestamp', finAjustado);
  }

  const { data, error } = await query;

  if (error || !data) {
    return new Response(JSON.stringify({ error: "Error al generar el reporte" }), { status: 500 });
  }

  // 5. Armamos el Excel
  const cabeceras = "Fecha,Hora,No. Lista,Docente,Grado/Grupo,Movimiento,Estado,Observaciones\n";

  const filas = data.map(r => {
    const fechaObj = new Date(r.timestamp);
    const fecha = fechaObj.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
    const hora = fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
    const prof = r.profesores as any;
    
    const numLista = prof?.numero_lista || '—';
    const nombre = prof?.nombre || 'Desconocido';
    const grupo = prof?.grado_grupo || '—';
    const tipo = r.tipo === 'entrada' ? 'Entrada' : 'Salida';
    const estado = r.es_tardanza ? 'Tardanza' : 'A tiempo';
    
    const obs = r.observaciones ? `"${r.observaciones.replace(/"/g, '""')}"` : '""';

    return `"${fecha}","${hora}","${numLista}","${nombre}","${grupo}","${tipo}","${estado}",${obs}`;
  }).join('\n');

  const csvContent = '\uFEFF' + cabeceras + filas;
  
  // Nombramos el archivo dependiendo de si es por rango o completo
  const nombreArchivo = (fechaInicio && fechaFin) 
    ? `Reporte_Asistencia_${fechaInicio}_al_${fechaFin}.csv` 
    : `Historial_Completo_${new Date().toISOString().split('T')[0]}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`
    }
  });
};