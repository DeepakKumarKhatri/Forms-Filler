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
    fileItem.draggable = true;
    fileItem.dataset.fileId = fileInfo.id;

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

      fileItem.addEventListener('dragstart', async (e) => {
        e.stopPropagation();
        await this.handleFileDragStart(e, fileInfo);
      });
    fileItem.addEventListener("dragend", (e) => this.handleFileDragEnd(e));

    fileItem.querySelector(".delete-file").addEventListener("click", () => {
      this.handleDeleteFile(fileInfo.id);
    });

    fileList.appendChild(fileItem);
  }

  async handleFileDragStart(e, fileInfo) {
    try {
      e.currentTarget.classList.add("dragging");

      // Get the actual file data from storage
      const fileData = await this.storageManager.getFile(fileInfo.id);

      // Create a File object from the stored data
      const file = await this.createFileFromData(fileData, fileInfo);

      // Set drag data
      e.dataTransfer.setData("text/plain", fileInfo.name);
      e.dataTransfer.setData("application/json", JSON.stringify(fileInfo));

      // Add the file to dataTransfer
      e.dataTransfer.setData(
        "DownloadURL",
        `${fileInfo.type}:${fileInfo.name}:${fileData.data}`
      );
      e.dataTransfer.items.add(file);

      // Set drag effect
      e.dataTransfer.effectAllowed = "copy";
    } catch (error) {
      showNotification("Error preparing file for drag", "error");
      console.error("Drag error:", error);
    }
  }

  handleFileDragEnd(e) {
    e.currentTarget.classList.remove("dragging");
  }

  async createFileFromData(fileData, fileInfo) {
    try {
      // Handle base64 data
      const base64Response = await fetch(fileData.data);
      const blob = await base64Response.blob();

      return new File([blob], fileInfo.name, {
        type: fileInfo.type || "application/octet-stream",
      });
    } catch (error) {
      console.error("Error creating file:", error);
      throw new Error("Failed to create file for drag operation");
    }
  }

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
}
