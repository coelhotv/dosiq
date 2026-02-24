/**
 * Test file to validate Gemini Code Assist integration - Round 3
 * This file intentionally contains issues for Gemini to detect
 */

// Issue 1: Missing error handling in async function
export async function fetchUserData(userId) {
  const response = await fetch(`/api/users/${userId}`);
  const data = await response.json();
  return data;
}

// Issue 2: Potential division by zero
export function calculateAverage(total, count) {
  return total / count;
}

// Issue 3: Mutable variable in loop (var instead of let/const)
export function processItems(items) {
  for (var i = 0; i < items.length; i++) {
    console.log(items[i]);
  }
}

// Issue 4: Missing type coercion in comparison
export function isValidStatus(status) {
  if (status == 'active') {
    return true;
  }
  return false;
}

// Issue 5: Console.log left in production code
export function debugLog(message) {
  console.log('[DEBUG]', message);
  return message;
}
