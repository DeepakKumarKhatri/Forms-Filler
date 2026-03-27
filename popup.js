document.addEventListener("DOMContentLoaded", () => {

  /* ━━━ Custom Dropdown ━━━ */
  class Dropdown {
    constructor(el) {
      this.el = el;
      this.triggerEl = el.querySelector(".dd-trigger");
      this.textEl = el.querySelector(".dd-text");
      this.menuEl = el.querySelector(".dd-menu");
      this._value = "";
      this._items = [];
      this._handlers = [];

      this.triggerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".dropdown.open").forEach((d) => {
          if (d !== this.el) d.classList.remove("open");
        });
        this.el.classList.toggle("open");
      });
    }

    get value() { return this._value; }
    set value(v) {
      this._value = v;
      const item = this._items.find((i) => i.value === v);
      if (item) this.textEl.textContent = item.text;
      this._syncActive();
    }

    get items() { return this._items; }

    onChange(fn) { this._handlers.push(fn); }

    setItems(items) {
      this._items = items;
      this.menuEl.innerHTML = "";
      items.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "dd-item";
        btn.type = "button";
        btn.dataset.value = item.value;
        if (item.title) btn.title = item.title;

        const span = document.createElement("span");
        span.className = "dd-item-text";
        span.textContent = item.text;
        btn.appendChild(span);

        const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        check.setAttribute("class", "dd-check");
        check.setAttribute("width", "14");
        check.setAttribute("height", "14");
        check.setAttribute("viewBox", "0 0 24 24");
        check.setAttribute("fill", "none");
        check.setAttribute("stroke", "currentColor");
        check.setAttribute("stroke-width", "2.5");
        check.setAttribute("stroke-linecap", "round");
        check.setAttribute("stroke-linejoin", "round");
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        poly.setAttribute("points", "20 6 9 17 4 12");
        check.appendChild(poly);
        btn.appendChild(check);

        btn.addEventListener("click", () => {
          this._value = item.value;
          this.textEl.textContent = item.text;
          this.el.classList.remove("open");
          this._syncActive();
          this._handlers.forEach((fn) => fn());
        });

        this.menuEl.appendChild(btn);
      });
      this._syncActive();
    }

    clear() {
      this._items = [];
      this._value = "";
      this.textEl.textContent = "";
      this.menuEl.innerHTML = "";
    }

    _syncActive() {
      this.menuEl.querySelectorAll(".dd-item").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.value === this._value);
      });
    }
  }

  // Close dropdowns on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) {
      document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
    }
  });

  /* ━━━ Modal System ━━━ */
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalMessage = document.getElementById("modal-message");
  const modalInput = document.getElementById("modal-input");
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");

  let modalResolve = null;

  function showModal({ title, message = "", input = false, inputDefault = "", confirmText = "Confirm", dangerous = false }) {
    return new Promise((resolve) => {
      modalResolve = resolve;
      modalTitle.textContent = title;
      modalMessage.textContent = message;

      if (input) {
        modalInput.classList.remove("hide");
        modalInput.value = inputDefault;
        setTimeout(() => { modalInput.focus(); modalInput.select(); }, 60);
      } else {
        modalInput.classList.add("hide");
      }

      modalConfirm.textContent = confirmText;
      modalConfirm.className = "btn " + (dangerous ? "danger-confirm" : "primary");

      modalOverlay.classList.remove("hidden");
    });
  }

  function closeModal(result) {
    modalOverlay.classList.add("hidden");
    if (modalResolve) {
      modalResolve(result);
      modalResolve = null;
    }
  }

  modalCancel.addEventListener("click", () => closeModal(null));
  modalConfirm.addEventListener("click", () => {
    if (!modalInput.classList.contains("hide")) {
      closeModal(modalInput.value);
    } else {
      closeModal(true);
    }
  });
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal(null);
  });
  modalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") closeModal(modalInput.value);
  });

  async function showPrompt(title, defaultValue = "") {
    return showModal({ title, input: true, inputDefault: defaultValue, confirmText: "Save" });
  }

  async function showDangerConfirm(title, message = "") {
    return showModal({ title, message, confirmText: "Delete", dangerous: true });
  }

  /* ━━━ DOM Refs ━━━ */
  const screenMain = document.getElementById("screen-main");
  const screenSettings = document.getElementById("screen-settings");
  const settingsBtn = document.getElementById("settings-btn");
  const backBtn = document.getElementById("back-btn");
  const profileCountEl = document.getElementById("profile-count");
  const addProfileBtn = document.getElementById("add-profile-btn");
  const renameProfileBtn = document.getElementById("rename-profile-btn");
  const deleteProfileBtn = document.getElementById("delete-profile-btn");
  const accountBadgesEl = document.getElementById("account-badges");
  const scanBtn = document.getElementById("scan-btn");
  const fieldsSection = document.getElementById("fields-section");
  const fieldCount = document.getElementById("field-count");
  const fieldsContainer = document.getElementById("fields-container");
  const actionsSection = document.getElementById("actions-section");
  const fillBtn = document.getElementById("fill-btn");
  const saveBtn = document.getElementById("save-btn");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importInput = document.getElementById("import-input");
  const clearProjectBtn = document.getElementById("clear-project-btn");
  const clearAllBtn = document.getElementById("clear-all-btn");

  const projectDD = new Dropdown(document.getElementById("project-dropdown"));
  const profileDD = new Dropdown(document.getElementById("profile-dropdown"));

  let projectKey = "";
  let scannedFields = [];

  /* ━━━ Helpers ━━━ */
  function toast(msg, type = "info") {
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null));
    });
  }

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function storageSet(data) {
    return new Promise((resolve) => chrome.storage.local.set(data, resolve));
  }

  /* ━━━ Screen Navigation ━━━ */
  settingsBtn.addEventListener("click", () => {
    screenMain.classList.add("hidden");
    screenSettings.classList.remove("hidden");
  });
  backBtn.addEventListener("click", () => {
    screenSettings.classList.add("hidden");
    screenMain.classList.remove("hidden");
  });

  /* ━━━ Project Key ━━━ */
  function deriveProjectKey(url, title) {
    let origin;
    try { origin = new URL(url).origin; } catch { origin = url; }

    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(origin);
    if (isLocal) {
      const cleanTitle = (title || "untitled")
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9_\-]/g, "")
        .toLowerCase()
        .slice(0, 40);
      return origin + "/" + cleanTitle;
    }
    return origin;
  }

  /* ━━━ Storage ━━━ */
  async function getProjectData() {
    const { projects } = await storageGet("projects");
    const all = projects || {};
    if (!all[projectKey]) all[projectKey] = { fields: [], profiles: {} };
    return { all, project: all[projectKey] };
  }

  async function saveProjectData(all) {
    await storageSet({ projects: all });
  }

  /* ━━━ Project List ━━━ */
  async function loadProjectList() {
    const { projects } = await storageGet("projects");
    const all = projects || {};
    const keys = Object.keys(all);

    if (!keys.includes(projectKey) && projectKey && projectKey !== "unknown") {
      keys.unshift(projectKey);
    }

    const items = keys.map((key) => {
      let text;
      try {
        const u = new URL(key);
        text = u.hostname + (u.pathname !== "/" ? u.pathname : "");
      } catch {
        text = key;
      }
      return { value: key, text, title: key };
    });

    projectDD.setItems(items);
    projectDD.value = projectKey;
  }

  projectDD.onChange(async () => {
    projectKey = projectDD.value;
    scannedFields = [];
    fieldsSection.classList.add("hidden");
    actionsSection.classList.add("hidden");
    fieldsContainer.innerHTML = "";
    await loadProfiles();
    await tryRestoreFields();
  });

  /* ━━━ Profiles ━━━ */
  async function loadProfiles() {
    const { all, project } = await getProjectData();
    const names = Object.keys(project.profiles);

    if (names.length === 0) {
      project.profiles["default"] = { values: {} };
      await saveProjectData(all);
      names.push("default");
    }

    const items = names.map((name) => ({ value: name, text: name }));
    profileDD.setItems(items);

    profileCountEl.textContent = names.length;

    const { lastProfile } = await storageGet("lastProfile");
    const last = lastProfile && lastProfile[projectKey];
    if (last && names.includes(last)) {
      profileDD.value = last;
    } else {
      profileDD.value = names[0];
    }

    renderAccountBadges();
  }

  /* ━━━ Account Badges ━━━ */
  function renderAccountBadges() {
    accountBadgesEl.innerHTML = "";
    const items = profileDD.items;
    if (items.length <= 1) return;

    items.forEach((item) => {
      const badge = document.createElement("button");
      badge.className = "account-badge" + (item.value === profileDD.value ? " active" : "");
      badge.textContent = item.text;
      badge.title = item.value;
      badge.addEventListener("click", async () => {
        profileDD.value = item.value;
        await saveLastProfile();
        renderAccountBadges();
        renderFieldValues();
      });
      accountBadgesEl.appendChild(badge);
    });
  }

  async function saveLastProfile() {
    const { lastProfile } = await storageGet("lastProfile");
    const map = lastProfile || {};
    map[projectKey] = profileDD.value;
    await storageSet({ lastProfile: map });
  }

  function currentProfileName() {
    return profileDD.value;
  }

  /* ━━━ Profile CRUD ━━━ */
  addProfileBtn.addEventListener("click", async () => {
    const name = await showPrompt("New Account");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const { all, project } = await getProjectData();
    if (project.profiles[trimmed]) {
      toast("Account already exists", "error");
      return;
    }
    project.profiles[trimmed] = { values: {} };
    await saveProjectData(all);
    await loadProfiles();
    profileDD.value = trimmed;
    await saveLastProfile();
    renderAccountBadges();
    toast("Account created", "success");
    renderFieldValues();
  });

  renameProfileBtn.addEventListener("click", async () => {
    const oldName = currentProfileName();
    if (!oldName) return;
    const newName = await showPrompt("Rename Account", oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    const { all, project } = await getProjectData();
    if (project.profiles[trimmed]) {
      toast("Name already taken", "error");
      return;
    }
    project.profiles[trimmed] = project.profiles[oldName];
    delete project.profiles[oldName];
    await saveProjectData(all);
    await loadProfiles();
    profileDD.value = trimmed;
    await saveLastProfile();
    renderAccountBadges();
    toast("Account renamed", "success");
    renderFieldValues();
  });

  deleteProfileBtn.addEventListener("click", async () => {
    const name = currentProfileName();
    if (!name) return;
    const { all, project } = await getProjectData();
    if (Object.keys(project.profiles).length <= 1) {
      toast("Can't delete the only account", "error");
      return;
    }
    const confirmed = await showDangerConfirm("Delete Account", 'Are you sure you want to delete "' + name + '"?');
    if (!confirmed) return;
    delete project.profiles[name];
    await saveProjectData(all);
    await loadProfiles();
    await saveLastProfile();
    renderAccountBadges();
    toast("Account deleted", "success");
    renderFieldValues();
  });

  profileDD.onChange(async () => {
    await saveLastProfile();
    renderAccountBadges();
    renderFieldValues();
  });

  /* ━━━ Scanning ━━━ */
  scanBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) { toast("No active tab", "error"); return; }

    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning\u2026";

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });

      chrome.tabs.sendMessage(tab.id, { action: "scanFields" }, async (response) => {
        scanBtn.disabled = false;
        scanBtn.textContent = "Find Fields";

        if (chrome.runtime.lastError) {
          toast("Could not scan page", "error");
          return;
        }

        const fields = response?.fields || [];
        if (fields.length === 0) {
          toast("No input fields found", "error");
          return;
        }

        scannedFields = fields;

        const { all, project } = await getProjectData();
        project.fields = fields;
        await saveProjectData(all);
        await loadProjectList();

        toast(fields.length + " field(s) found", "success");
        showFields();
      });
    } catch (err) {
      scanBtn.disabled = false;
      scanBtn.textContent = "Find Fields";
      toast("Error: " + err.message, "error");
    }
  });

  /* ━━━ Fields ━━━ */
  function showFields() {
    fieldsSection.classList.remove("hidden");
    actionsSection.classList.remove("hidden");
    fieldCount.textContent = scannedFields.length;
    renderFieldValues();
  }

  async function renderFieldValues() {
    fieldsContainer.innerHTML = "";
    if (scannedFields.length === 0) return;

    const { project } = await getProjectData();
    const profile = project.profiles[currentProfileName()] || { values: {} };
    const saved = profile.values || {};

    scannedFields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "field-row";

      const label = document.createElement("span");
      label.className = "field-label";
      label.textContent = field.displayName;
      label.title = field.key;

      let input;
      if (field.type === "select" && field.options) {
        input = document.createElement("select");
        input.className = "field-input";
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "\u2014 select \u2014";
        input.appendChild(emptyOpt);
        field.options.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o.value;
          opt.textContent = o.text || o.value;
          input.appendChild(opt);
        });
        input.value = saved[field.key] || "";
      } else if (field.type === "checkbox" || field.type === "radio") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = saved[field.key] === "true";
      } else {
        input = document.createElement("input");
        input.type = field.type === "password" ? "password" : "text";
        input.placeholder = "Enter value\u2026";
        input.value = saved[field.key] || "";
      }
      input.dataset.fieldKey = field.key;

      row.appendChild(label);
      row.appendChild(input);
      fieldsContainer.appendChild(row);
    });
  }

  function collectValues() {
    const values = {};
    fieldsContainer.querySelectorAll(".field-row").forEach((row) => {
      const input = row.querySelector("input, select.field-input");
      if (!input) return;
      const key = input.dataset.fieldKey;
      if (input.type === "checkbox") {
        values[key] = input.checked ? "true" : "false";
      } else {
        values[key] = input.value;
      }
    });
    return values;
  }

  /* ━━━ Save ━━━ */
  saveBtn.addEventListener("click", async () => {
    const values = collectValues();
    const { all, project } = await getProjectData();
    if (!project.profiles[currentProfileName()]) {
      project.profiles[currentProfileName()] = { values: {} };
    }
    project.profiles[currentProfileName()].values = values;
    await saveProjectData(all);
    toast("Saved", "success");
  });

  /* ━━━ Fill ━━━ */
  fillBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) { toast("No active tab", "error"); return; }

    const values = collectValues();
    const { all, project } = await getProjectData();
    if (!project.profiles[currentProfileName()]) {
      project.profiles[currentProfileName()] = { values: {} };
    }
    project.profiles[currentProfileName()].values = values;
    await saveProjectData(all);

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      chrome.tabs.sendMessage(tab.id, { action: "fillFields", values }, (response) => {
        if (chrome.runtime.lastError) {
          toast("Fill failed", "error");
          return;
        }
        toast("Form filled", "success");
      });
    } catch (err) {
      toast("Error: " + err.message, "error");
    }
  });

  /* ━━━ Settings ━━━ */
  exportBtn.addEventListener("click", async () => {
    const { projects } = await storageGet("projects");
    const blob = new Blob([JSON.stringify(projects || {}, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "form-filler-data.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported", "success");
  });

  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (typeof data !== "object" || data === null) throw new Error("Invalid format");
        const { projects } = await storageGet("projects");
        const merged = Object.assign(projects || {}, data);
        await storageSet({ projects: merged });
        toast("Imported", "success");
        await loadProjectList();
        await loadProfiles();
        await tryRestoreFields();
      } catch (err) {
        toast("Import failed: " + err.message, "error");
      }
    };
    reader.readAsText(file);
    importInput.value = "";
  });

  clearProjectBtn.addEventListener("click", async () => {
    const confirmed = await showDangerConfirm("Clear Project", "This will delete all accounts and fields for this project.");
    if (!confirmed) return;
    const { all } = await getProjectData();
    delete all[projectKey];
    await saveProjectData(all);
    scannedFields = [];
    fieldsSection.classList.add("hidden");
    actionsSection.classList.add("hidden");
    fieldsContainer.innerHTML = "";
    await loadProjectList();
    await loadProfiles();
    toast("Project data cleared", "success");
  });

  clearAllBtn.addEventListener("click", async () => {
    const confirmed = await showDangerConfirm("Clear Everything", "This will permanently delete ALL saved data across every project.");
    if (!confirmed) return;
    await storageSet({ projects: {} });
    scannedFields = [];
    fieldsSection.classList.add("hidden");
    actionsSection.classList.add("hidden");
    fieldsContainer.innerHTML = "";
    await loadProjectList();
    await loadProfiles();
    toast("All data cleared", "success");
  });

  /* ━━━ Auto-Restore ━━━ */
  async function tryRestoreFields() {
    const { project } = await getProjectData();
    if (project.fields && project.fields.length > 0) {
      scannedFields = project.fields;
      showFields();
    }
  }

  /* ━━━ Init ━━━ */
  async function init() {
    const tab = await getActiveTab();
    if (tab) {
      projectKey = deriveProjectKey(tab.url || "", tab.title || "");
    } else {
      projectKey = "unknown";
    }
    await loadProjectList();
    await loadProfiles();
    await tryRestoreFields();
  }

  init();
});
