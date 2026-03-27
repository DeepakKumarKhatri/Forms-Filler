(() => {
  if (window.__formFillerLoaded) return;
  window.__formFillerLoaded = true;

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "scanFields") {
      sendResponse({ fields: scanFields() });
    } else if (request.action === "fillFields") {
      fillFields(request.values);
      sendResponse({ success: true });
    }
    return true;
  });

  function getFieldLabel(el) {
    // 1. Explicit <label for="...">
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label.textContent.trim();
    }
    // 2. Wrapping <label>
    const parentLabel = el.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input,select,textarea").forEach((c) => c.remove());
      const text = clone.textContent.trim();
      if (text) return text;
    }
    // 3. aria-label
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
    // 4. aria-labelledby
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const ref = document.getElementById(labelledBy);
      if (ref) return ref.textContent.trim();
    }
    // 5. placeholder
    if (el.placeholder) return el.placeholder.trim();
    // 6. preceding sibling text
    const prev = el.previousElementSibling;
    if (prev && (prev.tagName === "LABEL" || prev.tagName === "SPAN")) {
      return prev.textContent.trim();
    }
    return "";
  }

  function buildFieldKey(el) {
    // Build a stable key: prefer id > name > data-testid > fallback to type+index
    if (el.id) return "id:" + el.id;
    if (el.name) return "name:" + el.name;
    if (el.dataset.testid) return "testid:" + el.dataset.testid;
    // fallback: type + DOM position among same-type siblings
    const selector = el.tagName.toLowerCase() + "[type='" + (el.type || "text") + "']";
    const all = Array.from(document.querySelectorAll(selector));
    return "idx:" + el.tagName.toLowerCase() + ":" + (el.type || "text") + ":" + all.indexOf(el);
  }

  function isVisible(el) {
    if (el.type === "hidden") return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function scanFields() {
    const elements = document.querySelectorAll(
      "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image']):not([type='file']), select, textarea"
    );
    const fields = [];
    const seenKeys = new Set();

    elements.forEach((el) => {
      if (!isVisible(el)) return;
      const key = buildFieldKey(el);
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const label = getFieldLabel(el);
      const field = {
        key,
        tag: el.tagName.toLowerCase(),
        type: el.type || (el.tagName === "SELECT" ? "select" : "textarea"),
        id: el.id || "",
        name: el.name || "",
        placeholder: el.placeholder || "",
        label,
        displayName: label || el.name || el.id || el.placeholder || key,
      };

      // For select elements, include options
      if (el.tagName === "SELECT") {
        field.options = Array.from(el.options).map((o) => ({
          value: o.value,
          text: o.textContent.trim(),
        }));
      }
      fields.push(field);
    });

    return fields;
  }

  function fillFields(values) {
    // values = { "id:email": "test@example.com", "name:password": "abc123", ... }
    const elements = document.querySelectorAll("input, select, textarea");
    const filled = [];

    elements.forEach((el) => {
      const key = buildFieldKey(el);
      if (!(key in values) || values[key] === "") return;

      const val = values[key];

      if (el.tagName === "SELECT") {
        el.value = val;
      } else if (el.type === "checkbox" || el.type === "radio") {
        el.checked = val === "true" || val === true;
      } else {
        // Use native setter to trigger React/Vue/Angular change detection
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, "value"
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, "value"
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, val);
        } else {
          el.value = val;
        }
      }

      // Dispatch events so frameworks pick up the change
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      filled.push(key);
    });

    return filled;
  }
})();
