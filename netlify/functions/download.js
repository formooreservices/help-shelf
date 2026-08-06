// netlify/functions/download.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const license_key = event.queryStringParameters && event.queryStringParameters.key;
  if (!license_key) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing license key" }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: license, error } = await supabase
    .from("licenses")
    .select("*, orders(product_id, products(title, storage_bucket, storage_path))")
    .eq("license_key", license_key.trim().toUpperCase())
    .single();

  if (error || !license) {
    return { statusCode: 404, body: JSON.stringify({ error: "License not found. Check your key and try again." }) };
  }

  if (license.revoked) {
    return { statusCode: 403, body: JSON.stringify({ error: "This license has been revoked." }) };
  }

  if (new Date(license.expires_at) < new Date()) {
    return { statusCode: 403, body: JSON.stringify({ error: "This license has expired." }) };
  }

  if (license.download_count >= license.max_downloads) {
    return { statusCode: 403, body: JSON.stringify({ error: "Download limit reached for this license." }) };
  }

  const product = license.orders?.products;
  if (!product || !product.storage_bucket || !product.storage_path) {
    return { statusCode: 404, body: JSON.stringify({ error: "File not found for this product." }) };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(product.storage_bucket)
    .createSignedUrl(product.storage_path, 60); // 60 second link

  if (signErr || !signed) {
    console.error(signErr);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not generate download link." }) };
  }

  await supabase
    .from("licenses")
    .update({ download_count: license.download_count + 1 })
    .eq("id", license.id);

  return {
    statusCode: 200,
    body: JSON.stringify({
      url: signed.signedUrl,
      product_title: product.title,
      downloads_remaining: license.max_downloads - (license.download_count + 1),
    }),
  };
};
