import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type SuggestionPayload = {
  title?: string;
  category_id?: string | null;
  content?: string;
  example?: string | null;
  example2?: string | null;
  suggested_by_name?: string | null;
  suggested_by_email?: string | null;
  turnstileToken?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function normalizeRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim().slice(0, maxLength);
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getSupabaseSecretKey() {
  const directSecretKey =
    Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (directSecretKey) {
    return directSecretKey;
  }

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!secretKeys) {
    return "";
  }

  try {
    const parsedSecretKeys = JSON.parse(secretKeys) as Record<string, string>;
    return parsedSecretKeys.default || Object.values(parsedSecretKeys)[0] || "";
  } catch {
    return "";
  }
}

async function validateTurnstileToken(token: string, request: Request) {
  const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");

  if (!secretKey) {
    throw new Error("TURNSTILE_SECRET_KEY is not configured.");
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (forwardedFor) {
    formData.append("remoteip", forwardedFor);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    body: formData,
    method: "POST"
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return Boolean(result.success);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseSecretKey = getSupabaseSecretKey();

  if (!supabaseUrl || !supabaseSecretKey) {
    return jsonResponse({ error: "Supabase nao configurado na Edge Function." }, 500);
  }

  let payload: SuggestionPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Corpo da requisicao invalido." }, 400);
  }

  const turnstileToken = normalizeRequiredText(payload.turnstileToken, 2048);

  if (!turnstileToken) {
    return jsonResponse({ error: "Verificacao de seguranca ausente." }, 400);
  }

  let isHuman = false;

  try {
    isHuman = await validateTurnstileToken(turnstileToken, request);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Verificacao de seguranca indisponivel." }, 500);
  }

  if (!isHuman) {
    return jsonResponse({ error: "Verificacao de seguranca invalida." }, 403);
  }

  const suggestion = {
    title: normalizeRequiredText(payload.title, 120),
    category_id: normalizeOptionalText(payload.category_id, 80),
    content: normalizeRequiredText(payload.content, 700),
    example: normalizeOptionalText(payload.example, 240),
    example2: normalizeOptionalText(payload.example2, 240),
    suggested_by_name: normalizeOptionalText(payload.suggested_by_name, 120),
    suggested_by_email: normalizeOptionalText(payload.suggested_by_email, 180),
    status: "pending"
  };

  if (!suggestion.title || !suggestion.category_id || !suggestion.content) {
    return jsonResponse({ error: "Titulo, categoria e explicacao sao obrigatorios." }, 400);
  }

  const supabaseClient = createClient(supabaseUrl, supabaseSecretKey);
  const { error } = await supabaseClient.from("tip_suggestions").insert(suggestion);

  if (error) {
    console.error(error);
    return jsonResponse({ error: "Nao foi possivel salvar a sugestao." }, 500);
  }

  return jsonResponse({ ok: true }, 201);
});
