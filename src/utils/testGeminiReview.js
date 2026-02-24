/**
 * Test file to validate Gemini Code Assist integration
 * This file intentionally contains issues for Gemini to detect
 */

// Issue 1: Missing error handling
export async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}

// Issue 2: Potential null reference
export function getUserName(user) {
  return user.profile.name.toUpperCase();
}

// Issue 3: Hardcoded credentials (security issue)
const API_KEY = 'sk-test-1234567890';
export { API_KEY };

// Issue 4: Inefficient loop
export function findItem(items, id) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) {
      return items[i];
    }
  }
  return null;
}

// Issue 5: Missing input validation
export function calculateTotal(prices) {
  return prices.reduce((sum, price) => sum + price, 0);
}
