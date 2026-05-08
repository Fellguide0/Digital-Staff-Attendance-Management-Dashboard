// src/pages/api/registros/checkin.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import * as crypto from "crypto";

export const POST: APIRoute = async (context) => {
  // 1. Verificar sesión
  const userId = context.locals.auth().userId;
  if (!userId) {
    return new Response(JSON.stringify({ error: "No has iniciado sesión." }), { status: 401 });
  }

  // 2. Leer los datos enviados
  const body = await context.request.json();
  const { tipo, token } = body;

  if (!token) {
    return new Response(JSON.stringify({ error: "No se detectó un código de Kiosko válido." }), { status: 400 });
  }

  // 3. Validación criptográfica de los 30 segundos
  const secret = import.meta.env.QR_SECURITY_SECRET || process.env.QR_SECURITY_SECRET;
  const INTERVALO_SEGUNDOS = 30;
  
  // Revisamos la "ventana de tiempo" actual y la inmediatamente anterior (por si el escaneo tardó 1 segundo en llegar)
  const intervaloActual = Math.floor(Date.now() / 1000 / INTERVALO_SEGUNDOS);
  const intervaloAnterior = intervaloActual - 1;

  const tokenActual = crypto.createHmac("sha256", secret!).update(`time_${intervaloActual}`).digest("hex");
  const tokenAnterior = crypto.createHmac("sha256", secret!).update(`time_${intervaloAnterior}`).digest("hex");

  if (token !== tokenActual && token !== tokenAnterior) {
    return new Response(JSON.stringify({ error: "El código QR ha expirado. Vuelve a escanear la pantalla." }), { status: 400 });
  }

  // 4. Todo seguro, se registra en Supabase
  const ipOrigen = context.clientAddress || '0.0.0.0';
  
  const { data: result, error } = await supabase.rpc('registrar_asistencia', {
    p_clerk_user_id: userId,
    p_tipo: tipo,
    p_ip_origen: ipOrigen
  });

  if (error) {
    console.error("Error en Supabase:", error);
    return new Response(JSON.stringify({ error: "Error al guardar en la base de datos." }), { status: 500 });
  }

  if (result && result.ok === false) {
    return new Response(JSON.stringify({ error: result.error }), { status: 400 });
  }

  return new Response(JSON.stringify(result), { status: 200 });
};