let currentProfile = "default";
let isLocked = false;

document.addEventListener("DOMContentLoaded", () => {
  currentProfile = "default";

  const fieldsContainer = document.getElementById("fields-container");
  const fileList = document.getElementById("file-list");

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
        alert("Incorrect password");
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
        console.error("Error loading profile:", error);
        // Initialize with empty profile
        fieldsContainer.innerHTML = "";
        fileList.innerHTML = "";
      }
    });
  }

  profileSelect.addEventListener("change", (e) => {
    currentProfile = e.target.value;
    loadCurrentProfile();
  });

  addProfileBtn.addEventListener("click", () => {
    const profileName = prompt("Enter new profile name:");
    if (profileName) {
      chrome.storage.sync.get(["profiles"], (result) => {
        const profiles = result.profiles || {};
        if (!profiles[profileName]) {
          profiles[profileName] = { fields: [], files: [] };
          chrome.storage.sync.set({ profiles: profiles }, () => {
            loadProfiles();
          });
        } else {
          alert("Profile already exists");
        }
      });
    }
  });

  addFieldButton.addEventListener("click", () => {
    addFieldToUI();
  });

  fillFormsButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "fillForms",
        profile: currentProfile,
      });
    });
  });

  copyDataButton.addEventListener("click", () => {
    chrome.storage.sync.get(["profiles"], (result) => {
      const profiles = result.profiles || {};
      const currentProfileData = profiles[currentProfile];
      navigator.clipboard
        .writeText(JSON.stringify(currentProfileData, null, 2))
        .then(() => alert("Data copied to clipboard"))
        .catch((err) => console.error("Error copying data: ", err));
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
      downloadAnchorNode.setAttribute(
        "download",
        "smart_form_filler_data.json"
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
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
            alert("Data imported successfully");
            loadProfiles();
          });
        } catch (error) {
          alert("Error importing data: " + error);
        }
      };
      reader.readAsText(file);
    }
  });

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => e.preventDefault());
  dropZone.addEventListener("drop", handleFileDrop);
  fileInput.addEventListener("change", handleFileSelect);

  function handleFileDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function handleFileSelect(e) {
    handleFiles(e.target.files);
  }

  function handleFiles(files) {
    const MAX_FILE_SIZE = 100 * 1024; // 100KB limit for sync storage
    const promises = Array.from(files).map((file) => {
      return new Promise((resolve, reject) => {
        if (file.size > MAX_FILE_SIZE) {
          reject(`File ${file.name} is too large. Maximum size is 100KB`);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) =>
          resolve({ name: file.name, data: e.target.result });
        reader.onerror = (e) => reject(`Error reading file ${file.name}`);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises)
      .then((fileData) => {
        fileData.forEach(({ name, data }) => addFileToStorage(name, data));
      })
      .catch((error) => {
        console.error("File handling error:", error);
        alert(error);
      });
  }

  function addFileToStorage(name, data) {
    chrome.storage.sync.get(["profiles"], (result) => {
      const profiles = result.profiles || {};
      if (!profiles[currentProfile]) {
        profiles[currentProfile] = { fields: [], files: [] };
      }

      // Check storage quota
      const newFile = { name, data };
      const newSize = new Blob([JSON.stringify(profiles)]).size;

      if (newSize > chrome.storage.sync.QUOTA_BYTES_PER_ITEM) {
        alert("Storage quota exceeded. Try removing some files first.");
        return;
      }

      profiles[currentProfile].files.push(newFile);

      chrome.storage.sync.set({ profiles }, () => {
        if (chrome.runtime.lastError) {
          return;
        }
        addFileToUI(name, data);
      });
    });
  }

  function addFileToUI(name, data) {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.textContent = name;
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";
    deleteBtn.addEventListener("click", () => {
      removeFile(name);
      fileList.removeChild(fileItem);
    });
    fileItem.appendChild(deleteBtn);
    fileList.appendChild(fileItem);
  }

  function removeFile(name) {
    chrome.storage.sync.get(["profiles"], (result) => {
      const profiles = result.profiles || {};
      profiles[currentProfile].files = profiles[currentProfile].files.filter(
        (file) => file.name !== name
      );
      chrome.storage.sync.set({ profiles: profiles });
    });
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
              console.error("Storage error:", chrome.runtime.lastError);
              alert("Error saving data: " + chrome.runtime.lastError.message);
            }
          });
        } catch (error) {
          console.error("Error saving fields:", error);
          alert("Error saving fields: " + error.message);
        }
      });
    } catch (error) {
      console.error("Error processing fields:", error);
      alert("Error processing fields: " + error.message);
    }
  }
});
