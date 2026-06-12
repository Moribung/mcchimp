// Shared keyboard helpers for the game screens.

/** True when the event target is an editable text field — don't hijack keys there. */
export function isTextTarget(e) {
  const el = e?.target;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/**
 * True when the key is an "advance / continue" key — Enter or Space — pressed
 * outside a text field. Callers should call e.preventDefault() when this is true
 * (stops the page scrolling on Space and stops a focused button double-firing).
 */
export function isAdvanceKey(e) {
  if (isTextTarget(e)) return false;
  return e.key === 'Enter' || e.key === ' ' || e.code === 'Space';
}
