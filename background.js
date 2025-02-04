chrome.runtime.onInstalled.addListener(() => {
  console.log("Smart Form Filler extension installed")
  chrome.storage.sync.set({ isLocked: false, password: "" })
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setPassword") {
    chrome.storage.sync.set({ password: request.password, isLocked: true })
  } else if (request.action === "removePassword") {
    chrome.storage.sync.set({ password: "", isLocked: false })
  }
})

