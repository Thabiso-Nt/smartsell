import { createClient } from "@supabase/supabase-js";
import { encryptCredentials } from "../../../../../lib/credentialCrypto";

// Uses the service_role key because this request comes from Mercado Libre's
// redirect, not from a logged-in SmartSell session, so there's no user token
// to act "as". This key is used ONLY in this file and never reaches the browser.
function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // handshake must finish within 10 minutes

export async function GET(request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const fail = (reason) => Response.redirect(`${siteUrl}/?mlConnect=error&reason=${encodeURIComponent(reason)}`);

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) return fail("Missing code or state from Mercado Libre.");

    const supabase = supabaseAdmin();

    const { data: stateRow, error: stateErr } = await supabase
      .from("oauth_states")
      .select("user_id, created_at")
      .eq("state", state)
      .eq("marketplace_id", "mercadolibre")
      .single();
    if (stateErr || !stateRow) return fail("This connection attempt wasn't recognised. Please try again.");

    // State tokens are single-use: delete immediately.
    await supabase.from("oauth_states").delete().eq("state", state);

    if (Date.now() - new Date(stateRow.created_at).getTime() > STATE_MAX_AGE_MS) {
      return fail("This connection attempt expired. Please try again.");
    }

    const redirectUri = `${siteUrl}/api/oauth/mercadolibre/callback`;
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.MERCADOLIBRE_CLIENT_ID,
        client_secret: process.env.MERCADOLIBRE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return fail(tokenData.message || "Mercado Libre rejected the connection.");
    }

    const { error: saveErr } = await supabase.from("marketplace_connections").upsert(
      {
        user_id: stateRow.user_id,
        marketplace_id: "mercadolibre",
        display_name: "Mercado Libre",
        credentials: encryptCredentials({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          seller_id: tokenData.user_id,
        }),
        status: "connected",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marketplace_id" }
    );
    if (saveErr) return fail("Connected, but couldn't save the connection: " + saveErr.message);

    return Response.redirect(`${siteUrl}/?mlConnect=success`);
  } catch (e) {
    return fail(e.message || "Something went wrong connecting Mercado Libre.");
  }
}
