const CATALOG = {
  "gold-forex": { name: "Gold & Forex Signals", price: 199 },
  "all-market": { name: "All-Market Signals", price: 299 },
  "n-kex": { name: "N_KEX EA Access", price: 349 },
  "ea-suite": { name: "EA Technology Suite", price: 599 }
};
const cart = new Set();
const money = value => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const payButton = document.getElementById("payButton");
const toast = document.getElementById("toast");
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function renderCart() {
  cartItems.replaceChildren();
  let total = 0;
  if (!cart.size) {
    const empty = document.createElement("div");
    empty.className = "empty-cart";
    empty.append("Your selection is empty.");
    const small = document.createElement("small");
    small.textContent = "Add a service to get started.";
    empty.append(document.createElement("br"), small);
    cartItems.append(empty);
  } else {
    for (const id of cart) {
      const item = CATALOG[id];
      total += item.price;
      const row = document.createElement("div");
      row.className = "cart-item";
      const name = document.createElement("span");
      name.textContent = item.name;
      const price = document.createElement("strong");
      price.textContent = money(item.price);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + item.name);
      remove.textContent = "×";
      remove.addEventListener("click", () => { cart.delete(id); renderCart(); });
      row.append(name, price, remove);
      cartItems.append(row);
    }
  }
  cartTotal.textContent = money(total);
  payButton.disabled = cart.size === 0;
  document.querySelectorAll("[data-add]").forEach(button => {
    const active = cart.has(button.dataset.add);
    button.classList.toggle("selected", active);
    button.querySelector("span").textContent = active ? "✓" : "+";
    button.firstChild.textContent = active ? "Added to selection " : "Add to selection ";
  });
}
document.querySelectorAll("[data-add]").forEach(button => {
  button.addEventListener("click", () => {
    const id = button.dataset.add;
    if (cart.has(id)) cart.delete(id); else cart.add(id);
    renderCart();
    document.getElementById("checkout").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
});

document.getElementById("checkoutForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!cart.size) return notify("Choose at least one service first.");
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const accepted = document.getElementById("termsAccepted").checked;
  if (!accepted) return notify("Please accept the terms and risk disclosure.");
  payButton.disabled = true;
  payButton.textContent = "Preparing secure checkout…";
  try {
    const response = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: document.getElementById("customerName").value.trim(),
        customerEmail: document.getElementById("customerEmail").value.trim(),
        serviceIds: [...cart],
        termsAccepted: accepted
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Checkout is not available yet. Please try again later.");
    if (!data.redirectUrl || !data.redirectUrl.startsWith("https://")) throw new Error("The payment provider did not return a valid checkout link.");
    window.location.assign(data.redirectUrl);
  } catch (error) {
    notify(error.message);
    payButton.disabled = false;
    payButton.innerHTML = 'Continue to secure payment <span>↗</span>';
  }
});

const mobileMenu = document.getElementById("mobileMenu");
mobileMenu.addEventListener("click", () => document.querySelector(".desktop-nav").classList.toggle("open"));
document.querySelectorAll(".desktop-nav a").forEach(link => link.addEventListener("click", () => document.querySelector(".desktop-nav").classList.remove("open")));
document.getElementById("year").textContent = new Date().getFullYear();

const params = new URLSearchParams(window.location.search);
if (params.get("payment") === "returned" && params.get("order")) {
  const orderId = params.get("order");
  notify("Payment returned. Verifying securely with Yoco…");
  pollOrder(orderId);
}
async function pollOrder(orderId) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch("/api/order-status?id=" + encodeURIComponent(orderId), { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "paid") {
          notify("Payment verified. Your confirmation email is on its way.");
          return;
        }
        if (data.status === "failed") {
          notify("The payment was not completed. You can try again.");
          return;
        }
      }
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  notify("Payment verification is still processing. Please check your email before trying again.");
}
renderCart();