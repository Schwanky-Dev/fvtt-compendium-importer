/**
 * Escape HTML special characters to prevent XSS.
 * @param {*} str - Value to escape (coerced to string)
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
