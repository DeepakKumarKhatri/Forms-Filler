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
    const fileInput = document.getElementById("file-input");
    fileInput.addEventListener("change", this.handleFileSelect.bind(this));
  }

  async handleFiles(files, currentProfile) {
    try {
      if (!files || files.length === 0) {
        throw new Error("No files selected");
      }

      const currentProfileToUse =
        currentProfile || document.getElementById("profile-select").value;

      const uploadPromises = Array.from(files).map(async (file) => {
        const fileInfo = await this.storageManager.storeFile(
          file,
          currentProfileToUse
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

    fileItem.querySelector(".delete-file").addEventListener("click", () => {
      this.handleDeleteFile(fileInfo.id);
    });

    fileList.appendChild(fileItem);
  }

  handleFileSelect(e) {
    this.handleFiles(e.target.files);
  }

  async handleDeleteFile(fileId) {
    try {
      await this.storageManager.deleteFile(fileId);
      const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
      if (fileItem) {
        fileItem.remove();
      }
      showNotification("File deleted successfully", "success");
    } catch (error) {
      showNotification("Error deleting file: " + error.message, "error");
    }
  }
}
