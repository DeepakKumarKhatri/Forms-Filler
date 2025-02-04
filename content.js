chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fillForms") {
    fillForms(request.profile)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
  }
  return true; // Keep message channel open for async response
});

async function fillForms(profileName) {
  try {
    const result = await chrome.storage.sync.get(["profiles"]);
    const profiles = result.profiles || {};
    const profile = profiles[profileName] || { fields: [] };

    const promises = profile.fields.map(async (field) => {
      const inputs = document.querySelectorAll("input, textarea, select");
      inputs.forEach((input) => {
        // Add null check for placeholder
        if (
          (input.name &&
            input.name.toLowerCase().includes(field.label.toLowerCase())) ||
          (input.id &&
            input.id.toLowerCase().includes(field.label.toLowerCase())) ||
          (input.placeholder &&
            input.placeholder.toLowerCase().includes(field.label.toLowerCase()))
        ) {
          // Trigger change event after setting value
          input.value = field.value;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("Error filling forms:", error);
    throw error;
  }
}
