import { createClient } from "@supabase/supabase-js";
import { CONNECTORS } from "../_connectors";

function supabaseForUser(accessToken) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function POST(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
    if (!token) return Response.json({ error: "Not signed in." }, { status: 401 });

    const { marketplaceId, credentials } = await request.json();
    const connector = CONNECTORS[marketplaceId];
    if (!connector) return Response.json({ error: "Unknown marketplace." }, { status: 400 });

    const supabase = supabaseForUser(token);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return Response.json({ error: "Not signed in." }, { status: 401 });

    // Real, live check — nothing gets saved unless the credentials actually work.
    await connector.testConnection(credentials);

    const { error } = await supabase.from("marketplace_connections").upsert(
      {
        user_id: userData.user.id,
        marketplace_id: marketplaceId,
        display_name: connector.displayName,
        credentials,
        status: "connected",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marketplace_id" }
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message || "Connection failed." }, { status: 400 });
  }
}
