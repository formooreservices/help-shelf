// netlify/functions/get-order.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const session_id = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!session_id) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing session_id" }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: order } = await supabase
    .from("orders")
    .select("*, products(title)")
    .eq("stripe_payment_id", session_id)
    .single();

  if (!order) {
    // Webhook may not have landed yet — tell the client to retry
    return { statusCode: 202, body: JSON.stringify({ pending: true }) };
  }

  const { data: license } = await supabase
    .from("licenses")
    .select("*")
    .eq("order_id", order.id)
    .single();

  return {
    statusCode: 200,
    body: JSON.stringify({
      product_title: order.products?.title,
      license_key: license?.license_key,
      max_downloads: license?.max_downloads,
      expires_at: license?.expires_at,
    }),
  };
};
