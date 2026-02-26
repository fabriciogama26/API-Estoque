import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
const SUPABASE_ANON_KEY = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();

const supabaseAuth = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const getBearerToken = (req: Request): string => {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/Bearer\s+(.+)/i);
  return match?.[1]?.trim() || "";
};

export const createUserClient = (token: string) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

export const requireAuthUser = async (
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ user: any; token: string } | { response: Response }> => {
  if (!supabaseAuth) {
    return {
      response: new Response("Missing SUPABASE_URL or SUPABASE_ANON_KEY", {
        status: 500,
        headers: corsHeaders,
      }),
    };
  }

  const token = getBearerToken(req);
  if (!token) {
    return {
      response: new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      }),
    };
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    return {
      response: new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      }),
    };
  }

  return { user: data.user, token };
};
