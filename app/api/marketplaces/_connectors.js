// =============================================================================
// MARKETPLACE CONNECTORS — the generic "plug in any marketplace" architecture.
// -----------------------------------------------------------------------------
// Every marketplace implements the same shape: displayName, testConnection()
// (a real, live check that the credentials actually work — nothing gets
// saved unless this succeeds), and fetchOrders() (a real live data pull).
// Adding a new marketplace later means adding one new entry here — nothing
// else in the app needs to change.
// =============================================================================

export const CONNECTORS = {
  woocommerce: {
    displayName: "WooCommerce",
    async testConnection(credentials) {
      await fetchWooOrders(credentials, 1);
      return true;
    },
    async fetchOrders(credentials) {
      return fetchWooOrders(credentials, 10);
    },
  },

  takealot: {
    displayName: "Takealot",
    // NOTE: Takealot's official API docs block automated access (robots.txt),
    // so this endpoint/header combination is a best-effort implementation
    // based on the actively-maintained community SDK, not independently
    // confirmed against Takealot's live Swagger docs. If this fails, check
    // https://seller-api.takealot.com/api-docs/ for the exact current path
    // and header name, and update the two fetch calls below.
    async testConnection(credentials) {
      await fetchTakealotSales(credentials, 1);
      return true;
    },
    async fetchOrders(credentials) {
      return fetchTakealotSales(credentials, 10);
    },
  },
};

async function fetchWooOrders({ store_url, consumer_key, consumer_secret }, perPage) {
  if (!store_url || !consumer_key || !consumer_secret) {
    throw new Error("Store URL, Consumer Key and Consumer Secret are all required.");
  }
  const base = store_url.replace(/\/$/, "");
  const url = `${base}/wp-json/wc/v3/orders?per_page=${perPage}&consumer_key=${encodeURIComponent(consumer_key)}&consumer_secret=${encodeURIComponent(consumer_secret)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WooCommerce error: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    total: o.total,
    currency: o.currency,
    date: o.date_created,
    customer: `${o.billing?.first_name || ""} ${o.billing?.last_name || ""}`.trim(),
  }));
}

async function fetchTakealotSales({ api_key }, pageSize) {
  if (!api_key) throw new Error("API key is required.");
  const res = await fetch(`https://seller-api.takealot.com/v2/sales?page_size=${pageSize}`, {
    headers: { "X-API-Key": api_key },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Takealot error: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const list = data.sales || data.results || (Array.isArray(data) ? data : []);
  return list.map((s) => ({
    id: s.order_id || s.sale_id || s.id,
    number: s.order_id || s.sale_id,
    status: s.status || s.sale_status,
    total: s.selling_price || s.total,
    currency: "ZAR",
    date: s.sale_date || s.order_date,
    customer: "",
  }));
}
