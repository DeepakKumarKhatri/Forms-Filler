export function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

export function getFileIcon(type) {
  const icons = {
    image: "🖼️",
    "application/pdf": "📄",
    "application/msword": "📝",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "📝",
  };
  return icons[type] || "📎";
}

export function truncateFileName(name, maxLength) {
  if (name.length <= maxLength) return name;
  const ext = name.split(".").pop();
  const nameWithoutExt = name.slice(0, -(ext.length + 1));
  return `${nameWithoutExt.slice(0, maxLength - 3)}...${ext}`;
}

export function formatFileSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
