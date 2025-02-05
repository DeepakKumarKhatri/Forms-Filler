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

export default STORAGE_CONFIG;
