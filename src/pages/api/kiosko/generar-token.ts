// src/pages/api/kiosko/generar-token.ts
import type { APIRoute } from "astro";
import { requireDirectorRole } from "../../../lib/auth";
import * as crypto from "crypto";

// Security configuration: 
// The code changes every 30 seconds to prevent fraudulent reuse.
const INTERVALO_SEGUNDOS = 30;

export const GET: APIRoute = async (context) => {
  // 1. Authorization: Only the director (the kiosk tablet logged in as her) should call this.
  const authResult = await requireDirectorRole(context);
  if ("error" in authResult) return authResult.error;

  const secret = import.meta.env.QR_SECURITY_SECRET || process.env.QR_SECURITY_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: "Servidor no configurado para QRs dinámicos" }), { status: 500 });
  }

  // 2. Cryptographic Logic:
  // We get the current timestamp but round it down to the nearest 30-second interval.
  const roundedTimestamp = Math.floor(Date.now() / 1000 / INTERVALO_SEGUNDOS);

  // We combine the secret master key + the rounded time interval, then create a SHA256 hash.
  // This creates a token that is UNIQUE to this specific 30-second window.
  const token = crypto
    .createHmac("sha256", secret)
    .update(`time_${roundedTimestamp}`)
    .digest("hex");

  // 3. Construct the Scan URL:
  // This is where the teacher's phone camera will point them.
  const baseUrl = new URL(context.request.url).origin;
  const urlParaEscanear = `${baseUrl}/scan?token=${token}`;

  // We return the URL and the remaining seconds for the client-side countdown timer.
  const remainingSeconds = INTERVALO_SEGUNDOS - (Math.floor(Date.now() / 1000) % INTERVALO_SEGUNDOS);

  return new Response(
    JSON.stringify({ 
      urlParaEscanear,
      expires: remainingSeconds
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};