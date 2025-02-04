const STORAGE_CONFIG = {
  LOCAL: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB per file
    MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100MB total (adjustable)
  },
  SYNC: {
    MAX_ITEM_SIZE: 8 * 1024, // 8KB per item
  },
  ALLOWED_FILE_TYPES: {
    "image/jpeg": true,
    "image/png": true,
    "image/gif": true,
    "application/pdf": true,
    "application/msword": true,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  },
};

class FileStorageManager {
  constructor() {
    this.currentProfile = "default";
  }

  async initialize() {
    try {
      const { fileRegistry } = (await this.getLocalStorage("fileRegistry")) || {
        fileRegistry: {},
      };
      if (!fileRegistry) {
        await this.setLocalStorage({ fileRegistry: {} });
      }
    } catch (error) {
      console.error("Storage initialization error:", error);
      throw error;
    }
  }

  async storeFile(file, profile = this.currentProfile) {
    try {
      // Validate file
      if (!this.validateFile(file)) {
        throw new Error("Invalid file type or size");
      }

      // Read file
      const fileData = await this.readFileAsDataUrl(file);
      const fileId = this.generateFileId();
      const fileInfo = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        profile: currentProfile,
        timestamp: Date.now(),
      };

      // Update registry in sync storage (metadata only)
      await this.updateFileRegistry(fileInfo);

      // Store actual file data in local storage
      await this.setLocalStorage({ [fileId]: fileData });

      return fileInfo;
    } catch (error) {
      console.error("File storage error:", error);
      throw error;
    }
  }

  async getFile(fileId) {
    try {
      const { fileRegistry } = await this.getLocalStorage("fileRegistry");
      const fileInfo = fileRegistry[fileId];

      if (!fileInfo) {
        throw new Error("File not found");
      }

      const fileData = await this.getLocalStorage(fileId);
      return {
        ...fileInfo,
        data: fileData[fileId],
      };
    } catch (error) {
      console.error("File retrieval error:", error);
      throw error;
    }
  }

  async deleteFile(fileId) {
    try {
      // Remove from registry
      const { fileRegistry } = await this.getLocalStorage("fileRegistry");
      delete fileRegistry[fileId];
      await this.setLocalStorage({ fileRegistry });

      // Remove file data
      await this.removeLocalStorage(fileId);

      return true;
    } catch (error) {
      console.error("File deletion error:", error);
      throw error;
    }
  }

  async listFiles(profile = this.currentProfile) {
    try {
      const { fileRegistry } = await this.getLocalStorage("fileRegistry");
      return Object.values(fileRegistry).filter(
        (file) => file.profile === profile
      );
    } catch (error) {
      console.error("File listing error:", error);
      throw error;
    }
  }

  validateFile(file) {
    return (
      STORAGE_CONFIG.ALLOWED_FILE_TYPES[file.type] &&
      file.size <= STORAGE_CONFIG.LOCAL.MAX_FILE_SIZE
    );
  }

  async readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async updateFileRegistry(fileInfo) {
    const { fileRegistry } = (await this.getLocalStorage("fileRegistry")) || {
      fileRegistry: {},
    };
    fileRegistry[fileInfo.id] = fileInfo;
    await this.setLocalStorage({ fileRegistry });
  }

  getLocalStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, resolve);
    });
  }

  setLocalStorage(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  }

  removeLocalStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  }
}

class FileUploadUIHandler {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.initializeUI();
  }

  initializeUI() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");

    dropZone.addEventListener("dragover", this.handleDragOver.bind(this));
    dropZone.addEventListener("drop", this.handleDrop.bind(this));
    fileInput.addEventListener("change", this.handleFileSelect.bind(this));
  }

  async handleFiles(files) {
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileInfo = await this.storageManager.storeFile(file);
        this.addFileToUI(fileInfo);
        return fileInfo;
      });

      await Promise.all(uploadPromises);
      this.showNotification("Files uploaded successfully", "success");
    } catch (error) {
      this.showNotification(error.message, "error");
    }
  }

  addFileToUI(fileInfo) {
    const fileList = document.getElementById("file-list");
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";

    fileItem.innerHTML = `
        <span class="file-icon">${this.getFileIcon(fileInfo.type)}</span>
        <span class="file-name" title="${
          fileInfo.name
        }">${this.truncateFileName(fileInfo.name, 20)}</span>
        <span class="file-size">${this.formatFileSize(fileInfo.size)}</span>
        <button class="icon-button delete-file" data-file-id="${
          fileInfo.id
        }">X</button>
      `;

    fileItem.querySelector(".delete-file").addEventListener("click", () => {
      this.handleDeleteFile(fileInfo.id);
    });

    fileList.appendChild(fileItem);
  }

  // UI Helper methods
  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  }

  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    this.handleFiles(e.dataTransfer.files);
  }

  handleFileSelect(e) {
    this.handleFiles(e.target.files);
  }

  async handleDeleteFile(fileId) {
    try {
      await this.storageManager.deleteFile(fileId);
      const fileItem = document.querySelector(
        `[data-file-id="${fileId}"]`
      ).parentElement;
      fileItem.remove();
      this.showNotification("File deleted successfully", "success");
    } catch (error) {
      this.showNotification("Error deleting file", "error");
    }
  }

  getFileIcon(type) {
    const icons = {
      image: "🖼️",
      "application/pdf": "📄",
      "application/msword": "📝",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "📝",
    };
    return icons[type] || "📎";
  }

  truncateFileName(name, maxLength) {
    if (name.length <= maxLength) return name;
    const ext = name.split(".").pop();
    const nameWithoutExt = name.slice(0, -(ext.length + 1));
    return `${nameWithoutExt.slice(0, maxLength - 3)}...${ext}`;
  }

  formatFileSize(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  showNotification(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
}

let currentProfile = "default";
let isLocked = false;

document.addEventListener("DOMContentLoaded", () => {
  currentProfile = "default";

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
      uiHandler.handleFiles(files);
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

  function addFileToStorage(name, data) {
    chrome.storage.sync.get(["profiles"], (result) => {
      const profiles = result.profiles || {};
      if (!profiles[currentProfile]) {
        profiles[currentProfile] = { fields: [], files: [] };
      }

      // Calculate size before adding new file
      const newFile = { name, data };
      const currentProfileSize = new Blob([
        JSON.stringify(profiles[currentProfile]),
      ]).size;
      const newFileSize = new Blob([JSON.stringify(newFile)]).size;

      // Chrome sync storage has a limit of 8KB per item
      const SYNC_STORAGE_LIMIT = 8192; // 8KB in bytes

      if (currentProfileSize + newFileSize > SYNC_STORAGE_LIMIT) {
        showNotification(
          "File is too large. Maximum size when combined with existing data cannot exceed 8KB.",
          "error"
        );
        return;
      }

      // Check if file with same name exists
      const existingFileIndex = profiles[currentProfile].files.findIndex(
        (file) => file.name === name
      );

      if (existingFileIndex !== -1) {
        // Update existing file
        profiles[currentProfile].files[existingFileIndex] = newFile;
      } else {
        // Add new file
        profiles[currentProfile].files.push(newFile);
      }

      // Save to storage with error handling
      chrome.storage.sync.set({ profiles }, () => {
        if (chrome.runtime.lastError) {
          console.error("Storage error:", chrome.runtime.lastError);
          showNotification(
            `Error saving file: ${chrome.runtime.lastError.message}`,
            "error"
          );
          return;
        }

        addFileToUI(name, data);
        showNotification("File saved successfully", "success");
      });
    });
  }

  function handleFiles(files) {
    const MAX_FILE_SIZE = 6 * 1024; // 6KB to leave room for other data

    const promises = Array.from(files).map((file) => {
      return new Promise((resolve, reject) => {
        if (file.size > MAX_FILE_SIZE) {
          reject(`File ${file.name} is too large. Maximum size is 6KB`);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const fileType = file.type.split("/")[0];
          const base64Data = e.target.result;

          // Check encoded data size
          const encodedSize = new Blob([base64Data]).size;
          if (encodedSize > MAX_FILE_SIZE) {
            reject(`Encoded file ${file.name} is too large after conversion`);
            return;
          }

          resolve({
            name: file.name,
            data: base64Data,
            type: fileType,
          });
        };
        reader.onerror = (e) => reject(`Error reading file ${file.name}`);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises)
      .then((fileData) => {
        fileData.forEach(({ name, data, type }) =>
          addFileToStorage(name, data, type)
        );
      })
      .catch((error) => {
        showNotification(error, "error");
      });
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

  function getFileIcon(type) {
    const icons = {
      image: "🖼️",
      text: "📄",
      application: "📎",
      audio: "🎵",
      video: "🎥",
    };
    return icons[type] || "📄";
  }

  function truncateFileName(name, maxLength) {
    if (name.length <= maxLength) return name;
    const ext = name.split(".").pop();
    const nameWithoutExt = name.slice(0, -(ext.length + 1));
    return `${nameWithoutExt.slice(0, maxLength - 3)}...${ext}`;
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
    deleteButton.className = "icon-button";
    deleteButton.addEventListener("click", () => {
      fieldsContainer.removeChild(fieldDiv);
      saveFields();
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

  function showNotification(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
});
