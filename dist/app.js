// ============================================================
// CONFIGURÁ ACÁ — lo único que necesitás tocar para tu marca
// ============================================================
const CONFIG = {
  BUSINESS_NAME: "POMALÚ",                      // TODO: poné el nombre de tu marca/negocio
  WHATSAPP_NUMBER: "5491149356044",             // TODO: tu WhatsApp con código de país, sin + ni espacios (ej: 5491122334455)
  ORDER_EMAIL: "guillenofx@gmail.com",          // TODO: email donde querés recibir los pedidos
  PAGE_SIZE: 36,
};
// ============================================================

const state = {
  catalog: null,
  filtered: [],
  visibleCount: CONFIG.PAGE_SIZE,
  cart: {}, // { productId: qty }
};

const $ = (sel) => document.querySelector(sel);
const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");

function loadCart() {
  try {
    const raw = localStorage.getItem("cn_cart");
    state.cart = raw ? JSON.parse(raw) : {};
  } catch (e) { state.cart = {}; }
}
function saveCart() {
  try { localStorage.setItem("cn_cart", JSON.stringify(state.cart)); } catch (e) {}
}

function productById(id) {
  return state.catalog.products.find((p) => p.id === id);
}

async function init() {
  loadCart();
  $("#brandName").textContent = CONFIG.BUSINESS_NAME;
  const res = await fetch("catalog.json");
  state.catalog = await res.json();

  const sel = $("#categorySelect");
  state.catalog.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.slug;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });

  $("#minOrderBanner").textContent =
    `Pedido mínimo sugerido: ${money(state.catalog.min_order_suggested)} + IVA (condición mayorista)`;

  applyFilters();
  renderCartUI();

  $("#searchInput").addEventListener("input", debounce(() => { state.visibleCount = CONFIG.PAGE_SIZE; applyFilters(); }, 200));
  sel.addEventListener("change", () => { state.visibleCount = CONFIG.PAGE_SIZE; applyFilters(); });
  $("#loadMoreBtn").addEventListener("click", () => { state.visibleCount += CONFIG.PAGE_SIZE; renderGrid(); });

  $("#cartBtn").addEventListener("click", openCart);
  $("#closeCartBtn").addEventListener("click", closeCart);
  $("#overlay").addEventListener("click", closeCart);
  $("#resetCartBtn").addEventListener("click", resetCart);
  $("#goCheckoutBtn").addEventListener("click", openCheckout);
  $("#closeCheckoutBtn").addEventListener("click", closeCheckout);
  $("#checkoutOverlay").addEventListener("click", (e) => { if (e.target.id === "checkoutOverlay") closeCheckout(); });
  $("#checkoutForm").addEventListener("submit", onCheckoutSubmit);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function applyFilters() {
  const q = $("#searchInput").value.trim().toLowerCase();
  const cat = $("#categorySelect").value;
  state.filtered = state.catalog.products.filter((p) => {
    if (cat && p.cat !== cat) return false;
    if (!q) return true;
    return p.desc.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });
  $("#resultsInfo").textContent = `${state.filtered.length} productos`;
  renderGrid();
}

function renderGrid() {
  const grid = $("#grid");
  const slice = state.filtered.slice(0, state.visibleCount);
  grid.innerHTML = slice.map(cardHTML).join("");
  $("#emptyState").hidden = state.filtered.length > 0;
  $("#loadMoreBtn").hidden = state.visibleCount >= state.filtered.length;

  grid.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.add);
      const input = grid.querySelector(`[data-qty="${id}"]`);
      const qty = Math.max(1, parseInt(input.value, 10) || 1);
      addToCart(id, qty);
    });
  });
  grid.querySelectorAll("[data-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.step;
      const dir = Number(btn.dataset.dir);
      const input = grid.querySelector(`[data-qty="${id}"]`);
      input.value = Math.max(1, (parseInt(input.value, 10) || 1) + dir);
    });
  });
}

function cardHTML(p) {
  const inCart = !!state.cart[p.id];
  const img = p.img
    ? `<img src="images/${p.img}" loading="lazy" alt="${escapeHTML(p.desc)}">`
    : `<div class="card-noimg">Sin foto<br>disponible</div>`;
  return `
  <div class="card">
    <div class="card-img">${img}</div>
    <div class="card-body">
      <div class="card-code">${escapeHTML(p.code)}</div>
      <div class="card-desc">${escapeHTML(p.desc)}</div>
      <div class="card-price">${money(p.price)}</div>
      <div class="qty-row">
        <button class="qty-btn" data-step="${p.id}" data-dir="-1" type="button">−</button>
        <input class="qty-input" type="number" min="1" value="1" data-qty="${p.id}">
        <button class="qty-btn" data-step="${p.id}" data-dir="1" type="button">+</button>
      </div>
      <button class="add-btn ${inCart ? "in-cart" : ""}" data-add="${p.id}" type="button">
        ${inCart ? "✓ En el pedido — agregar más" : "Agregar al pedido"}
      </button>
    </div>
  </div>`;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function addToCart(id, qty) {
  state.cart[id] = (state.cart[id] || 0) + qty;
  saveCart();
  renderCartUI();
  renderGrid();
  showToast("Agregado al pedido");
}

function setQty(id, qty) {
  if (qty <= 0) { delete state.cart[id]; }
  else { state.cart[id] = qty; }
  saveCart();
  renderCartUI();
}

function resetCart() {
  if (cartEntries().length === 0) return;
  if (!confirm("¿Vaciar todo el pedido? Esta acción no se puede deshacer.")) return;
  state.cart = {};
  saveCart();
  renderCartUI();
  renderGrid();
  showToast("Pedido vaciado");
}

function cartEntries() {
  return Object.entries(state.cart)
    .map(([id, qty]) => ({ p: productById(Number(id)), qty }))
    .filter((e) => e.p);
}

function cartTotal() {
  return cartEntries().reduce((sum, e) => sum + e.p.price * e.qty, 0);
}

function renderCartUI() {
  const entries = cartEntries();
  const count = entries.reduce((s, e) => s + e.qty, 0);
  $("#cartCount").textContent = count;
  $("#cartHeaderTotal").textContent = money(cartTotal());

  const itemsEl = $("#cartItems");
  if (entries.length === 0) {
    itemsEl.innerHTML = `<p style="color:#6b7280;padding:20px 0;text-align:center">Todavía no agregaste productos.</p>`;
  } else {
    itemsEl.innerHTML = entries.map(({ p, qty }) => `
      <div class="cart-item">
        ${p.img ? `<img src="images/${p.img}" alt="">` : `<div style="width:52px;height:52px;background:#f1f2f4;border-radius:8px"></div>`}
        <div class="cart-item-info">
          <div class="cart-item-desc">${escapeHTML(p.desc)}</div>
          <div class="cart-item-price">${money(p.price)} c/u</div>
          <div class="cart-item-actions">
            <button class="qty-btn" data-cstep="${p.id}" data-dir="-1" type="button">−</button>
            <input class="qty-input" type="number" min="1" value="${qty}" data-cqty="${p.id}">
            <button class="qty-btn" data-cstep="${p.id}" data-dir="1" type="button">+</button>
            <button class="remove-link" data-remove="${p.id}" type="button">Quitar</button>
          </div>
        </div>
        <div style="font-weight:700;white-space:nowrap">${money(p.price * qty)}</div>
      </div>`).join("");

    itemsEl.querySelectorAll("[data-cstep]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.cstep);
        const dir = Number(btn.dataset.dir);
        setQty(id, (state.cart[id] || 0) + dir);
        renderCartUI(); renderGrid();
      });
    });
    itemsEl.querySelectorAll("[data-cqty]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const id = Number(inp.dataset.cqty);
        setQty(id, Math.max(1, parseInt(inp.value, 10) || 1));
        renderCartUI(); renderGrid();
      });
    });
    itemsEl.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setQty(Number(btn.dataset.remove), 0);
        renderCartUI(); renderGrid();
      });
    });
  }

  const total = cartTotal();
  const min = state.catalog ? state.catalog.min_order_suggested : 0;
  let warn = "";
  if (min && total < min) {
    warn = `<div class="cart-warning">Todavía estás por debajo del pedido mínimo sugerido (${money(min)} + IVA). Podés seguir agregando productos.</div>`;
  }
  $("#cartSummary").innerHTML = `${warn}<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${money(total)}</span></div><div style="font-size:.72rem;font-weight:400;color:#6b7280">+ IVA — precios sujetos a confirmación</div>`;
}

function openCart() {
  $("#cartDrawer").classList.add("open");
  $("#overlay").classList.add("open");
}
function closeCart() {
  $("#cartDrawer").classList.remove("open");
  $("#overlay").classList.remove("open");
}

function openCheckout() {
  if (cartEntries().length === 0) { showToast("Agregá productos antes de continuar"); return; }
  closeCart();
  $("#checkoutSummary").innerHTML = cartEntries()
    .map((e) => `${e.qty} × ${escapeHTML(e.p.code)}`).join("<br>") +
    `<br><strong>Total: ${money(cartTotal())} + IVA</strong>`;
  $("#checkoutOverlay").classList.add("open");
}
function closeCheckout() {
  $("#checkoutOverlay").classList.remove("open");
}

function buildOrderText(data) {
  const lines = [];
  lines.push(`Pedido — ${CONFIG.BUSINESS_NAME}`);
  lines.push(`Cliente: ${data.nombre}`);
  if (data.negocio) lines.push(`Negocio: ${data.negocio}`);
  lines.push(`Localidad: ${data.localidad}`);
  lines.push(`Teléfono: ${data.telefono}`);
  if (data.email) lines.push(`Email: ${data.email}`);
  lines.push("");
  lines.push("Productos:");
  cartEntries().forEach((e) => {
    lines.push(`- ${e.qty} x ${e.p.code} — ${e.p.desc} — ${money(e.p.price)} c/u — ${money(e.p.price * e.qty)}`);
  });
  lines.push("");
  lines.push(`TOTAL: ${money(cartTotal())} + IVA`);
  if (data.comentario) { lines.push(""); lines.push(`Comentario: ${data.comentario}`); }
  return lines.join("\n");
}

function onCheckoutSubmit(e) {
  e.preventDefault();
  const submitter = e.submitter;
  const via = submitter ? submitter.value : "whatsapp";
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const text = buildOrderText(data);

  if (via === "whatsapp") {
    const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  } else {
    const subject = encodeURIComponent(`Pedido — ${data.nombre}`);
    const body = encodeURIComponent(text);
    window.location.href = `mailto:${CONFIG.ORDER_EMAIL}?subject=${subject}&body=${body}`;
  }
}

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

init();
