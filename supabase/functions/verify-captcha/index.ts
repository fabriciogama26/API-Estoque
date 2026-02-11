// Minimal hCaptcha verification function for Supabase Edge Functions (Deno).
// Expects a POST JSON body: { token: string }
// Env vars:
// - HCAPTCHA_SECRET: secret key from hCaptcha (required)
// - HCAPTCHA_SITEKEY: optional, will be sent to verify endpoint if present

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const HCAPTCHA_SECRET = Deno.env.get("HCAPTCHA_SECRET") ?? "";
const HCAPTCHA_SITEKEY = Deno.env.get("HCAPTCHA_SITEKEY") ?? "";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-session-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, reason: "method_not_allowed" }), {
      status: 405,
      headers,
    });
  }

  if (!HCAPTCHA_SECRET) {
    return new Response(JSON.stringify({ success: false, reason: "missing_secret" }), {
      status: 500,
      headers,
    });
  }

  let token = "";
  try {
    const body = await req.json();
    token = (body?.token || "").trim();
  } catch (_err) {
    return new Response(JSON.stringify({ success: false, reason: "invalid_json" }), {
      status: 400,
      headers,
    });
  }

  if (!token) {
    return new Response(JSON.stringify({ success: false, reason: "missing_token" }), {
      status: 400,
      headers,
    });
  }

  const form = new URLSearchParams({ secret: HCAPTCHA_SECRET, response: token });
  if (HCAPTCHA_SITEKEY) {
    form.append("sitekey", HCAPTCHA_SITEKEY);
  }

  const hcResponse = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = await hcResponse.json();
  } catch (_err) {
    // ignore, handled below
  }

  if (!hcResponse.ok || payload?.success !== true) {
    const reason =
      (Array.isArray(payload?.["error-codes"]) && payload?.["error-codes"]?.join?.(",")?.toString()) ||
      payload?.reason ||
      "verification_failed";
    return new Response(JSON.stringify({ success: false, reason }), {
      status: 400,
      headers,
    });
  }

  return new Response(JSON.stringify({ success: true, hostname: payload?.hostname ?? null }), {
    status: 200,
    headers,
  });
});


