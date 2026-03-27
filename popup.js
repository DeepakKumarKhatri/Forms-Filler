document.addEventListener("DOMContentLoaded", () => {
  // ── DOM refs: main screen ──
  const screenMain = document.getElementById("screen-main");
  const screenSettings = document.getElementById("screen-settings");
  const settingsBtn = document.getElementById("settings-btn");
  const backBtn = document.getElementById("back-btn");
  const projectSelect = document.getElementById("project-select");
  const profileSelect = document.getElementById("profile-select");
  const accountBadgesEl = document.getElementById("account-badges");
  const profileCountEl = document.getElementById("profile-count");
  const addProfileBtn = document.getElementById("add-profile-btn");
  const renameProfileBtn = document.getElementById("rename-profile-btn");
  const deleteProfileBtn = document.getElementById("delete-profile-btn");
  const scanBtn = document.getElementById("scan-btn");
  const fieldsSection = document.getElementById("fields-section");
  const fieldCount = document.getElementById("field-count");
  const fieldsContainer = document.getElementById("fields-container");
  const actionsSection = document.getElementById("actions-section");
  const fillBtn = document.getElementById("fill-btn");
  const saveBtn = document.getElementById("save-btn");

  // ── DOM refs: settings screen ──
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importInput = document.getElementById("import-input");
  const clearProjectBtn = document.getElementById("clear-project-btn");
  const clearAllBtn = document.getElementById("clear-all-btn");

  let projectKey = "";
  let scannedFields = [];

  // ── Helpers ──
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

  // ── Screen navigation ──
  settingsBtn.addEventListener("click", () => {
    screenMain.classList.add("hidden");
    screenSettings.classList.remove("hidden");
  });
  backBtn.addEventListener("click", () => {
    screenSettings.classList.add("hidden");
    screenMain.classList.remove("hidden");
  });

  // ── Project key derivation ──
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

  // ── Storage ──
  // Shape: { projects: { [projectKey]: { fields: [...], profiles: { [name]: { values: {} } } } } }
  async function getProjectData() {
    const { projects } = await storageGet("projects");
    const all = projects || {};
    if (!all[projectKey]) all[projectKey] = { fields: [], profiles: {} };
    return { all, project: all[projectKey] };
  }

  async function saveProjectData(all) {
    await storageSet({ projects: all });
  }

  // ── Project list ──
  async function loadProjectList() {
    const { projects } = await storageGet("projects");
    const all = projects || {};
    const keys = Object.keys(all);
    projectSelect.innerHTML = "";

    // Always ensure the current tab's project is in the list
    if (!keys.includes(projectKey) && projectKey && projectKey !== "unknown") {
      keys.unshift(projectKey);
    }

    keys.forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      // Show a friendlier label
      try {
        const u = new URL(key);
        opt.textContent = u.hostname + (u.pathname !== "/" ? u.pathname : "");
      } catch {
        opt.textContent = key;
      }
      opt.title = key;
      projectSelect.appendChild(opt);
    });

    projectSelect.value = projectKey;
  }

  projectSelect.addEventListener("change", async () => {
    projectKey = projectSelect.value;
    scannedFields = [];
    fieldsSection.classList.add("hidden");
    actionsSection.classList.add("hidden");
    fieldsContainer.innerHTML = "";
    await loadProfiles();
    await tryRestoreFields();
  });

  // ── Profiles ──
  async function loadProfiles() {
    const { all, project } = await getProjectData();
    const names = Object.keys(project.profiles);
    profileSelect.innerHTML = "";

    if (names.length === 0) {
      project.profiles["default"] = { values: {} };
      await saveProjectData(all);
      names.push("default");
    }

    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      profileSelect.appendChild(opt);
    });

    profileCountEl.textContent = names.length;

    const { lastProfile } = await storageGet("lastProfile");
    const last = lastProfile && lastProfile[projectKey];
    if (last && names.includes(last)) {
      profileSelect.value = last;
    }

    renderAccountBadges();
  }

  // ── Account badges ──
  function renderAccountBadges() {
    accountBadgesEl.innerHTML = "";
    const options = Array.from(profileSelect.options);
    if (options.length <= 1) return; // no badges if only one account

    options.forEach((opt) => {
      const badge = document.createElement("button");
      badge.className = "account-badge" + (opt.value === profileSelect.value ? " active" : "");
      badge.textContent = opt.textContent;
      badge.title = opt.value;
      badge.addEventListener("click", async () => {
        profileSelect.value = opt.value;
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
    map[projectKey] = profileSelect.value;
    await storageSet({ lastProfile: map });
  }

  function currentProfileName() {
    return profileSelect.value;
  }

  // ── Profile CRUD ──
  addProfileBtn.addEventListener("click", async () => {
    const name = prompt("New account name:");
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
    profileSelect.value = trimmed;
    await saveLastProfile();
    renderAccountBadges();
    toast("Account created", "success");
    renderFieldValues();
  });

  renameProfileBtn.addEventListener("click", async () => {
    const oldName = currentProfileName();
    if (!oldName) return;
    const newName = prompt("Rename account to:", oldName);
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
    profileSelect.value = trimmed;
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
    if (!confirm(`Delete account "${name}"?`)) return;
    delete project.profiles[name];
    await saveProjectData(all);
    await loadProfiles();
    await saveLastProfile();
    renderAccountBadges();
    toast("Account deleted", "success");
    renderFieldValues();
  });

  profileSelect.addEventListener("change", async () => {
    await saveLastProfile();
    renderFieldValues();
  });

  // ── Field scanning ──
  scanBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab?.id) { toast("No active tab", "error"); return; }

    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning...";

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

        // Persist scanned fields for this project so they auto-load next time
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

  // ── Render fields ──
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
        emptyOpt.textContent = "— select —";
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
        input.placeholder = "Enter value...";
        input.value = saved[field.key] || "";
      }
      input.dataset.fieldKey = field.key;

      row.appendChild(label);
      row.appendChild(input);
      fieldsContainer.appendChild(row);
    });
  }

  // ── Collect values from UI ──
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

  // ── Save ──
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

  // ── Fill ──
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

  // ── Settings: Export ──
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

  // ── Settings: Import ──
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
        await loadProfiles();
        await tryRestoreFields();
      } catch (err) {
        toast("Import failed: " + err.message, "error");
      }
    };
    reader.readAsText(file);
    importInput.value = "";
  });

  // ── Settings: Clear project data ──
  clearProjectBtn.addEventListener("click", async () => {
    if (!confirm(`Clear all data for this project?`)) return;
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

  // ── Settings: Clear all data ──
  clearAllBtn.addEventListener("click", async () => {
    if (!confirm("Delete ALL saved data across every project?")) return;
    await storageSet({ projects: {} });
    scannedFields = [];
    fieldsSection.classList.add("hidden");
    actionsSection.classList.add("hidden");
    fieldsContainer.innerHTML = "";
    await loadProjectList();
    await loadProfiles();
    toast("All data cleared", "success");
  });

  // ── Auto-restore saved fields on popup open ──
  async function tryRestoreFields() {
    const { project } = await getProjectData();
    if (project.fields && project.fields.length > 0) {
      scannedFields = project.fields;
      showFields();
    }
  }

  // ── Init ──
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
