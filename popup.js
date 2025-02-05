import { FileStorageManager } from "./src/managers/file-storage-manager.js";
import { FileUploadUIHandler } from "./src/handlers/file-upload-handler.js";
import {
  showNotification,
  truncateFileName,
  getFileIcon,
} from "./src/utils/helpers.js";

document.addEventListener("DOMContentLoaded", () => {
  let currentProfile = "default";
  let isLocked = false;

  const fieldsContainer = document.getElementById("fields-container");
  const fileList = document.getElementById("file-list");
  const passwordScreen = document.getElementById("password-screen");
  const mainContent = document.getElementById("main-content");
  const unlockBtn = document.getElementById("unlock-btn");
  const passwordInput = document.getElementById("password-input");
  const profileSelect = document.getElementById("profile-select");
  const addProfileBtn = document.getElementById("add-profile");
  const addFieldButton = document.getElementById("add-field");
  const fillFormsButton = document.getElementById("fill-forms");
  const copyDataButton = document.getElementById("copy-data");
  const exportDataButton = document.getElementById("export-data");
  const importDataButton = document.getElementById("import-data");
  const importInput = document.getElementById("import-input");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const storageManager = new FileStorageManager();
  const uiHandler = new FileUploadUIHandler(storageManager);

  async function initializeStorage() {
    try {
      await storageManager.initialize();
      await loadProfilesWithFiles();
    } catch (error) {
      showNotification("Error initializing storage", "error");
    }
  }

  const deleteProfileBtn = document.createElement("button");
  deleteProfileBtn.textContent = "🗑️";
  deleteProfileBtn.className = "icon-button";
  deleteProfileBtn.title = "Delete Profile";
  deleteProfileBtn.addEventListener("click", () => {
    if (currentProfile === "default") {
      showNotification("Cannot delete default profile", "error");
      return;
    }

    if (
      confirm(`Are you sure you want to delete profile "${currentProfile}"?`)
    ) {
      chrome.storage.sync.get(["profiles"], (result) => {
        const profiles = result.profiles || {};
        delete profiles[currentProfile];
        chrome.storage.sync.set({ profiles }, () => {
          showNotification("Profile deleted successfully", "success");
          currentProfile = "default";
          loadProfiles();
        });
      });
    }
  });
  document.querySelector(".profile-section").appendChild(deleteProfileBtn);

  initializeStorage();

  async function loadProfilesWithFiles() {
    chrome.storage.sync.get(["profiles"], async (result) => {
      const profiles = result.profiles || {
        default: { fields: [], files: [] },
      };
      profileSelect.innerHTML = "";

      // Populate profile dropdown
      Object.keys(profiles).forEach((profile) => {
        const option = document.createElement("option");
        option.value = profile;
        option.textContent = profile;
        profileSelect.appendChild(option);
      });

      // Set initial profile and load its data
      currentProfile = profileSelect.value;
      await loadCurrentProfileWithFiles();
    });
  }

  async function loadCurrentProfileWithFiles() {
    try {
      // Load sync storage profile data
      chrome.storage.sync.get(["profiles"], async (result) => {
        const profiles = result.profiles || {};
        const profile = profiles[currentProfile] || { fields: [], files: [] };

        // Clear existing content
        fieldsContainer.innerHTML = "";
        fileList.innerHTML = "";

        // Add fields
        if (Array.isArray(profile.fields)) {
          profile.fields.forEach((field) => {
            if (
              field &&
              typeof field.label === "string" &&
              typeof field.value === "string"
            ) {
              addFieldToUI(field.label, field.value);
            }
          });
        }

        // Fetch and display files from local storage
        try {
          const files = await storageManager.listFiles(currentProfile);
          files.forEach((fileInfo) => {
            uiHandler.addFileToUI(fileInfo);
          });
        } catch (error) {
          showNotification("Error loading files", "error");
        }
      });
    } catch (error) {
      showNotification("Error loading profile", "error");
      fieldsContainer.innerHTML = "";
      fileList.innerHTML = "";
    }
  }

  function handleFiles(files) {
    try {
      uiHandler.handleFiles(files, currentProfile);
    } catch (error) {
      showNotification(error.message, "error");
    }
  }

  // Update existing event listeners
  profileSelect.addEventListener("change", async (e) => {
    currentProfile = e.target.value;
    await loadCurrentProfileWithFiles();
  });

  chrome.storage.sync.get(["profiles"], (result) => {
    if (!result.profiles) {
      chrome.storage.sync.set(
        {
          profiles: {
            default: {
              fields: [],
              files: [],
            },
          },
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error initializing storage:",
              chrome.runtime.lastError
            );
          } else {
            loadProfiles();
          }
        }
      );
    } else {
      loadProfiles();
    }
  });

  // Check if the extension is locked
  chrome.storage.sync.get(["isLocked", "password"], (result) => {
    isLocked = result.isLocked || false;
    if (isLocked) {
      passwordScreen.classList.remove("hidden");
    } else {
      mainContent.classList.remove("hidden");
      loadProfiles();
    }
  });

  unlockBtn.addEventListener("click", () => {
    chrome.storage.sync.get(["password"], (result) => {
      if (passwordInput.value === result.password) {
        isLocked = false;
        chrome.storage.sync.set({ isLocked: false });
        passwordScreen.classList.add("hidden");
        mainContent.classList.remove("hidden");
        loadProfiles();
      } else {
        showNotification("Incorrect password", "error");
      }
    });
  });

  function loadProfiles() {
    chrome.storage.sync.get(["profiles"], (result) => {
      const profiles = result.profiles || {
        default: { fields: [], files: [] },
      };
      profileSelect.innerHTML = "";
      Object.keys(profiles).forEach((profile) => {
        const option = document.createElement("option");
        option.value = profile;
        option.textContent = profile;
        profileSelect.appendChild(option);
      });

      // Set initial profile value and load it
      currentProfile = profileSelect.value;
      loadCurrentProfile();
    });
  }

  function loadCurrentProfile() {
    chrome.storage.sync.get(["profiles"], (result) => {
      try {
        const profiles = result.profiles || {};
        const profile = profiles[currentProfile] || { fields: [], files: [] };

        // Clear existing content
        fieldsContainer.innerHTML = "";
        fileList.innerHTML = "";

        // Add fields if they exist
        if (Array.isArray(profile.fields)) {
          profile.fields.forEach((field) => {
            if (
              field &&
              typeof field.label === "string" &&
              typeof field.value === "string"
            ) {
              addFieldToUI(field.label, field.value);
            }
          });
        }

        // Add files if they exist
        if (Array.isArray(profile.files)) {
          profile.files.forEach((file) => {
            if (
              file &&
              typeof file.name === "string" &&
              typeof file.data === "string"
            ) {
              addFileToUI(file.name, file.data);
            }
          });
        }
      } catch (error) {
        showNotification("Error loading profile", "error");
        // Initialize with empty profile
        fieldsContainer.innerHTML = "";
        fileList.innerHTML = "";
      }
    });
  }

  addProfileBtn.addEventListener("click", () => {
    const profileName = prompt("Enter new profile name:");
    if (profileName) {
      chrome.storage.sync.get(["profiles"], (result) => {
        const profiles = result.profiles || {};
        if (!profiles[profileName]) {
          profiles[profileName] = { fields: [], files: [] };
          chrome.storage.sync.set({ profiles: profiles }, () => {
            loadProfiles();
            showNotification("Profile added successfully", "success");
          });
        } else {
          showNotification("Profile already exists", "error");
        }
      });
    }
  });

  addFieldButton.addEventListener("click", () => {
    addFieldToUI();
  });

  fillFormsButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]?.id) {
        showNotification("No active tab found", "error");
        return;
      }

      try {
        // First, ensure the content script is injected
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"],
        });

        // Then send the message
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "fillForms",
            profile: currentProfile,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Message sending failed:",
                chrome.runtime.lastError
              );
              showNotification("Error: Unable to fill forms", "error");
              return;
            }

            if (response && response.success) {
              showNotification("Forms filled successfully", "success");
            } else {
              showNotification(
                response?.error || "Error filling forms",
                "error"
              );
            }
          }
        );
      } catch (error) {
        showNotification("Error: Unable to access page", "error");
      }
    });
  });

  copyDataButton.addEventListener("click", () => {
    chrome.storage.sync.get(["profiles"], (result) => {
      const profiles = result.profiles || {};
      const currentProfileData = profiles[currentProfile];
      navigator.clipboard
        .writeText(JSON.stringify(currentProfileData, null, 2))
        .then(() => showNotification("Data copied to clipboard", "success"))
        .catch((err) => {
          showNotification("Error copying data", "error");
        });
    });
  });

  exportDataButton.addEventListener("click", () => {
    chrome.storage.sync.get(["profiles"], (result) => {
      const profiles = result.profiles || {};
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(profiles));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "form_filler_data.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      showNotification("Data exported successfully", "success");
    });
  });

  importDataButton.addEventListener("click", () => {
    importInput.click();
  });

  importInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          chrome.storage.sync.set({ profiles: importedData }, () => {
            showNotification("Data imported successfully", "success");
            loadProfiles();
          });
        } catch (error) {
          showNotification("Error importing data: " + error, "error");
        }
      };
      reader.readAsText(file);
    }
  });

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    uiHandler.handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", handleFileSelect);

  function handleFileSelect(e) {
    handleFiles(e.target.files);
  }

  function addFileToUI(name, data, type = "") {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";

    // Add icon based on file type
    const icon = document.createElement("span");
    icon.className = "file-icon";

    if (type === "image") {
      const img = document.createElement("img");
      img.src = data;
      img.className = "file-thumbnail";
      icon.appendChild(img);
    } else {
      icon.textContent = getFileIcon(type);
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name";
    nameSpan.textContent = truncateFileName(name, 20);
    nameSpan.title = name; // Show full name on hover

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";
    deleteBtn.className = "icon-button";
    deleteBtn.addEventListener("click", () => {
      removeFile(name);
      fileList.removeChild(fileItem);
    });

    fileItem.appendChild(icon);
    fileItem.appendChild(nameSpan);
    fileItem.appendChild(deleteBtn);
    fileList.appendChild(fileItem);
  }

  function removeFile(fileId) {
    try {
      storageManager.deleteFile(fileId);
      const fileItem = document.querySelector(
        `[data-file-id="${fileId}"]`
      ).parentElement;
      fileItem.remove();
      showNotification("File removed successfully", "success");
    } catch (error) {
      showNotification("Error removing file", "error");
    }
  }

  function addFieldToUI(label = "", value = "") {
    const fieldDiv = document.createElement("div");
    fieldDiv.className = "field";
    fieldDiv.dataset.fieldId = Date.now().toString();

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = "Label";
    labelInput.value = label;

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "Value";
    valueInput.value = value;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "X";
    deleteButton.className = "icon-button delete-field";
    deleteButton.addEventListener("click", () => {
      if (confirm("Are you sure you want to delete this field?")) {
        fieldsContainer.removeChild(fieldDiv);
        saveFields();
        showNotification("Field deleted successfully", "success");
      }
    });

    fieldDiv.appendChild(labelInput);
    fieldDiv.appendChild(valueInput);
    fieldDiv.appendChild(deleteButton);

    fieldsContainer.appendChild(fieldDiv);

    labelInput.addEventListener("input", saveFields);
    valueInput.addEventListener("input", saveFields);
  }

  function saveFields() {
    try {
      const fields = Array.from(fieldsContainer.children)
        .map((field) => {
          const labelInput = field.children[0];
          const valueInput = field.children[1];
          return {
            label: labelInput ? labelInput.value.trim() : "",
            value: valueInput ? valueInput.value : "",
          };
        })
        .filter((field) => field.label); // Only save fields with labels

      chrome.storage.sync.get(["profiles"], (result) => {
        try {
          const profiles = result.profiles || {};
          if (!profiles[currentProfile]) {
            profiles[currentProfile] = { fields: [], files: [] };
          }
          profiles[currentProfile].fields = fields;

          chrome.storage.sync.set({ profiles }, () => {
            if (chrome.runtime.lastError) {
              showNotification(
                "Error saving data: " + chrome.runtime.lastError.message,
                "error"
              );
            }
          });
        } catch (error) {
          showNotification("Error saving fields: " + error.message, "error");
        }
      });
    } catch (error) {
      showNotification("Error processing fields: " + error.message, "error");
    }
  }
});
