const crypto = require("node:crypto");
const { CATALOG, db, json } = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  if (process.env.CHECKOUT_ENABLED !== "true") {
    return json(res, 503, { error: "Online checkout is not enabled yet. Please check back soon." });
  }
  if (!process.env.YOCO_SECRET_KEY) return json(res, 503, { error: "Payment configuration is incomplete." });

  try {
    const { customerName, customerEmail, serviceIds, termsAccepted } = req.body || {};
    if (typeof customerName !== "string" || customerName.trim().length < 2 || customerName.length > 100) {
      return json(res, 400, { error: "Enter your full name." });
    }
    const email = String(customerEmail || "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(res, 400, { error: "Enter a valid email address." });
    }
    if (!termsAccepted) return json(res, 400, { error: "Please accept the terms and risk disclosure." });
    if (!Array.isArray(serviceIds) || serviceIds.length < 1 || serviceIds.length > 4 || new Set(serviceIds).size !== serviceIds.length) {
      return json(res, 400, { error: "Select between one and four services." });
    }
    const selected = serviceIds.map(id => CATALOG[id]).filter(Boolean);
    if (selected.length !== serviceIds.length) return json(res, 400, { error: "One or more selected services are unavailable." });
    const amount = selected.reduce((sum, item) => sum + item.price, 0);
    if (amount < 200) return json(res, 400, { error: "The order is below the payment provider minimum." });

    const supabase = db();
    const orderId = crypto.randomUUID();
    const services = serviceIds.map(id => ({ id, name: CATALOG[id].name, price_cents: CATALOG[id].price }));
    const { error: insertError } = await supabase.from("orders").insert({
      id: orderId,
      customer_name: customerName.trim(),
      customer_email: email,
      service_ids: serviceIds,
      services,
      amount_cents: amount,
      currency: "ZAR",
      status: "pending"
    });
    if (insertError) throw insertError;

    const baseUrl = process.env.SITE_URL || "https://" + req.headers.host;
    const payload = {
      amount,
      currency: "ZAR",
      externalId: orderId,
      metadata: { orderId },
      successUrl: baseUrl + "/?payment=returned&order=" + encodeURIComponent(orderId),
      cancelUrl: baseUrl + "/?payment=cancelled",
      failureUrl: baseUrl + "/?payment=failed"
    };
    const yocoResponse = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.YOCO_SECRET_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": orderId
      },
      body: JSON.stringify(payload)
    });
    const checkout = await yocoResponse.json().catch(() => ({}));
    if (!yocoResponse.ok || !checkout.redirectUrl || !checkout.id) {
      await supabase.from("orders").update({ status: "checkout_error" }).eq("id", orderId);
      return json(res, 502, { error: "Yoco could not create the checkout. Please try again." });
    }
    const { error: updateError } = await supabase.from("orders").update({
      yoco_checkout_id: checkout.id
    }).eq("id", orderId);
    if (updateError) throw updateError;
    return json(res, 200, { redirectUrl: checkout.redirectUrl, orderId });
  } catch (error) {
    console.error("create-checkout error:", error.message);
    return json(res, 500, { error: "We could not prepare checkout. Please try again later." });
  }
};