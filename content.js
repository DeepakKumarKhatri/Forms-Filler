chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fillForms") {
    fillForms(request.profile)
      .then(() => {
        console.log("Forms filled successfully");
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error filling forms:", error);
        sendResponse({ success: false, error: error.toString() });
      });
    return true; // Keep the messaging channel open
  }
});

async function fillForms(profileName) {
  try {
    const result = await chrome.storage.sync.get(["profiles"]);
    const profiles = result.profiles || {};
    const profile = profiles[profileName] || { fields: [] };

    const forms = document.querySelectorAll("form");
    if (forms.length === 0) {
      throw new Error("No forms found on this page");
    }

    const fieldsNotFilled = [];

    forms.forEach((form) => {
      profile.fields.forEach((field) => {
        const matchedInputs = Array.from(form.elements).filter((input) => {
          const matchStrategies = [
            input.name?.toLowerCase().includes(field.label.toLowerCase()),
            input.id?.toLowerCase().includes(field.label.toLowerCase()),
            input.placeholder
              ?.toLowerCase()
              .includes(field.label.toLowerCase()),
            input
              .getAttribute("aria-label")
              ?.toLowerCase()
              .includes(field.label.toLowerCase()),
          ];

          return matchStrategies.some((match) => match);
        });

        if (matchedInputs.length > 0) {
          matchedInputs.forEach((input) => {
            try {
              if (input.type === "radio" || input.type === "checkbox") {
                input.checked = field.value === "true";
              } else {
                input.value = field.value;
              }

              // Trigger events for frameworks like React
              ["change", "input", "blur"].forEach((eventType) => {
                input.dispatchEvent(new Event(eventType, { bubbles: true }));
              });
            } catch (err) {
              console.warn(`Could not fill input:`, input, err);
            }
          });
        } else {
          fieldsNotFilled.push(field.label);
        }
      });
    });

    return {
      success: true,
      partiallyFilled: fieldsNotFilled.length > 0,
      unfilledFields: fieldsNotFilled,
    };
  } catch (error) {
    console.error("Error filling forms:", error);
    throw error;
  }
}
