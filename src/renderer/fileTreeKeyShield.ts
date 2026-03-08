/**
 * ── FileTree Input Keyboard Shield ──────────────────────────────────────
 *
 * Monaco Editor registers global capture-phase keydown listeners that swallow
 * alphabetical keys when it thinks it owns focus (e.g. after a tab/file close).
 * Those listeners call preventDefault(), which stops the browser from inserting
 * characters into <input> elements.
 *
 * This module MUST be imported at the very top of the app entry point (main.tsx)
 * — before any Monaco imports — so that our window capture handler is
 * registered FIRST and can call stopImmediatePropagation() before Monaco sees
 * the event.
 *
 * It also provides a callback registry (WeakMap) so that Enter / Escape can be
 * handled natively without relying on React's synthetic event system (which
 * fires too late when stopImmediatePropagation is used).
 */

export const fileTreeInputCallbacks = new WeakMap<
  HTMLElement,
  { onSubmit: () => void; onCancel: () => void }
>();

function isFileTreeInput(el: EventTarget | null): el is HTMLInputElement {
  return (
    el instanceof HTMLElement &&
    el.tagName === "INPUT" &&
    (el.classList.contains("rename-input") ||
      el.classList.contains("inline-create-input"))
  );
}

/**
 * Manually insert a character into a React-controlled <input>, bypassing the
 * normal keydown → input → onChange pipeline that Monaco may have killed via
 * preventDefault().
 */
function forceInsertCharacter(input: HTMLInputElement, char: string) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const newValue =
    input.value.slice(0, start) + char + input.value.slice(end);

  // Use the native HTMLInputElement.value setter to bypass React's controlled
  // input tracking, then dispatch an 'input' event so React picks up the change.
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(input, newValue);
  } else {
    input.value = newValue;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));

  // Restore caret position
  const newPos = start + char.length;
  input.setSelectionRange(newPos, newPos);
}

/**
 * Manually delete a character from a React-controlled <input> in the given
 * direction.
 */
function forceDeleteCharacter(
  input: HTMLInputElement,
  direction: "backward" | "forward",
) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;

  let newValue: string;
  let newPos: number;

  if (start !== end) {
    // There's a selection — just delete it
    newValue = input.value.slice(0, start) + input.value.slice(end);
    newPos = start;
  } else if (direction === "backward" && start > 0) {
    newValue = input.value.slice(0, start - 1) + input.value.slice(start);
    newPos = start - 1;
  } else if (direction === "forward" && start < input.value.length) {
    newValue = input.value.slice(0, start) + input.value.slice(start + 1);
    newPos = start;
  } else {
    return; // Nothing to delete
  }

  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(input, newValue);
  } else {
    input.value = newValue;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.setSelectionRange(newPos, newPos);
}

if (typeof window !== "undefined") {
  // ── CAPTURE-PHASE keydown on window ──────────────────────────────────
  // Because this module is imported before Monaco, our handler is the very
  // first capture listener and runs before Monaco's.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!isFileTreeInput(e.target)) return;

      const input = e.target as HTMLInputElement;

      // ── Enter / Escape: invoke callbacks from the registry ──
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        fileTreeInputCallbacks.get(input)?.onSubmit();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        fileTreeInputCallbacks.get(input)?.onCancel();
        return;
      }

      // ── Regular keys ──
      // If we are here FIRST (before Monaco), just block Monaco and let the
      // browser's default behaviour insert the character.
      if (!e.defaultPrevented) {
        e.stopImmediatePropagation();
        return;
      }

      // ── Fallback: Monaco already ran and called preventDefault() ──
      // Manually replicate what the browser would have done.
      e.stopImmediatePropagation(); // Still block further listeners

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        forceInsertCharacter(input, e.key);
      } else if (e.key === "Backspace") {
        forceDeleteCharacter(input, "backward");
      } else if (e.key === "Delete") {
        forceDeleteCharacter(input, "forward");
      } else if (e.ctrlKey && (e.key === "a" || e.key === "A")) {
        input.select();
      }
      // All other combos (Ctrl+C/V/X, arrows, etc.) — let browser handle via
      // default. Since defaultPrevented is already true from Monaco, these may
      // not work, but they're not critical for file naming.
    },
    true,
  );
}
