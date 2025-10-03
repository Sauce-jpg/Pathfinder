/* =======================
   Pathfinder Character JS
   ======================= */

// THEME are handled in ../theme.js

// --- Debugging ---
const DEBUG = true; // set to false to silence logs
function debugLog(...args) {
  if (DEBUG) console.log("[Pathfinder]", ...args);
}

// --- DOM References ---
const backToTopBtn = document.getElementById("backToTop");
const modal = document.getElementById("backstoryModal");
const modalContent = document.querySelector("#backstoryModal .modal-content");

// --- TABS ---
function openTab(tabId, btn) {
  debugLog("Switching tab:", tabId);

  document.querySelectorAll("main section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));

  const section = document.getElementById(tabId);
  if (section) section.classList.add("active");
  if (btn) btn.classList.add("active");
}

// On page load restore tab based on hash
window.addEventListener("load", () => {
  let tabToOpen = "overview";
  let buttonToActivate = document.querySelector("nav button");

  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    if (document.getElementById(hash)) {
      tabToOpen = hash;
      const btn = document.querySelector(`nav button[onclick*="${hash}"]`);
      if (btn) buttonToActivate = btn;
    }
  }

  debugLog("Page loaded → opening tab:", tabToOpen);
  openTab(tabToOpen, buttonToActivate);
  toggleBackToTop();
});

// --- MODAL (Backstory) ---
function openModal() {
  debugLog("Opening backstory modal");
  const backstoryDiv = document.getElementById("backstoryText");
  modal.style.display = "block";
  backstoryDiv.innerHTML = "<p>Loading...</p>";

  if (modal) modal.scrollTop = 0;
  if (modalContent) modalContent.scrollTop = 0;
  toggleBackToTop();

  fetch("backstory.html")
    .then(res => {
      if (!res.ok) throw new Error("Could not load backstory.");
      return res.text();
    })
    .then(data => {
      debugLog("Backstory loaded successfully");
      backstoryDiv.innerHTML = data;
      if (modalContent) modalContent.scrollTop = 0;
      if (modal) modal.scrollTop = 0;
      toggleBackToTop();
    })
    .catch(err => {
      debugLog("Error loading backstory:", err.message);
      backstoryDiv.innerHTML = `<p>Error loading backstory: ${err.message}</p>`;
      toggleBackToTop();
    });
}

function closeModal() {
  debugLog("Closing modal");
  if (modal) {
    modal.style.display = "none";
    if (modalContent) modalContent.scrollTop = 0;
    modal.scrollTop = 0;
  }
  toggleBackToTop();
}

// --- BACK TO TOP ---
function toggleBackToTop() {
  let show = false;
  const pageScroll = window.scrollY || document.documentElement.scrollTop || 0;
  if (pageScroll > 200) show = true;

  if (modal && getComputedStyle(modal).display !== "none") {
    if (modal.scrollTop > 200) show = true;
    if (modalContent && modalContent.scrollTop > 200) show = true;
  }

  if (show) backToTopBtn.classList.add("show");
  else backToTopBtn.classList.remove("show");
}
function scrollToTop() {
  debugLog("Scroll to top triggered");
  if (modal && getComputedStyle(modal).display !== "none") {
    if (modalContent) modalContent.scrollTo({ top: 0, behavior: "smooth" });
    else modal.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

window.addEventListener("scroll", toggleBackToTop);
if (modal) modal.addEventListener("scroll", toggleBackToTop);
if (modalContent) modalContent.addEventListener("scroll", toggleBackToTop);
window.addEventListener("click", e => {
  if (e.target === modal) closeModal();
});

// --- DROPDOWNS ---
function toggleDropdown(id) {
  debugLog("Toggling dropdown:", id);
  document.querySelectorAll(".dropdown").forEach(d => {
    if (d.id !== id) d.classList.remove("show");
  });
  document.getElementById(id).classList.toggle("show");
}
window.addEventListener("click", function (e) {
  if (!e.target.matches(".dropbtn")) {
    document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("show"));
  }
});

// --- SPELL SYSTEM ---
let allSpells = [];
let oracleKnown = JSON.parse(localStorage.getItem("oracleKnown")) || [];
let wizardKnown = JSON.parse(localStorage.getItem("wizardKnown")) || [];
let preparedSpells = JSON.parse(localStorage.getItem("preparedSpells")) || [];

let oracleSlots = JSON.parse(localStorage.getItem("oracleSlots")) || {
  1: 5, 2: 4, 3: 3, 4: 2
};
let oracleMaxSlots = { 1: 5, 2: 4, 3: 3, 4: 2 };

debugLog("Loading spells from spells-all.json...");
fetch("spells-all.json")
  .then(res => res.json())
  .then(data => {
    allSpells = data;
    debugLog("Spells loaded:", allSpells.length);
    loadSpells();
    renderKnown();
    renderPrepared();
    renderOracleSlots();
  });

// --- FILTER & LIST ---
function loadSpells() {
  debugLog("Filtering spells...");
  const classFilter = document.getElementById("classFilter").value;
  const levelFilter = document.getElementById("levelFilter").value;
  const schoolFilter = document.getElementById("schoolFilter").value;
  const searchFilter = document.getElementById("searchFilter").value.toLowerCase();
  debugLog("Filters →", { classFilter, levelFilter, schoolFilter, searchFilter });

  const list = document.getElementById("spellList");
  list.innerHTML = "";

  if (!classFilter && !levelFilter && !schoolFilter && !searchFilter) {
    return;
  }

  const filtered = allSpells.filter(spell => {
    const matchesClass = !classFilter || spell.level[classFilter] !== undefined;
    let matchesLevel = true;
    if (levelFilter) {
      if (classFilter) matchesLevel = spell.level[classFilter] == levelFilter;
      else matchesLevel = Object.values(spell.level).some(lv => lv == levelFilter);
    }
    const matchesSchool = !schoolFilter || spell.school.toLowerCase().includes(schoolFilter.toLowerCase());
    const matchesSearch = !searchFilter || spell.name.toLowerCase().includes(searchFilter);
    return matchesClass && matchesLevel && matchesSchool && matchesSearch;
  });

  debugLog("Filtered spells:", filtered.length);

  if (filtered.length === 0) {
    list.innerHTML = `<li><em>No results found</em></li>`;
    return;
  }

  filtered.forEach(spell => {
    const spellLevel = classFilter ? spell.level[classFilter] : Object.values(spell.level)[0];
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${spell.name}</strong>
      (Lv ${spellLevel}, ${spell.school})
      <a href="${spell.url}" target="_blank">📖</a>
      <button onclick="chooseKnown('${spell.name}')">+ Known</button>
    `;
    list.appendChild(li);
  });
}

// --- Manage Known Spells ---
function chooseKnown(spellName) {
  debugLog("Adding known spell:", spellName);
  const choice = prompt(`Add "${spellName}" to:\n1 = Oracle Known\n2 = Wizard Spellbook`);
  if (choice === "1") {
    oracleKnown.push(spellName);
    localStorage.setItem("oracleKnown", JSON.stringify(oracleKnown));
  } else if (choice === "2") {
    wizardKnown.push(spellName);
    localStorage.setItem("wizardKnown", JSON.stringify(wizardKnown));
  }
  renderKnown();
}

function renderKnown() {
  debugLog("Rendering known spells");
  const oracleList = document.getElementById("oracleKnownList");
  const wizardList = document.getElementById("wizardKnownList");
  oracleList.innerHTML = "";
  wizardList.innerHTML = "";

  // Group Oracle
  const oracleGrouped = {};
  oracleKnown.forEach(name => {
    const spell = allSpells.find(s => s.name === name);
    if (!spell) return;
    const lvl = spell.level.Oracle ?? "?";
    if (!oracleGrouped[lvl]) oracleGrouped[lvl] = [];
    oracleGrouped[lvl].push(spell);
  });

  Object.keys(oracleGrouped).sort((a,b)=>a-b).forEach(lvl => {
    const header = document.createElement("li");
    header.innerHTML = `<strong>Level ${lvl}</strong>`;
    oracleList.appendChild(header);
    oracleGrouped[lvl].forEach((spell,i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${spell.name}
        <div class="dropdown" id="dd-oracle-${lvl}-${i}">
          <button class="dropbtn" onclick="toggleDropdown('dd-oracle-${lvl}-${i}')">⋮</button>
          <div class="dropdown-content">
            <a href="${spell.url}" target="_blank">📖 Open</a>
            <button onclick="removeKnown('oracle', oracleKnown.indexOf('${spell.name}'))">Remove</button>
          </div>
        </div>
      `;
      oracleList.appendChild(li);
    });
  });

  // Group Wizard
  const wizardGrouped = {};
  wizardKnown.forEach(name => {
    const spell = allSpells.find(s => s.name === name);
    if (!spell) return;
    const lvl = spell.level.Wizard ?? "?";
    if (!wizardGrouped[lvl]) wizardGrouped[lvl] = [];
    wizardGrouped[lvl].push(spell);
  });

  Object.keys(wizardGrouped).sort((a,b)=>a-b).forEach(lvl => {
    const header = document.createElement("li");
    header.innerHTML = `<strong>Level ${lvl}</strong>`;
    wizardList.appendChild(header);
    wizardGrouped[lvl].forEach((spell,i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${spell.name}
        <div class="dropdown" id="dd-wizard-${lvl}-${i}">
          <button class="dropbtn" onclick="toggleDropdown('dd-wizard-${lvl}-${i}')">⋮</button>
          <div class="dropdown-content">
            <a href="${spell.url}" target="_blank">📖 Open</a>
            <button onclick="prepareSpell('${spell.name}')">Prepare</button>
            <button onclick="removeKnown('wizard', wizardKnown.indexOf('${spell.name}'))">Remove</button>
          </div>
        </div>
      `;
      wizardList.appendChild(li);
    });
  });
}

// --- Prepared Spells ---
function prepareSpell(name) {
  debugLog("Preparing spell:", name);
  preparedSpells.push({ name, used: false });
  localStorage.setItem("preparedSpells", JSON.stringify(preparedSpells));
  renderPrepared();
}

function renderPrepared() {
  debugLog("Rendering prepared spells");
  const list = document.getElementById("preparedList");
  list.innerHTML = "";

  const grouped = {};
  preparedSpells.forEach((p,index) => {
    const spell = allSpells.find(s => s.name === p.name);
    if (!spell) return;
    const lvl = spell.level.Wizard ?? "?";
    if (!grouped[lvl]) grouped[lvl] = [];
    grouped[lvl].push({ spell, index, used: p.used });
  });

  Object.keys(grouped).sort((a,b)=>a-b).forEach(lvl => {
    const header = document.createElement("li");
    header.innerHTML = `<strong>Level ${lvl}</strong>`;
    list.appendChild(header);
    grouped[lvl].forEach(({spell,index,used}) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <label>
          <input type="checkbox" ${used ? "checked" : ""} onchange="toggleUsed(${index})">
          ${spell.name}
        </label>
        <div class="dropdown" id="dd-prepared-${lvl}-${index}">
          <button class="dropbtn" onclick="toggleDropdown('dd-prepared-${lvl}-${index}')">⋮</button>
          <div class="dropdown-content">
            <a href="${spell.url}" target="_blank">📖 Open</a>
            <button onclick="removePrepared(${index})">Remove</button>
          </div>
        </div>
      `;
      list.appendChild(li);
    });
  });
}

function toggleUsed(index) {
  preparedSpells[index].used = !preparedSpells[index].used;
  localStorage.setItem("preparedSpells", JSON.stringify(preparedSpells));
  debugLog("Toggled prepared spell:", preparedSpells[index]);
}
function removePrepared(index) {
  debugLog("Removing prepared spell:", preparedSpells[index]?.name);
  preparedSpells.splice(index,1);
  localStorage.setItem("preparedSpells", JSON.stringify(preparedSpells));
  renderPrepared();
}

// --- Oracle Slots ---
function renderOracleSlots() {
  debugLog("Rendering Oracle slots");
  const list = document.getElementById("oracleSlots");
  list.innerHTML = "";
  for (const lvl in oracleSlots) {
    const li = document.createElement("li");
    li.innerHTML = `
      L${lvl}: ${oracleSlots[lvl]}/${oracleMaxSlots[lvl]}
      <div class="dropdown" id="dd-oracleSlot-${lvl}">
        <button class="dropbtn" onclick="toggleDropdown('dd-oracleSlot-${lvl}')">⋮</button>
        <div class="dropdown-content">
          <button onclick="useOracleSlot(${lvl})">Use</button>
          <button onclick="adjustOracleSlot(${lvl})">Adjust</button>
        </div>
      </div>
    `;
    list.appendChild(li);
  }
}

function adjustOracleSlot(level) {
  const newVal = prompt(`Set slots for Level ${level}:`, oracleSlots[level]);
  debugLog("Adjust Oracle slot", { level, newVal });
  if (newVal !== null) {
    const parsed = parseInt(newVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      oracleSlots[level] = parsed;
      localStorage.setItem("oracleSlots", JSON.stringify(oracleSlots));
      renderOracleSlots();
    }
  }
}

function useOracleSlot(level) {
  debugLog("Using Oracle slot for level", level);
  if (oracleSlots[level] > 0) {
    oracleSlots[level]--;
    localStorage.setItem("oracleSlots", JSON.stringify(oracleSlots));
    renderOracleSlots();
  }
}

// --- Rest (reset daily) ---
function rest() {
  debugLog("Rest action: resetting slots and prepared spells");
  Object.keys(oracleMaxSlots).forEach(l => (oracleSlots[l] = oracleMaxSlots[l]));
  localStorage.setItem("oracleSlots", JSON.stringify(oracleSlots));
  renderOracleSlots();

  preparedSpells.forEach(p => (p.used = false));
  localStorage.setItem("preparedSpells", JSON.stringify(preparedSpells));
  renderPrepared();
}

// --- Remove Known ---
function removeKnown(type, index) {
  debugLog("Removing known spell from", type, "at index", index);
  if (type === "oracle") {
    oracleKnown.splice(index,1);
    localStorage.setItem("oracleKnown", JSON.stringify(oracleKnown));
  } else {
    wizardKnown.splice(index,1);
    localStorage.setItem("wizardKnown", JSON.stringify(wizardKnown));
  }
  renderKnown();
}

// --- Auto Filters ---
document.getElementById("searchFilter").addEventListener("input", loadSpells);
document.getElementById("classFilter").addEventListener("change", loadSpells);
document.getElementById("levelFilter").addEventListener("change", loadSpells);
document.getElementById("schoolFilter").addEventListener("change", loadSpells);

document.getElementById("resetFilters").addEventListener("click", () => {
  debugLog("Resetting all filters");
  document.getElementById("classFilter").value = "";
  document.getElementById("levelFilter").value = "";
  document.getElementById("schoolFilter").value = "";
  document.getElementById("searchFilter").value = "";
  loadSpells();
});
