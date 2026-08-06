// netlify/functions/claim-free.js
const { createClient } = require("@supabase/supabase-js");

function generateLicenseKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `HS-${part()}-${part()}-${part()}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { product_id, buyer_email } = JSON.parse(event.body);
    if (!product_id || !buyer_email) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing product_id or buyer_email" }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .eq("active", true)
      .single();

    if (error || !product) {
      return { statusCode: 404, body: JSON.stringify({ error: "Product not found" }) };
    }
    if (product.price_cents > 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "This product is not free" }) };
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        product_id,
        vendor_id: product.vendor_id,
        buyer_email,
        amount_cents: 0,
        stripe_payment_id: null,
        status: "paid",
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + product.license_days);

    const { data: license, error: licenseErr } = await supabase
      .from("licenses")
      .insert({
        order_id: order.id,
        license_key: generateLicenseKey(),
        max_downloads: product.download_limit,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (licenseErr) throw licenseErr;

    return {
      statusCode: 200,
      body: JSON.stringify({
        license_key: license.license_key,
        max_downloads: license.max_downloads,
        expires_at: license.expires_at,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
