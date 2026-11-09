const { db, json } = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const id = String(req.query.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: "Invalid order reference." });
  try {
    const { data, error } = await db().from("orders").select("status,amount_cents,currency").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return json(res, 404, { error: "Order not found." });
    return json(res, 200, data);
  } catch (error) {
    console.error("order-status error:", error.message);
    return json(res, 500, { error: "Unable to check order status." });
  }
};