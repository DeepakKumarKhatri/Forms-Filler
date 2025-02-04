chrome.runtime.onInstalled.addListener(() => {
  console.log("Form Filler extension installed");
  chrome.storage.sync.set({ isLocked: false, password: "" });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setPassword") {
    chrome.storage.sync.set({ password: request.password, isLocked: true });
  } else if (request.action === "removePassword") {
    chrome.storage.sync.set({ password: "", isLocked: false });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.startsWith("http")) {
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      })
      .catch((err) => console.error("Script injection failed:", err));
  }
});
