const { createClient } = require("@supabase/supabase-js");

const CATALOG = {
  "gold-forex": { name: "Gold & Forex Signals", price: 19900 },
  "all-market": { name: "All-Market Signals", price: 29900 },
  "n-kex": { name: "N_KEX EA Access", price: 34900 },
  "ea-suite": { name: "EA Technology Suite", price: 59900 }
};

function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Order database is not configured.");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.send(JSON.stringify(body));
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("Email delivery is not configured.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [to], subject, html })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error("Email provider rejected the message: " + detail.slice(0, 300));
  }
  return response.json();
}
module.exports = { CATALOG, db, json, escapeHtml, sendEmail };