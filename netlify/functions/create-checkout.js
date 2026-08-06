// netlify/functions/create-checkout.js
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

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
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .eq("active", true)
      .single();

    if (error || !product) {
      return { statusCode: 404, body: JSON.stringify({ error: "Product not found" }) };
    }

    if (product.is_service) {
      return { statusCode: 400, body: JSON.stringify({ error: "This product is a service request, not a checkout item" }) };
    }

    if (product.price_cents <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Free products should not go through checkout" }) };
    }

    const siteUrl = process.env.URL || "https://help-shelf.netlify.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: buyer_email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: product.title },
            unit_amount: product.price_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        product_id: product.id,
        vendor_id: product.vendor_id,
        buyer_email: buyer_email,
      },
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
