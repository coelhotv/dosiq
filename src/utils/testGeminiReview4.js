/**
 * Test file to validate Gemini Code Assist integration - Round 4
 * This file intentionally contains issues for Gemini to detect
 */

// Issue 1: Missing async/await
export function fetchUser(id) {
  const response = fetch(`/api/users/${id}`);
  return response.json();
}

// Issue 2: Unhandled promise rejection
export function saveData(data) {
  fetch('/api/save', {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(res => res.json());
}

// Issue 3: Memory leak potential
const listeners = [];
export function addListener(callback) {
  listeners.push(callback);
}

// Issue 4: Incorrect comparison
export function compareValues(a, b) {
  // eslint-disable-next-line no-cond-assign -- Intentional bug for Gemini to detect
  if (a = b) {
    return true;
  }
  return false;
}

// Issue 5: Deprecated method
export function escapeHtml(str) {
  return str.escape();
}
