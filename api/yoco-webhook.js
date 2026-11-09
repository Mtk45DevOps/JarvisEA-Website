const { Webhook } = require("standardwebhooks");
const { db, json, escapeHtml, sendEmail } = require("./_lib");

module.exports.config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  if (!process.env.YOCO_WEBHOOK_SECRET) return json(res, 503, { error: "Webhook is not configured." });

  try {
    const rawBody = await readRawBody(req);
    const headers = {
      "webhook-id": req.headers["webhook-id"],
      "webhook-timestamp": req.headers["webhook-timestamp"],
      "webhook-signature": req.headers["webhook-signature"]
    };
    const verifier = new Webhook(process.env.YOCO_WEBHOOK_SECRET);
    const event = verifier.verify(rawBody, headers);

    if (!event || !event.type || !event.id) return json(res, 400, { error: "Malformed event." });
    if (event.type !== "payment.succeeded" && event.type !== "payment.failed") return json(res, 200, { received: true });

    const payment = event.payload || {};
    const orderId = payment.metadata && payment.metadata.orderId;
    if (!orderId) return json(res, 400, { error: "Missing order reference." });

    const supabase = db();
    const { data: order, error: readError } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (readError) throw readError;
    if (!order) return json(res, 404, { error: "Order not found." });

    if (event.type === "payment.failed") {
      await supabase.from("orders").update({ status: "failed", yoco_payment_id: payment.id || null }).eq("id", orderId).neq("status", "paid");
      return json(res, 200, { received: true });
    }

    const expectedMode = process.env.YOCO_EXPECTED_MODE || "test";
    if (payment.status !== "succeeded" || payment.amount !== order.amount_cents || payment.currency !== "ZAR") {
      console.error("Yoco payment validation mismatch for order", orderId);
      return json(res, 400, { error: "Payment details did not match the order." });
    }
    if (payment.mode && payment.mode !== expectedMode) {
      console.error("Yoco payment mode mismatch:", payment.mode, "expected", expectedMode);
      return json(res, 400, { error: "Payment mode mismatch." });
    }

    if (order.status !== "paid") {
      const { error: paidError } = await supabase.from("orders").update({
        status: "paid",
        yoco_payment_id: payment.id || null,
        paid_at: new Date().toISOString()
      }).eq("id", orderId).neq("status", "paid");
      if (paidError) throw paidError;
    }

    const { data: current, error: currentError } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (currentError) throw currentError;
    const serviceLines = (current.services || []).map(item => "<li>" + escapeHtml(item.name) + " — R" + (item.price_cents / 100).toFixed(2) + "</li>").join("");
    const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
    const customerHtml = "<div style='font-family:Arial,sans-serif;color:#17191e'><h2>Payment confirmed</h2><p>Hi " + escapeHtml(current.customer_name) + ",</p><p>We have verified your LEADFX payment. Your order is now marked as paid.</p><ul>" + serviceLines + "</ul><p><strong>Total: R" + (current.amount_cents / 100).toFixed(2) + "</strong></p><p>Order reference: " + escapeHtml(orderId) + "</p><p>We will follow up with service activation instructions.</p><p>LEADFX Support</p></div>";
    const ownerHtml = "<div style='font-family:Arial,sans-serif;color:#17191e'><h2>New paid LEADFX order</h2><p><strong>Order:</strong> " + escapeHtml(orderId) + "</p><p><strong>Customer:</strong> " + escapeHtml(current.customer_name) + "</p><p><strong>Customer email:</strong> " + escapeHtml(current.customer_email) + "</p><ul>" + serviceLines + "</ul><p><strong>Total paid:</strong> R" + (current.amount_cents / 100).toFixed(2) + "</p><p><strong>Yoco payment ID:</strong> " + escapeHtml(payment.id || "Not supplied") + "</p></div>";

    if (ownerEmail && !current.owner_notified_at) {
      await sendEmail({ to: ownerEmail, subject: "LEADFX — New paid order " + orderId.slice(0, 8), html: ownerHtml });
      await supabase.from("orders").update({ owner_notified_at: new Date().toISOString() }).eq("id", orderId);
    }
    if (!current.customer_notified_at) {
      await sendEmail({ to: current.customer_email, subject: "LEADFX — Payment confirmed", html: customerHtml });
      await supabase.from("orders").update({ customer_notified_at: new Date().toISOString() }).eq("id", orderId);
    }
    return json(res, 200, { received: true });
  } catch (error) {
    console.error("Yoco webhook verification/processing error:", error.message);
    return json(res, 400, { error: "Webhook could not be verified or processed." });
  }
};