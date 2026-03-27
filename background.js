chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["projects"], (result) => {
    if (!result.projects) {
      chrome.storage.local.set({ projects: {} });
    }
  });
});
