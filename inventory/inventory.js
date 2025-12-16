/* Inventory v1 (static JSON + modal + setups) */

console.log("inventory.js loaded ✅", location.href);

const state = {
  items: [],
  setups: [],
  filtered: [],
  selectedSetupId: null,
  activeOrderId: null,
};

state.page = 1;
state.pageSize = 48;



// localStorage key
inventoryViews = {
  "Unpainted minis": {
    category: "Warhammer",
    buildStatus: "",
    paintStatus: "unpainted",
    location: "",
    q: ""
  },
  "Desk setup": {
    category: "PC Setup",
    location: "Home office"
  }
}

function getViews() {
  return JSON.parse(localStorage.getItem("inventoryViews") || "{}");
}

function setViews(v) {
  localStorage.setItem("inventoryViews", JSON.stringify(v));
}





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
  const build = el("buildStatus") ? el("buildStatus").value : "";
  const paint = el("paintStatus") ? el("paintStatus").value : "";
  const sort = el("sort").value;

  let list = [...state.items];

  // If an order filter is active, only show items from that order
  if (state.activeOrderId) {
    list = list.filter(it => getOrderId(it) === state.activeOrderId);
  }

  if (q) {
    list = list.filter(it => itemSearchText(it).includes(q));
  }
  if (category) {
    list = list.filter(it => it.category === category);
  }
  if (location) {
    list = list.filter(it => it.location === location);
  }
  if (build) {
  list = list.filter(it => (it.specs && it.specs.buildStatus) === build);
  }
  if (paint) {
    list = list.filter(it => (it.specs && it.specs.paintStatus) === paint);
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


  state.page = 1;
  
  state.filtered = list;
  renderItems();
}


function renderViews() {
  const sel = el("savedViews");
  sel.innerHTML = `<option value="">Saved views…</option>`;
  const views = getViews();
  Object.keys(views).forEach(name => {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  });
}

el("savedViews").addEventListener("change", () => {
  const name = el("savedViews").value;
  if (!name) return;

  const view = getViews()[name];
  if (!view) return;

  if (view.q !== undefined) el("q").value = view.q;
  if (view.category !== undefined) el("category").value = view.category;
  if (view.location !== undefined) el("location").value = view.location;
  if (view.buildStatus !== undefined) el("buildStatus").value = view.buildStatus;
  if (view.paintStatus !== undefined) el("paintStatus").value = view.paintStatus;

  state.activeOrderId = null;
  applyFilters();
});

el("saveView").addEventListener("click", () => {
  const name = prompt("Name this view:");
  if (!name) return;

  const views = getViews();
  views[name] = {
    q: el("q").value,
    category: el("category").value,
    location: el("location").value,
    buildStatus: el("buildStatus").value,
    paintStatus: el("paintStatus").value
  };

  setViews(views);
  renderViews();
});

el("deleteView").addEventListener("click", () => {
  const name = el("savedViews").value;
  if (!name) return;
  if (!confirm(`Delete view "${name}"?`)) return;

  const views = getViews();
  delete views[name];
  setViews(views);
  renderViews();
});

renderViews();




el("exportCsv").addEventListener("click", () => {
  const rows = state.filtered.map(it => ({
    id: it.id,
    name: it.name,
    category: it.category,
    type: it.type,
    quantity: it.quantity,
    location: it.location,
    buildStatus: it.specs?.buildStatus || "",
    paintStatus: it.specs?.paintStatus || "",
    price: it.purchase?.price || "",
    date: it.purchase?.date || ""
  }));

  const csv = [
    Object.keys(rows[0]).join(","),
    ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "inventory-export.csv";
  a.click();
});




function renderItems() {
  const wrap = el("items");
  wrap.innerHTML = "";

  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * state.pageSize;
  const end = start + state.pageSize;
  const pageItems = state.filtered.slice(start, end);

  const orderTag = state.activeOrderId ? ` • Order: ${state.activeOrderId}` : "";
  el("count").textContent = `${total} item${total === 1 ? "" : "s"}${orderTag}`;
  el("pageInfo").textContent = `Page ${state.page} / ${totalPages}`;


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

    const isMini = it.type === "miniatures";
    const buildStatus = isMini && it.specs && it.specs.buildStatus ? it.specs.buildStatus : "";
    const paintStatus = isMini && it.specs && it.specs.paintStatus ? it.specs.paintStatus : "";

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
        ${buildStatus ? `<span class="badge">🧩 ${safeText(buildStatus)}</span>` : ""}
        ${paintStatus ? `<span class="badge">🎨 ${safeText(paintStatus)}</span>` : ""}
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

function slugifySpecId(key) {
  return "spec-" + String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}





function renderSpecs(specs) {
  if (!specs || typeof specs !== "object") return "";

  const entries = Object.entries(specs).filter(([_, v]) => v != null && v !== "");

  // Build TOC from top-level spec sections
  const tocItems = entries.map(([sectionKey, sectionVal]) => {
    // Only include "real" sections in the TOC
    const hasContent =
      typeof sectionVal !== "object" ? true : Object.keys(sectionVal || {}).length > 0;

    if (!hasContent) return null;

    const id = slugifySpecId(sectionKey);
    return `<a class="spec-toc-link" href="#${id}">${humanKey(sectionKey)}</a>`;
  }).filter(Boolean);

  const tocHtml = tocItems.length
    ? `
      <div class="spec-toc">
        <div class="spec-toc-title">Specs</div>
        <div class="spec-toc-links">
          ${tocItems.join("")}
        </div>
      </div>
    `
    : "";

  // Render each top-level section with an anchor id
  const sectionsHtml = entries.map(([sectionKey, sectionVal]) => {
    const id = slugifySpecId(sectionKey);

    if (typeof sectionVal !== "object") {
      return `
        <h4 id="${id}" class="spec-section-title">${humanKey(sectionKey)}</h4>
        ${renderKVTable({ value: sectionVal })}
      `;
    }

    return `
      <h4 id="${id}" class="spec-section-title">${humanKey(sectionKey)}</h4>
      ${renderKVTable(sectionVal)}
    `;
  }).join("");

  if (!sectionsHtml) return "";

  return `
    ${tocHtml}
    <div class="spec-sections">
      ${sectionsHtml}
    </div>
  `;
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




function getOrderId(item) {
  // supports either top-level orderId or nested inside purchase
  return item.orderId || (item.purchase && item.purchase.orderId) || "";
}

function renderOrders() {
  const wrap = el("orders");
  if (!wrap) return;
  wrap.innerHTML = "";

  // Group items by orderId
  const map = new Map();
  for (const it of state.items) {
    const oid = getOrderId(it);
    if (!oid) continue;
    if (!map.has(oid)) map.set(oid, []);
    map.get(oid).push(it);
  }

  const orders = [...map.entries()]
    .map(([orderId, items]) => {
      const first = items[0] || {};
      const purchase = first.purchase || {};
      const store = purchase.store || "Unknown store";
      const date = purchase.date || "";
      const orderRef = purchase.orderRef || "";

      // Sum prices if they are numeric
      const total = items.reduce((sum, it) => {
        const p = it.purchase && it.purchase.price;
        const n = typeof p === "number" ? p : Number(p);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      const currency = (purchase.currency || "SEK");

      return { orderId, store, date, orderRef, total, currency, items };
    })
    .sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));

  if (!orders.length) {
    wrap.innerHTML = `<div class="inv-card"><h3>No orders yet</h3><p class="muted">Add orderId to items to group them.</p></div>`;
    return;
  }

  for (const o of orders) {
    const card = document.createElement("div");
    card.className = "inv-card";
    card.tabIndex = 0;

    card.innerHTML = `
      <h3 style="margin:0;">${safeText(o.store)}${o.orderRef ? ` • ${safeText(o.orderRef)}` : ""}</h3>
      <p class="inv-sub">${safeText(o.date)} • ${o.items.length} item(s)</p>
      <p class="inv-sub">${o.total ? `${o.total.toLocaleString()} ${safeText(o.currency)}` : ""}</p>
      <div class="badges">
        <span class="badge">${safeText(o.orderId)}</span>
      </div>
    `;

    card.addEventListener("click", () => openOrderModal(o));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openOrderModal(o);
    });

    wrap.appendChild(card);
  }
}

function openOrderModal(order) {
  const body = el("modalBody");
  body.innerHTML = `
    <h2 style="margin-top:0;">${safeText(order.store)}${order.orderRef ? ` • ${safeText(order.orderRef)}` : ""}</h2>
    <p class="muted" style="margin-top:0.25rem;">${safeText(order.date)} • ${order.items.length} item(s)</p>
    <p class="muted">${order.total ? `Total: ${order.total.toLocaleString()} ${safeText(order.currency)}` : ""}</p>

    <button id="filterByOrder" class="inv-btn" style="margin: 0.5rem 0 1rem;">
      Filter inventory by this order
    </button>

    <h3>Items</h3>
    <div class="setup-items">
      ${order.items.map(it => `
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
  `;

  const btn = document.getElementById("filterByOrder");
    if (btn) {
      btn.addEventListener("click", () => {
        state.activeOrderId = order.orderId;
        hideModal();
        switchTab("inventory");
        applyFilters();
      });
    }

  // Click any row -> open item modal
  body.querySelectorAll("[data-item]").forEach(row => {
    row.addEventListener("click", () => openItemModal(row.getAttribute("data-item")));
  });

  showModal();
}






function switchTab(tabName) {
  document.querySelectorAll(".inv-tab").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`.inv-tab[data-tab="${tabName}"]`);
  if (btn) btn.classList.add("active");

  document.querySelectorAll(".inv-panel").forEach(p => p.classList.remove("active"));

  if (tabName === "inventory") el("tab-inventory").classList.add("active");
  if (tabName === "setups") el("tab-setups").classList.add("active");
  if (tabName === "orders") el("tab-orders").classList.add("active");
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
      if (tab === "orders") el("tab-orders").classList.add("active");
    });
  });
}

function wireControls() {
  el("q").addEventListener("input", applyFilters);
  el("category").addEventListener("change", applyFilters);
  el("location").addEventListener("change", applyFilters);
  el("buildStatus").addEventListener("change", applyFilters);
  el("paintStatus").addEventListener("change", applyFilters);
  el("sort").addEventListener("change", applyFilters);


  el("prevPage").addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    renderItems();
  });

  el("nextPage").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    state.page = Math.min(totalPages, state.page + 1);
    renderItems();
  });

  
  el("reset").addEventListener("click", () => {
    el("q").value = "";
    el("category").value = "";
    el("location").value = "";
    el("buildStatus").value = "";
    el("paintStatus").value = "";
    el("sort").value = "name-asc";
    state.activeOrderId = null;
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
      .spec-toc {
       position: sticky;
       top: 0.75rem;               /* sticks below top padding */
       z-index: 5;
       border: 1px solid rgba(0,0,0,0.12);
       border-radius: 12px;
       padding: 0.75rem;
       margin: 1rem 0 0.75rem;
       background: rgba(250,250,250,0.92);
       backdrop-filter: blur(6px);
     }

     .dark-mode .spec-toc {
       border-color: rgba(255,255,255,0.12);
       background: rgba(34,34,34,0.92);
     }

     .spec-toc-title {
       font-weight: 800;
       margin-bottom: 0.5rem;
       opacity: 0.95;
     }

     .spec-toc-links {
       display: flex;
       flex-wrap: wrap;
       gap: 0.5rem;
     }
     .spec-toc-links {
       max-height: 140px;
       overflow: auto;
       padding-right: 0.25rem;
     }

     /* Slightly nicer scrollbar in modern browsers (optional) */
     .spec-toc-links::-webkit-scrollbar { width: 10px; }
     .spec-toc-links::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(0,0,0,0.18); }
     .dark-mode .spec-toc-links::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); }
     .spec-toc-link {
       text-decoration: none;
       color: inherit;
       padding: 0.35rem 0.6rem;
       border-radius: 999px;
       background: rgba(0,0,0,0.08);
       font-size: 0.9rem;
       line-height: 1.2;
     }

     .spec-toc-link:hover { background: rgba(0,0,0,0.14); }

     .dark-mode .spec-toc-link { background: rgba(255,255,255,0.12); }
     .dark-mode .spec-toc-link:hover { background: rgba(255,255,255,0.18); }

     /* Make anchor jumps land nicely */
     .spec-section-title {
       margin: 1rem 0 0.25rem;
       scroll-margin-top: 110px; /* account for sticky toc + padding */
     }

     html { scroll-behavior: smooth; }
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
    renderOrders();
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
