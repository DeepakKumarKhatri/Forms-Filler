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
        profile,
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