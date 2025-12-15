/* Inventory v1 (static JSON + modal + setups) */

console.log("inventory.js loaded ✅", location.href);

const state = {
  items: [],
  setups: [],
  filtered: [],
  selectedSetupId: null,
};

function el(id) { return document.getElementById(id); }

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function fmtMoney(purchase) {
  if (!purchase || purchase.price == null) return "";
  const cur = purchase.currency || "";
  const price = Number(purchase.price);
  if (Number.isNaN(price)) return "";
  return `${price.toLocaleString()} ${cur}`.trim();
}

function parseDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}

function itemSearchText(item) {
  const parts = [
    item.name,
    item.brand,
    item.model,
    item.category,
    item.type,
    item.location,
    ...(item.tags || []),
  ];
  return parts.map(safeText).join(" ").toLowerCase();
}

async function loadData() {
  const [itemsRes, setupsRes] = await Promise.all([
    fetch("./data/items.json", { cache: "no-store" }),
    fetch("./data/setups.json", { cache: "no-store" }),
  ]);

  if (!itemsRes.ok) throw new Error("Failed to load items.json");
  if (!setupsRes.ok) throw new Error("Failed to load setups.json");

  state.items = await itemsRes.json();
  state.setups = await setupsRes.json();

  // Normalize
  state.items = state.items.map(it => ({
    quantity: 1,
    tags: [],
    images: [],
    ...it,
    purchase: it.purchase || {},
    specs: it.specs || {},
  }));

  state.filtered = [...state.items];
}

function buildFilters() {
  const categories = uniq(state.items.map(i => i.category));
  const locations = uniq(state.items.map(i => i.location));

  const catSel = el("category");
  const locSel = el("location");

  for (const c of categories) {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    catSel.appendChild(o);
  }

  for (const l of locations) {
    const o = document.createElement("option");
    o.value = l; o.textContent = l;
    locSel.appendChild(o);
  }
}

function applyFilters() {
  const q = el("q").value.trim().toLowerCase();
  const category = el("category").value;
  const location = el("location").value;
  const sort = el("sort").value;

  let list = [...state.items];

  if (q) {
    list = list.filter(it => itemSearchText(it).includes(q));
  }
  if (category) {
    list = list.filter(it => it.category === category);
  }
  if (location) {
    list = list.filter(it => it.location === location);
  }

  // Sorting
  list.sort((a, b) => {
    switch (sort) {
      case "name-desc": return safeText(b.name).localeCompare(safeText(a.name));
      case "date-desc": {
        const da = parseDate(a.purchase?.date);
        const db = parseDate(b.purchase?.date);
        return (db?.getTime() || 0) - (da?.getTime() || 0);
      }
      case "date-asc": {
        const da = parseDate(a.purchase?.date);
        const db = parseDate(b.purchase?.date);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      }
      case "price-desc": return (Number(b.purchase?.price) || 0) - (Number(a.purchase?.price) || 0);
      case "price-asc": return (Number(a.purchase?.price) || 0) - (Number(b.purchase?.price) || 0);
      case "name-asc":
      default: return safeText(a.name).localeCompare(safeText(b.name));
    }
  });

  state.filtered = list;
  renderItems();
}

function renderItems() {
  const wrap = el("items");
  wrap.innerHTML = "";

  el("count").textContent = `${state.filtered.length} item${state.filtered.length === 1 ? "" : "s"}`;

  for (const it of state.filtered) {
    const card = document.createElement("div");
    card.className = "inv-card";
    card.tabIndex = 0;

    const thumbSrc = it.images?.[0] ? it.images[0] : "";
    const subtitleParts = [
      it.brand && it.model ? `${it.brand} ${it.model}` : (it.model || it.brand || ""),
      it.location ? `📍 ${it.location}` : "",
    ].filter(Boolean);

    const money = fmtMoney(it.purchase);
    const date = it.purchase?.date ? it.purchase.date : "";

    card.innerHTML = `
      <div class="inv-card-top">
        ${thumbSrc ? `<img class="inv-thumb" src="${thumbSrc}" alt="">` : `<div class="inv-thumb" aria-hidden="true"></div>`}
        <div>
          <h3>${safeText(it.name)}</h3>
          <p class="inv-sub">${safeText(subtitleParts.join(" • "))}</p>
          <p class="inv-sub">${[money, date].filter(Boolean).join(" • ")}</p>
        </div>
      </div>
      <div class="badges">
        ${it.category ? `<span class="badge">${safeText(it.category)}</span>` : ""}
        ${it.type ? `<span class="badge">${safeText(it.type)}</span>` : ""}
        ${(it.tags || []).slice(0,3).map(t => `<span class="badge">#${safeText(t)}</span>`).join("")}
        ${it.quantity && it.quantity !== 1 ? `<span class="badge">x${it.quantity}</span>` : ""}
      </div>
    `;

    card.addEventListener("click", () => openItemModal(it.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openItemModal(it.id);
    });

    wrap.appendChild(card);
  }
}





function humanKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function renderKVTable(obj) {
  const rows = Object.entries(obj).map(([k, v]) => {
    const val = (v && typeof v === "object") ? JSON.stringify(v) : safeText(v);
    return `
      <tr>
        <td class="spec-k">${humanKey(k)}</td>
        <td class="spec-v">${val}</td>
      </tr>
    `;
  }).join("");

  return `
    <table class="spec-table">
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSpecs(specs) {
  if (!specs || typeof specs !== "object") return "";

  // If specs is nested, render each top-level object as its own section
  const parts = [];

  for (const [sectionKey, sectionVal] of Object.entries(specs)) {
    if (sectionVal == null || sectionVal === "") continue;

    // Simple string/number/bool => show as a 1-row table section
    if (typeof sectionVal !== "object") {
      parts.push(`
        <h4 style="margin: 0.75rem 0 0.25rem;">${humanKey(sectionKey)}</h4>
        ${renderKVTable({ value: sectionVal })}
      `);
      continue;
    }

    // Object => section table
    parts.push(`
      <h4 style="margin: 0.75rem 0 0.25rem;">${humanKey(sectionKey)}</h4>
      ${renderKVTable(sectionVal)}
    `);
  }

  return parts.length ? `<h3>Specs</h3>${parts.join("")}` : "";
}







function openItemModal(itemId) {
  const it = state.items.find(x => x.id === itemId);
  if (!it) return;

  const body = el("modalBody");

  const images = (it.images || []).map(src => `
    <img src="${src}" alt="" style="width:100%; max-height:320px; object-fit:cover; border-radius:12px; margin: 0.5rem 0;">
  `).join("");

  const specsEntries = Object.entries(it.specs || {});
  const specsHtml = renderSpecs(it.specs);


  const tagsHtml = (it.tags && it.tags.length)
    ? `<p class="muted">Tags: ${(it.tags || []).map(t => `#${safeText(t)}`).join(" ")}</p>`
    : "";

  body.innerHTML = `
    <h2 style="margin-top:0;">${safeText(it.name)}</h2>
    <p class="muted" style="margin-top:0.25rem;">
      ${[it.brand, it.model].filter(Boolean).map(safeText).join(" • ")}
    </p>
    ${images}

    <div class="detail-grid">
      <div>
        <h3>Details</h3>
        <ul class="detail-list">
          ${it.category ? `<li><b>Category:</b> ${safeText(it.category)}</li>` : ""}
          ${it.type ? `<li><b>Type:</b> ${safeText(it.type)}</li>` : ""}
          ${it.location ? `<li><b>Location:</b> ${safeText(it.location)}</li>` : ""}
          ${it.quantity != null ? `<li><b>Quantity:</b> ${safeText(it.quantity)}</li>` : ""}
        </ul>
      </div>

      <div>
        <h3>Purchase</h3>
        <ul class="detail-list">
          ${it.purchase?.date ? `<li><b>Date:</b> ${safeText(it.purchase.date)}</li>` : ""}
          ${it.purchase?.price != null ? `<li><b>Price:</b> ${fmtMoney(it.purchase)}</li>` : ""}
          ${it.purchase?.store ? `<li><b>Store:</b> ${safeText(it.purchase.store)}</li>` : ""}
          ${it.purchase?.orderRef ? `<li><b>Order ref:</b> ${safeText(it.purchase.orderRef)}</li>` : ""}
        </ul>
      </div>
    </div>

    ${tagsHtml}

    ${it.notes ? `<h3>Notes</h3><p>${safeText(it.notes)}</p>` : ""}

    ${specsHtml}
  `;

  showModal();
}

function showModal() {
  const modal = el("itemModal");
  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");
}

function hideModal() {
  const modal = el("itemModal");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}

function renderSetups() {
  const wrap = el("setups");
  wrap.innerHTML = "";

  for (const s of state.setups) {
    const card = document.createElement("div");
    card.className = "setup-card";
    if (state.selectedSetupId === s.id) card.classList.add("active");

    card.innerHTML = `
      <h3 style="margin:0;">${safeText(s.name)}</h3>
      <p class="muted" style="margin:0.35rem 0 0;">${safeText(s.description || "")}</p>
      <p class="muted" style="margin:0.4rem 0 0;">${(s.items?.length || 0)} item(s)</p>
    `;

    card.addEventListener("click", () => {
      state.selectedSetupId = s.id;
      renderSetups();
      renderSetupDetail(s.id);
    });

    wrap.appendChild(card);
  }
}

function renderSetupDetail(setupId) {
  const s = state.setups.find(x => x.id === setupId);
  const box = el("setupDetail");
  if (!s) return;

  const items = (s.items || [])
    .map(id => state.items.find(i => i.id === id))
    .filter(Boolean);

  // Group by category for “nice view”
  const groups = new Map();
  for (const it of items) {
    const key = it.category || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  const groupHtml = [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([cat, list]) => {
    return `
      <div style="margin-top: 0.75rem;">
        <h3 style="margin: 0.25rem 0;">${safeText(cat)}</h3>
        <div class="setup-items">
          ${list.map(it => `
            <div class="setup-item-row" data-item="${it.id}">
              <div style="display:flex; gap:0.75rem; align-items:center;">
                ${it.images?.[0] ? `<img class="inv-thumb" src="${it.images[0]}" alt="">` : `<div class="inv-thumb" aria-hidden="true"></div>`}
                <div>
                  <div style="font-weight:700;">${safeText(it.name)}</div>
                  <div class="muted" style="font-size:0.95rem;">
                    ${[it.brand, it.model].filter(Boolean).map(safeText).join(" • ")}
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  box.classList.remove("empty");
  box.innerHTML = `
    <h2 style="margin-top:0;">${safeText(s.name)}</h2>
    <p class="muted" style="margin-top:0.25rem;">${safeText(s.description || "")}</p>
    ${groupHtml || `<p class="muted">No items in this setup yet.</p>`}
  `;

  // Click any setup item to open modal
  box.querySelectorAll("[data-item]").forEach(row => {
    row.addEventListener("click", () => openItemModal(row.getAttribute("data-item")));
  });
}

function wireTabs() {
  const tabs = document.querySelectorAll(".inv-tab");
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".inv-panel").forEach(p => p.classList.remove("active"));

      if (tab === "inventory") el("tab-inventory").classList.add("active");
      if (tab === "setups") el("tab-setups").classList.add("active");
    });
  });
}

function wireControls() {
  el("q").addEventListener("input", applyFilters);
  el("category").addEventListener("change", applyFilters);
  el("location").addEventListener("change", applyFilters);
  el("sort").addEventListener("change", applyFilters);

  el("reset").addEventListener("click", () => {
    el("q").value = "";
    el("category").value = "";
    el("location").value = "";
    el("sort").value = "name-asc";
    applyFilters();
  });
}

function wireModal() {
  el("modalClose").addEventListener("click", hideModal);

  // click outside modal-content closes
  el("itemModal").addEventListener("click", (e) => {
    if (e.target && e.target.id === "itemModal") hideModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideModal();
  });
}

function injectModalTableStyles() {
  // small helper styles scoped to the modal content
  const style = document.createElement("style");
  style.textContent = `
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin: 1rem 0;
    }
    @media (max-width: 800px) { .detail-grid { grid-template-columns: 1fr; } }
    .detail-list { margin: 0.25rem 0 0; padding-left: 1.1rem; }
    .spec-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    .spec-table td { border-top: 1px solid rgba(0,0,0,0.12); padding: 0.5rem 0.25rem; vertical-align: top; }
    .dark-mode .spec-table td { border-top: 1px solid rgba(255,255,255,0.12); }
    .spec-k { width: 36%; opacity: 0.85; font-weight: 700; }
    .spec-v { opacity: 0.95; }
  `;
  document.head.appendChild(style);
}

async function init() {
  injectModalTableStyles();
  wireTabs();
  wireControls();
  wireModal();

  try {
    await loadData();
    buildFilters();
    applyFilters();
    renderSetups();
  } catch (err) {
     console.error(err);

     const msg = (err && err.stack) ? err.stack : String(err);

     el("items").innerHTML = `
       <div class="inv-card">
         <h3>Error loading inventory</h3>
         <pre style="white-space:pre-wrap; font-size:0.85rem; opacity:0.9;">${msg}</pre>
         <p class="muted">Open DevTools → Console/Network for more.</p>
       </div>`;
   }
}

window.addEventListener("DOMContentLoaded", init);
