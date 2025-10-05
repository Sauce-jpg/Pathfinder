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
  document.querySelectorAll("main section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll("nav > button").forEach(b => b.classList.remove("active")); // only main nav
  const section = document.getElementById(tabId);
  if (section) section.classList.add("active");
  if (btn && btn.tagName === "BUTTON" && btn.closest("nav") && !btn.closest(".dropdown")) {
    btn.classList.add("active");
  }
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




// ===== AC Popup =====
function openACPopup() {
  document.getElementById("acPopup").style.display = "block";
}
function closeACPopup() {
  document.getElementById("acPopup").style.display = "none";
  updateCombat(); // re-calculate after editing
}

// close popup when clicking outside
window.addEventListener("click", e => {
  const popup = document.getElementById("acPopup");
  if (e.target === popup) closeACPopup();
});

// ===== AC Notes toggle =====
function toggleACNote(type) {
  const row = document.getElementById(`note-${type}`);
  if (!row) return;
  row.style.display = (row.style.display === "table-row") ? "none" : "table-row";
}

// ===== Saves Popup =====
function openSavesPopup() {
  document.getElementById("savesPopup").style.display = "block";
}
function closeSavesPopup() {
  document.getElementById("savesPopup").style.display = "none";
  updateCombat();
}
function toggleSaveNote(type) {
  const row = document.getElementById(`note-${type}`);
  if (row) row.style.display = (row.style.display === "table-row") ? "none" : "table-row";
}

// ===== CMB/CMD Popup =====
function openCMBPopup() {
  document.getElementById("cmbPopup").style.display = "block";
}
function closeCMBPopup() {
  document.getElementById("cmbPopup").style.display = "none";
  updateCombat();
}
function toggleCMBNote(type) {
  const row = document.getElementById(`note-${type}`);
  if (row) row.style.display = (row.style.display === "table-row") ? "none" : "table-row";
}

// Close popups by clicking outside
window.addEventListener("click", e => {
  if (e.target === document.getElementById("savesPopup")) closeSavesPopup();
  if (e.target === document.getElementById("cmbPopup")) closeCMBPopup();
});





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



// --- Collapsible ---
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".collapse-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("active");
    const content = btn.nextElementSibling;
    content.classList.toggle("show");
    btn.innerHTML = btn.textContent.includes("▾")
      ? btn.textContent.replace("▾","▸")
      : btn.textContent.replace("▸","▾");
  });
 });
});







// ===== Ability Mods Global =====
const abilityMods = { Str:0, Dex:0, Con:0, Int:0, Wis:0, Cha:0 };

// Helpers
function toInt(el) {
  if (!el) return 0;
  const v = parseInt(el.value, 10);
  return isNaN(v) ? 0 : v;
}
function toIntById(id) {
  const el = document.getElementById(id);
  return toInt(el);
}
function signNum(n){ return (n>=0? "+" : "") + n; }

// ===== Recompute ability modifiers from cards =====
function updateAbilityMods() {
  document.querySelectorAll(".ability-card").forEach(card => {
    const ability = card.dataset.ability;
    const scoreEl = card.querySelector(".score");
    const tempEl  = card.querySelector(".temp");
    const modEl   = card.querySelector(".mod");

    if (!ability || !scoreEl || !tempEl || !modEl) return;

    const baseScore = toInt(scoreEl) || 10;
    const temp      = toInt(tempEl);
    const totalScore = baseScore + temp;
    const mod = Math.floor((totalScore - 10) / 2);

    modEl.textContent = signNum(mod);
    abilityMods[ability] = mod;
  });
  return abilityMods;
}

// ===== Skills =====
function updateSkills() {
  const mods = updateAbilityMods();

  document.querySelectorAll("#skills table tr[data-ability]").forEach(row => {
    const ability = row.dataset.ability;
    if (!ability) return;

    const ranks = toInt(row.querySelector(".ranks"));
    const misc  = toInt(row.querySelector(".misc"));
    const classSkill = !!row.querySelector(".class-skill")?.checked;

    let total = (mods[ability] || 0) + ranks + misc;
    if (classSkill && ranks > 0) total += 3;

    const totalEl = row.querySelector(".total");
    if (totalEl) totalEl.textContent = signNum(total);
  });
}

// ===== Combat =====
function updateCombat() {
  const mods = updateAbilityMods();

// =====  (Place it near the top of the Combat section (below updateCombat() is fine)):
// ======================
// Persistent Combat Data
// ======================
let combatData = JSON.parse(localStorage.getItem("combatData")) || {
  notes: {},
  values: {}
};

// --- Save a single entry ---
function saveCombatData(type, key, value) {
  combatData[type][key] = value;
  localStorage.setItem("combatData", JSON.stringify(combatData));
}

// --- Load all saved values into inputs/texts ---
function loadCombatData() {
  // Load freetext notes
  for (const [key, val] of Object.entries(combatData.notes)) {
    const noteField = document.getElementById(`note-${key}-text`);
    if (noteField) noteField.value = val;
  }

  // Load numeric or text values
  for (const [key, val] of Object.entries(combatData.values)) {
    const el = document.getElementById(key);
    if (!el) continue;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.value = val;
    } else {
      el.textContent = val;
    }
  }
}

// --- Automatically track any input in the Combat section ---
document.addEventListener("input", e => {
  const el = e.target;
  const id = el.id;
  if (!id) return;

  // 1. Notes (📝 freetext)
  if (id.startsWith("note-") && id.endsWith("-text")) {
    const key = id.replace("note-", "").replace("-text", "");
    saveCombatData("notes", key, el.value);
  }
  // 2. Any combat input fields (numbers, text)
  else if (
    el.closest("#combat") ||
    el.closest("#acPopup") ||
    el.closest("#savesPopup") ||
    el.closest("#cmbPopup")
  ) {
    if (["number", "text"].includes(el.type)) {
      saveCombatData("values", id, el.value);
    }
  }
});



   
   
   
   
  // Initiative
  const initMisc  = toIntById("init-misc");
  const initTotal = (mods.Dex || 0) + initMisc;
  const initDexEl = document.getElementById("init-dex");
  const initTotEl = document.getElementById("initiative-total");
  if (initDexEl) initDexEl.textContent = signNum(mods.Dex || 0);
  if (initTotEl) initTotEl.textContent = signNum(initTotal);

  // AC
  const base = 10;
  const armor    = toIntById("ac-armor");
  const shield   = toIntById("ac-shield");
  const dex      = mods.Dex || 0;
  const dodge    = toIntById("ac-dodge");
  const size     = toIntById("ac-size");
  const natural  = toIntById("ac-natural");
  const deflect  = toIntById("ac-deflection");
  const misc     = toIntById("ac-misc");

  const acTotal = base + armor + shield + dex + dodge + size + natural + deflect + misc;
  const acTouch = base + dex + dodge + size + deflect + misc;
  const acFlat  = base + armor + shield + size + natural + deflect + misc;

  const acDexEl   = document.getElementById("ac-dex");
  const acTotEl   = document.getElementById("ac-total");
  const acTouchEl = document.getElementById("ac-touch");
  const acFlatEl  = document.getElementById("ac-flat");

  if (acDexEl)   acDexEl.textContent = signNum(dex);
  if (acTotEl)   acTotEl.textContent = acTotal;
  if (acTouchEl) acTouchEl.textContent = acTouch;
  if (acFlatEl)  acFlatEl.textContent = acFlat;

  // Saves
  document.querySelectorAll("#combat tr[data-save]").forEach(row => {
    const saveType = row.dataset.save;
    const abilityMod =
      saveType === "Fort" ? (mods.Con || 0) :
      saveType === "Ref"  ? (mods.Dex || 0) :
      saveType === "Will" ? (mods.Wis || 0) : 0;

    const base  = toInt(row.querySelector(".base"));
    const magic = toInt(row.querySelector(".magic"));
    const misc  = toInt(row.querySelector(".misc"));
    const temp  = toInt(row.querySelector(".temp"));

    const abilEl = row.querySelector(".ability");
    const totalEl = row.querySelector(".total");

    if (abilEl)  abilEl.textContent  = signNum(abilityMod);
    if (totalEl) totalEl.textContent = signNum(base + abilityMod + magic + misc + temp);
  });

  // CMB / CMD
  const bab     = toIntById("bab");
  const sizeMod = size; // reuse AC size
  const cmb     = bab + (mods.Str || 0) + sizeMod;
  const cmd     = 10 + bab + (mods.Str || 0) + (mods.Dex || 0) + dodge + deflect + sizeMod + misc;

  const cmbEl = document.getElementById("cmb-total");
  const cmdEl = document.getElementById("cmd-total");
  if (cmbEl) cmbEl.textContent = signNum(cmb);
  if (cmdEl) cmdEl.textContent = cmd;
}

// ===== Conditions button (unchanged) =====
function advanceRound() {
  const condInput = document.getElementById("conditions");
  if (!condInput) return;
  const text = condInput.value || "";
  condInput.value = text.replace(/(\d+)/, m => Math.max(0, parseInt(m) - 1));
}

// ===== Listeners =====
// one handler that won’t crash if some tabs aren’t rendered yet
document.addEventListener("input", e => {
  if (e.target.closest(".ability-card")) {
    updateSkills();
    updateCombat();
  } else if (e.target.closest("#combat")) {
    updateCombat();
  } else if (e.target.closest("#skills")) {
    updateSkills();
  }
});

// Run once on load
document.addEventListener("DOMContentLoaded", () => {
  updateSkills();
  updateCombat();
  loadCombatData();   // 👈 Load all stored values & notes
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
