import STORAGE_CONFIG from "../utils/config.js";

export class FileStorageManager {
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

  async storeFile(file, currentProfile) {
    try {
      if (file.size > STORAGE_CONFIG.LOCAL.MAX_FILE_SIZE) {
        throw new Error(
          `File size exceeds the maximum allowed (${
            STORAGE_CONFIG.LOCAL.MAX_FILE_SIZE / (1024 * 1024)
          }MB)`
        );
      }

      const fileData = await this.readFileAsDataUrl(file);
      const fileId = this.generateFileId();
      const fileInfo = {
        id: fileId,
        name: file.name,
        type: file.type || this.guessFileType(file.name),
        size: file.size,
        profile: currentProfile || "default",
        timestamp: Date.now(),
      };

      // Update registry in local storage (metadata only)
      await this.updateFileRegistry(fileInfo);

      // Store actual file data in local storage
      await this.setLocalStorage({ [fileId]: fileData });

      return fileInfo;
    } catch (error) {
      console.error("File storage error:", error);
      throw error;
    }
  }

  guessFileType(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      csv: "text/csv",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    return mimeTypes[ext] || "application/octet-stream";
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

      if (!fileRegistry || !fileRegistry[fileId]) {
        throw new Error("File not found in registry");
      }

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
      const { fileRegistry } = (await this.getLocalStorage("fileRegistry")) || {
        fileRegistry: {},
      };

      if (!fileRegistry) {
        return [];
      }

      return Object.values(fileRegistry).filter(
        (file) => file && file.profile === profile
      );
    } catch (error) {
      console.error("File listing error:", error);
      throw error;
    }
  }

  validateFile(file) {
    return (
      // For now, accept any file type to fix the upload issues
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
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  removeLocalStorage(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}
