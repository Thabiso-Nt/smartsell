import { createClient } from "@supabase/supabase-js";

function supabaseForUser(accessToken) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Mercado Libre operates separate national sites, each with its own
// authorization domain. The token exchange endpoint is shared across all of them.
const ML_SITES = {
  Argentina: "mercadolibre.com.ar",
  Brazil: "mercadolivre.com.br",
  Mexico: "mercadolibre.com.mx",
  Colombia: "mercadolibre.com.co",
  Chile: "mercadolibre.cl",
  Uruguay: "mercadolibre.com.uy",
  Peru: "mercadolibre.com.pe",
};

export async function GET(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
    if (!token) return Response.json({ error: "Not signed in." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const site = searchParams.get("site") || "Argentina";
    const domain = ML_SITES[site] || ML_SITES["Argentina"];

    const supabase = supabaseForUser(token);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return Response.json({ error: "Not signed in." }, { status: 401 });

    const state = crypto.randomUUID();
    const { error } = await supabase.from("oauth_states").insert({ state, user_id: userData.user.id, marketplace_id: "mercadolibre" });
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/oauth/mercadolibre/callback`;
    const authUrl = `https://auth.${domain}/authorization?response_type=code&client_id=${process.env.MERCADOLIBRE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return Response.json({ authUrl });
  } catch (e) {
    return Response.json({ error: e.message || "Couldn't start connection." }, { status: 500 });
  }
}
