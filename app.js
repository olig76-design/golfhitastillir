const STORAGE_KEY = "golfhitastillir.project.v4";
const LEGACY_STORAGE_KEYS = [
  "golfhitastillir.project.v3",
  "golfhitastillir.project.v2",
  "golfhitastillir.project.v1"
];

const FACTOR = 1.16;
const PIPE_SPACING_FACTORS = {
  100: 0.014,
  150: 0.022,
  200: 0.029
};

const PUMPS = {
  "grundfos-upm3-auto-16-70": {
    name: "Grundfos UPM3 AUTO 16-70",
    setting: "CP AA / Constant Pressure AUTOADAPT",
    note: "Ef rennsli næst ekki á lengstu slaufum með öllum slaufum opnum má prófa CP2."
  }
};

const initialProject = {
  address: "",
  cabinetName: "",
  loopCount: 4,
  settings: {
    method: "length",
    wattsPerSquareMeter: 50,
    deltaT: 5,
    pipeSpacing: 150
  },
  pumpType: "grundfos-upm3-auto-16-70",
  loops: [
    { number: 1, room: "", thermostat: "", length: "", area: "" },
    { number: 2, room: "", thermostat: "", length: "", area: "" },
    { number: 3, room: "", thermostat: "", length: "", area: "" },
    { number: 4, room: "", thermostat: "", length: "", area: "" }
  ]
};

let project = loadProject();

const els = {
  address: document.getElementById("address"),
  cabinetName: document.getElementById("cabinetName"),
  loopCount: document.getElementById("loopCount"),
  loopTableHead: document.getElementById("loopTableHead"),
  loopRows: document.getElementById("loopRows"),
  totalFlow: document.getElementById("totalFlow"),
  cabinetSummary: document.getElementById("cabinetSummary"),
  methodSummary: document.getElementById("methodSummary"),
  methodDetail: document.getElementById("methodDetail"),
  settingsSummary: document.getElementById("settingsSummary"),
  saveState: document.getElementById("saveState"),
  settingsButton: document.getElementById("settingsButton"),
  pumpButton: document.getElementById("pumpButton"),
  calculateButton: document.getElementById("calculateButton"),
  settingsPanel: document.getElementById("settingsPanel"),
  pumpPanel: document.getElementById("pumpPanel"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  wattsPerSquareMeter: document.getElementById("wattsPerSquareMeter"),
  deltaT: document.getElementById("deltaT"),
  pipeSpacing: document.getElementById("pipeSpacing"),
  pumpType: document.getElementById("pumpType"),
  printAddress: document.getElementById("printAddress"),
  printCabinet: document.getElementById("printCabinet"),
  printDate: document.getElementById("printDate"),
  newProjectButton: document.getElementById("newProjectButton"),
  printButton: document.getElementById("printButton")
};

let activeModal = null;

function loadProject() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeProject(JSON.parse(current), false);

    const legacyKey = LEGACY_STORAGE_KEYS.find((key) => localStorage.getItem(key));
    if (!legacyKey) return cloneInitialProject();
    return normalizeProject(JSON.parse(localStorage.getItem(legacyKey)), true);
  } catch {
    return cloneInitialProject();
  }
}

function cloneInitialProject() {
  return structuredClone(initialProject);
}

function normalizeProject(value, isLegacy) {
  const settings = {
    method: value.settings?.method === "area" ? "area" : "length",
    wattsPerSquareMeter: value.settings?.wattsPerSquareMeter || 50,
    deltaT: value.settings?.deltaT || 5,
    pipeSpacing: isLegacy ? 150 : normalizePipeSpacing(value.settings?.pipeSpacing)
  };
  const loopCount = clampInteger(value.loopCount || 1, 1, 24);
  const sourceLoops = Array.isArray(value.loops) ? value.loops : [];
  const loops = Array.from({ length: loopCount }, (_, index) => {
    const savedLoop = sourceLoops[index] || {};
    return {
      number: savedLoop.number || index + 1,
      room: savedLoop.room || "",
      thermostat: savedLoop.thermostat || "",
      length: savedLoop.length || "",
      area: savedLoop.area || ""
    };
  });

  return {
    address: value.address || value.projectName || "",
    cabinetName: value.cabinetName || "",
    loopCount,
    settings,
    pumpType: PUMPS[value.pumpType] ? value.pumpType : "grundfos-upm3-auto-16-70",
    loops
  };
}

function normalizePipeSpacing(value) {
  const spacing = String(value || 150);
  return PIPE_SPACING_FACTORS[spacing] ? Number(spacing) : 150;
}

function saveProject() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  els.saveState.textContent = "Vistað sjálfkrafa";
}

function clampInteger(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const normalized = String(value).replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, digits = 1) {
  return value.toLocaleString("is-IS", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function calculateLoop(loop) {
  const length = toNumber(loop.length);
  const enteredArea = toNumber(loop.area);
  const isLengthMethod = project.settings.method === "length";
  const pipeSpacing = normalizePipeSpacing(project.settings.pipeSpacing);
  const flowFactor = PIPE_SPACING_FACTORS[pipeSpacing];

  if (isLengthMethod) {
    const litersPerMinute = length * flowFactor;
    return {
      length,
      area: 0,
      watts: 0,
      litersPerHour: litersPerMinute * 60,
      litersPerMinute,
      flowFactor
    };
  }

  const watts = enteredArea * toNumber(project.settings.wattsPerSquareMeter);
  const denominator = toNumber(project.settings.deltaT) * FACTOR;
  const litersPerHour = denominator > 0 ? watts / denominator : 0;
  const litersPerMinute = litersPerHour / 60;

  return {
    length,
    area: enteredArea,
    watts,
    litersPerHour,
    litersPerMinute,
    flowFactor
  };
}

function estimateRingSetting(litersPerMinute, maxFlow) {
  if (litersPerMinute <= 0 || maxFlow <= 0) return "-";
  const ratio = litersPerMinute / maxFlow;
  if (ratio >= 0.98) return "N / 7";
  if (ratio >= 0.8) return "6-7";
  if (ratio >= 0.65) return "5-6";
  if (ratio >= 0.5) return "4-5";
  return "3-4";
}

function getMaxFlow() {
  return project.loops.reduce((max, loop) => {
    return Math.max(max, calculateLoop(loop).litersPerMinute);
  }, 0);
}

function updateLoopCount(value) {
  const nextCount = clampInteger(value, 1, 24);
  const nextLoops = Array.from({ length: nextCount }, (_, index) => {
    return project.loops[index] || { number: index + 1, room: "", thermostat: "", length: "", area: "" };
  });

  project.loopCount = nextCount;
  project.loops = nextLoops.map((loop, index) => ({
    ...loop,
    number: loop.number || index + 1,
    thermostat: loop.thermostat || ""
  }));
}

function render() {
  els.address.value = project.address;
  els.cabinetName.value = project.cabinetName;
  els.loopCount.value = project.loopCount;
  els.wattsPerSquareMeter.value = project.settings.wattsPerSquareMeter;
  els.deltaT.value = project.settings.deltaT;
  els.pipeSpacing.value = normalizePipeSpacing(project.settings.pipeSpacing);
  els.pumpType.value = project.pumpType;
  els.printAddress.textContent = project.address || "Heimilisfang vantar";
  els.printCabinet.textContent = project.cabinetName || "Kista / hæð vantar";
  els.printDate.textContent = new Date().toLocaleDateString("is-IS");

  document.querySelectorAll('input[name="calculationMethod"]').forEach((input) => {
    input.checked = input.value === project.settings.method;
  });
  document.querySelectorAll(".area-setting").forEach((label) => {
    label.hidden = project.settings.method === "length";
  });

  renderSummary();
  renderTable();
}

function renderSummary() {
  const isLengthMethod = project.settings.method === "length";
  let totalFlow = 0;

  project.loops.forEach((loop) => {
    totalFlow += calculateLoop(loop).litersPerMinute;
  });

  const pipeSpacing = normalizePipeSpacing(project.settings.pipeSpacing);
  els.cabinetSummary.textContent = project.cabinetName || "Óskráð";
  els.methodSummary.textContent = isLengthMethod ? "Eftir slaufulengd" : "Eftir fermetrum";
  els.methodDetail.textContent = isLengthMethod ? `Slöngubil ${formatNumber(pipeSpacing, 0)} mm` : `ΔT ${formatNumber(toNumber(project.settings.deltaT), 1)}°C`;
  els.settingsSummary.textContent = isLengthMethod ? `${formatNumber(PIPE_SPACING_FACTORS[pipeSpacing], 3)} l/mín á m` : `${formatNumber(toNumber(project.settings.wattsPerSquareMeter), 0)} W/m²`;
  els.totalFlow.textContent = `${formatNumber(totalFlow, 1)} l/mín`;
}

function renderTable() {
  const isLengthMethod = project.settings.method === "length";
  const maxFlow = getMaxFlow();
  els.loopTableHead.innerHTML = isLengthMethod
    ? `
      <th>Loki</th>
      <th>Rými</th>
      <th>Lengd</th>
      <th>Hitastillir</th>
      <th>Stilla rennslismæli á</th>
      <th>Gróf hringstilling</th>
    `
    : `
      <th>Loki</th>
      <th>Rými</th>
      <th>Fermetrar</th>
      <th>Lengd</th>
      <th>Hitastillir</th>
      <th>Stilla rennslismæli á</th>
      <th>Gróf hringstilling</th>
    `;

  els.loopRows.innerHTML = "";
  project.loops.forEach((loop, index) => {
    const result = calculateLoop(loop);
    const row = document.createElement("tr");
    row.innerHTML = isLengthMethod ? renderLengthRow(loop, result, index, maxFlow) : renderAreaRow(loop, result, index, maxFlow);
    els.loopRows.appendChild(row);
  });
}

function renderLengthRow(loop, result, index, maxFlow) {
  const valveNumber = index + 1;
  return `
    <td class="number-cell" data-label="Loki">
      <span class="valve-number">${valveNumber}</span>
    </td>
    <td class="room-cell" data-label="Rými">
      <input data-field="room" data-index="${index}" type="text" value="${escapeAttr(loop.room)}" placeholder="t.d. eldhús" aria-label="Rými loka ${index + 1}">
    </td>
    <td data-label="Lengd">
      <input data-field="length" data-index="${index}" type="text" inputmode="decimal" value="${escapeAttr(loop.length)}" placeholder="0 m" aria-label="Lengd loka ${index + 1}">
    </td>
    <td class="thermostat-cell" data-label="Hitastillir">
      <input data-field="thermostat" data-index="${index}" type="text" value="${escapeAttr(loop.thermostat)}" placeholder="t.d. loki 1 og 2" aria-label="Hitastillir loka ${index + 1}">
    </td>
    <td class="flow-cell" data-label="Stilla rennslismæli á">
      <strong>${formatNumber(result.litersPerMinute, 1)} l/mín</strong>
    </td>
    <td class="ring-cell" data-label="Gróf hringstilling">
      <strong>${estimateRingSetting(result.litersPerMinute, maxFlow)}</strong>
    </td>
  `;
}

function renderAreaRow(loop, result, index, maxFlow) {
  const valveNumber = index + 1;
  return `
    <td class="number-cell" data-label="Loki">
      <span class="valve-number">${valveNumber}</span>
    </td>
    <td class="room-cell" data-label="Rými">
      <input data-field="room" data-index="${index}" type="text" value="${escapeAttr(loop.room)}" placeholder="t.d. stofa" aria-label="Rými loka ${index + 1}">
    </td>
    <td data-label="Fermetrar">
      <input data-field="area" data-index="${index}" type="text" inputmode="decimal" value="${escapeAttr(loop.area)}" placeholder="0 m²" aria-label="Fermetrar loka ${index + 1}">
    </td>
    <td data-label="Lengd">
      <input data-field="length" data-index="${index}" type="text" inputmode="decimal" value="${escapeAttr(loop.length)}" placeholder="ef þekkt" aria-label="Lengd loka ${index + 1}">
    </td>
    <td class="thermostat-cell" data-label="Hitastillir">
      <input data-field="thermostat" data-index="${index}" type="text" value="${escapeAttr(loop.thermostat)}" placeholder="t.d. loki 2 og 3" aria-label="Hitastillir loka ${index + 1}">
    </td>
    <td class="flow-cell" data-label="Stilla rennslismæli á">
      <strong>${formatNumber(result.litersPerMinute, 1)} l/mín</strong>
    </td>
    <td class="ring-cell" data-label="Gróf hringstilling">
      <strong>${estimateRingSetting(result.litersPerMinute, maxFlow)}</strong>
    </td>
  `;
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function markSaving() {
  els.saveState.textContent = "Vista...";
}

function updateAndRender(callback) {
  markSaving();
  callback();
  saveProject();
  render();
}

function handleProjectInput(event) {
  const { id, value } = event.target;
  updateAndRender(() => {
    if (id === "loopCount") {
      updateLoopCount(value);
    } else {
      project[id] = value;
    }
  });
}

function handleSettingInput(event) {
  const { id, value } = event.target;
  updateAndRender(() => {
    project.settings[id] = id === "pipeSpacing" ? normalizePipeSpacing(value) : value;
  });
}

function handleMethodChange(event) {
  updateAndRender(() => {
    project.settings.method = event.target.value;
  });
}

function handleLoopInput(event) {
  const field = event.target.dataset.field;
  const index = Number.parseInt(event.target.dataset.index, 10);
  if (!field || Number.isNaN(index)) return;

  updateAndRender(() => {
    project.loops[index][field] = event.target.value;
  });

  const nextInput = document.querySelector(`[data-index="${index}"][data-field="${field}"]`);
  if (nextInput) {
    nextInput.focus();
    if (nextInput.type === "text") {
      const valueLength = nextInput.value.length;
      nextInput.setSelectionRange(valueLength, valueLength);
    }
  }
}

function openModal(panelName) {
  const isSettings = panelName === "settings";
  const panel = isSettings ? els.settingsPanel : els.pumpPanel;
  const button = isSettings ? els.settingsButton : els.pumpButton;
  const otherPanel = isSettings ? els.pumpPanel : els.settingsPanel;
  const otherButton = isSettings ? els.pumpButton : els.settingsButton;

  otherPanel.hidden = true;
  otherButton.setAttribute("aria-expanded", "false");
  panel.hidden = false;
  els.modalBackdrop.hidden = false;
  button.setAttribute("aria-expanded", "true");
  document.body.classList.add("modal-open");
  activeModal = { panel, button };

  const firstField = panel.querySelector('input[name="calculationMethod"]:checked, select, input') || panel.querySelector("button");
  if (firstField) firstField.focus();
}

function closeModal() {
  if (!activeModal) return;

  activeModal.panel.hidden = true;
  activeModal.button.setAttribute("aria-expanded", "false");
  els.modalBackdrop.hidden = true;
  document.body.classList.remove("modal-open");
  activeModal.button.focus();
  activeModal = null;
}

function calculateNow() {
  render();
  els.totalFlow.closest(".metric").classList.add("pulse");
  window.setTimeout(() => els.totalFlow.closest(".metric").classList.remove("pulse"), 400);
}

function createNewProject() {
  const hasLoopData = project.loops.some((loop) => loop.room || loop.length || loop.area || loop.thermostat);
  const shouldReset = project.address || project.cabinetName || hasLoopData;
  if (shouldReset && !confirm("Viltu stofna nýtt verkefni? Núverandi gögn verða hreinsuð úr þessu tæki.")) {
    return;
  }

  project = cloneInitialProject();
  saveProject();
  render();
  els.address.focus();
}

els.address.addEventListener("input", handleProjectInput);
els.cabinetName.addEventListener("input", handleProjectInput);
els.loopCount.addEventListener("input", handleProjectInput);
els.wattsPerSquareMeter.addEventListener("input", handleSettingInput);
els.deltaT.addEventListener("input", handleSettingInput);
els.pipeSpacing.addEventListener("input", handleSettingInput);
els.pipeSpacing.addEventListener("change", handleSettingInput);
els.loopRows.addEventListener("input", handleLoopInput);
els.settingsButton.addEventListener("click", () => openModal("settings"));
els.pumpButton.addEventListener("click", () => openModal("pump"));
els.calculateButton.addEventListener("click", calculateNow);
els.pumpType.addEventListener("change", (event) => {
  updateAndRender(() => {
    project.pumpType = event.target.value;
  });
});
document.querySelectorAll('input[name="calculationMethod"]').forEach((input) => {
  input.addEventListener("change", handleMethodChange);
});
els.newProjectButton.addEventListener("click", createNewProject);
els.printButton.addEventListener("click", () => window.print());
els.modalBackdrop.addEventListener("click", closeModal);
document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModal);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

render();
