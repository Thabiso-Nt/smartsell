import { createClient } from "@supabase/supabase-js";
import { CONNECTORS } from "../_connectors";
import { encryptCredentials, decryptCredentials } from "../../../../lib/credentialCrypto";

function supabaseForUser(accessToken) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function GET(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
    if (!token) return Response.json({ error: "Not signed in." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const marketplaceId = searchParams.get("marketplaceId");
    const connector = CONNECTORS[marketplaceId];
    if (!connector) return Response.json({ error: "Unknown marketplace." }, { status: 400 });

    const supabase = supabaseForUser(token);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return Response.json({ error: "Not signed in." }, { status: 401 });

    const { data: conn, error: connErr } = await supabase
      .from("marketplace_connections")
      .select("credentials")
      .eq("user_id", userData.user.id)
      .eq("marketplace_id", marketplaceId)
      .single();
    if (connErr || !conn) return Response.json({ error: "Not connected." }, { status: 404 });

    let credentials = decryptCredentials(conn.credentials);
    if (connector.refreshCredentials) {
      const refreshed = await connector.refreshCredentials(credentials);
      if (refreshed) {
        credentials = refreshed;
        await supabase
          .from("marketplace_connections")
          .update({ credentials: encryptCredentials(refreshed) })
          .eq("user_id", userData.user.id)
          .eq("marketplace_id", marketplaceId);
      }
    }

    const orders = await connector.fetchOrders(credentials);
    return Response.json({ orders });
  } catch (e) {
    return Response.json({ error: e.message || "Couldn't fetch orders." }, { status: 502 });
  }
}
