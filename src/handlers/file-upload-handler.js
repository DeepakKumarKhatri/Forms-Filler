import {
  showNotification,
  getFileIcon,
  formatFileSize,
  truncateFileName,
} from "../utils/helpers.js";

export class FileUploadUIHandler {
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

  async handleFiles(files, currentProfile) {
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileInfo = await this.storageManager.storeFile(
          file,
          currentProfile
        );
        this.addFileToUI(fileInfo);
        return fileInfo;
      });

      await Promise.all(uploadPromises);
      showNotification("Files uploaded successfully", "success");
    } catch (error) {
      showNotification(error.message, "error");
    }
  }

  addFileToUI(fileInfo) {
    const fileList = document.getElementById("file-list");
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";

    fileItem.innerHTML = `
        <span class="file-icon">${getFileIcon(fileInfo.type)}</span>
        <span class="file-name" title="${fileInfo.name}">${truncateFileName(
      fileInfo.name,
      20
    )}</span>
        <span class="file-size">${formatFileSize(fileInfo.size)}</span>
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
      showNotification("File deleted successfully", "success");
    } catch (error) {
      showNotification("Error deleting file", "error");
    }
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
}
