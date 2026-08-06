// netlify/functions/stripe-webhook.js
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

function generateLicenseKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars
  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `HS-${part()}-${part()}-${part()}`;
}

exports.handler = async (event) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers["stripe-signature"];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "Ignored" };
  }

  const session = stripeEvent.data.object;
  const { product_id, vendor_id, buyer_email } = session.metadata;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: product } = await supabase.from("products").select("*").eq("id", product_id).single();
    if (!product) throw new Error("Product not found for webhook order");

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        product_id,
        vendor_id,
        buyer_email,
        amount_cents: session.amount_total,
        stripe_payment_id: session.id,
        status: "paid",
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + product.license_days);

    const { error: licenseErr } = await supabase.from("licenses").insert({
      order_id: order.id,
      license_key: generateLicenseKey(),
      max_downloads: product.download_limit,
      expires_at: expiresAt.toISOString(),
    });

    if (licenseErr) throw licenseErr;

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Failed to process webhook", err);
    return { statusCode: 500, body: "Internal error" };
  }
};
