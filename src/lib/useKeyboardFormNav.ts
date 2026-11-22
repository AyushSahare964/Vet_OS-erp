import { useEffect } from "react";

/**
 * App-wide keyboard navigation for forms (one document-level listener, no per-form wiring):
 *   Enter / ArrowDown  -> next field      Shift+Enter / ArrowUp -> previous field      (Tab already works natively)
 * Only plain text-like <input>s are sources. It stays out of the way of: textarea, native select, date/time/range
 * inputs, search/combobox/autocomplete boxes, open popups, anything that already handled the key
 * (preventDefault), modified keys, and inputs marked data-no-enter-nav. On the last field Enter is left alone,
 * so a form's own submit (login etc.) still works.
 * ponytail: ArrowUp/Down no longer step <input type=number>; use typing or the spinner. Opt a field back in by
 * marking it data-no-enter-nav.
 */
const SOURCE_TYPES = new Set(["text", "number", "email", "tel", "password", "url", ""]);
const TARGETS =
  'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=submit]):not([type=button]):not([disabled]):not([readonly]),' +
  "textarea:not([disabled]):not([readonly]), select:not([disabled]), button[role=combobox]:not([disabled])";

function isVisible(el: HTMLElement) {
  return el.tabIndex !== -1 && el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"], [inert]');
}

/** Focus the next/previous field from `el` (same column of the neighbouring row when `byColumn`). Returns false at the ends. */
export function moveFocusFrom(el: HTMLElement, backwards: boolean, byColumn: boolean): boolean {
  const scope = el.closest<HTMLElement>('[role="dialog"]') ?? document.body;
  const fields = Array.from(scope.querySelectorAll<HTMLElement>(TARGETS)).filter(isVisible);
  const i = fields.indexOf(el);
  if (i === -1) return false;
  let next = fields[backwards ? i - 1 : i + 1];
  if (byColumn) {
    const cell = el.closest("td");
    const row = cell?.parentElement;
    const sibling = backwards ? row?.previousElementSibling : row?.nextElementSibling;
    const col = cell && row ? Array.from(row.children).indexOf(cell) : -1;
    const sameCol = col >= 0 ? (sibling?.children[col] as HTMLElement | undefined) : undefined;
    const cellTarget = sameCol && Array.from(sameCol.querySelectorAll<HTMLElement>(TARGETS)).find(isVisible);
    if (cellTarget) next = cellTarget;
  }
  if (!next) return false;
  next.focus();
  if (next instanceof HTMLInputElement && SOURCE_TYPES.has(next.type)) next.select();
  return true;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
  const isEnter = e.key === "Enter";
  if (!isEnter && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  if (e.shiftKey && !isEnter) return;

  const el = e.target as HTMLElement | null;
  if (!(el instanceof HTMLInputElement)) return;
  if (!SOURCE_TYPES.has(el.type) || el.readOnly || el.disabled) return;
  if (el.hasAttribute("data-no-enter-nav") || el.closest("[data-no-enter-nav]")) return;
  // Leave search/combobox inputs alone only while their popup is open (they use the arrows themselves).
  if (el.getAttribute("aria-expanded") === "true" || el.closest("[cmdk-root], [role=listbox]")) return;

  const backwards = e.key === "ArrowUp" || (isEnter && e.shiftKey);
  // In a table, Up/Down go to the same column of the neighbouring row (Enter keeps reading order).
  // At the first/last field nothing moves and the native behaviour stays (e.g. Enter submits).
  if (moveFocusFrom(el, backwards, !isEnter)) e.preventDefault();
}

/**
 * Open Radix Select list: ArrowDown on the last option (ArrowUp on the first) closes it and carries on to the
 * next/previous field instead of stopping at the end. Capture phase so it runs before Radix's own handler.
 */
function onSelectListKeyDown(e: KeyboardEvent) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const opt = document.activeElement as HTMLElement | null;
  const list = opt?.getAttribute("role") === "option" ? opt.closest<HTMLElement>('[role="listbox"]') : null;
  if (!list?.id) return;
  const options = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'));
  const down = e.key === "ArrowDown";
  if (opt !== options[down ? options.length - 1 : 0]) return;
  const trigger = document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(list.id)}"]`);
  if (!trigger) return;
  e.preventDefault();
  e.stopPropagation();
  opt.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); // closes the list
  // Radix hands focus back to the trigger when its close animation ends; move on only after that, or it steals focus back.
  let tries = 0;
  const moveOn = () => {
    if (document.activeElement === trigger || ++tries > 30) moveFocusFrom(trigger, !down, true);
    else setTimeout(moveOn, 30);
  };
  setTimeout(moveOn, 30);
}

export function useKeyboardFormNav() {
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keydown", onSelectListKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keydown", onSelectListKeyDown, true);
    };
  }, []);
}
