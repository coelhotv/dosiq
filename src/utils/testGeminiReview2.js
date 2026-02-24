/**
 * Test file to validate Gemini Code Assist integration - Round 2
 * This file intentionally contains issues for Gemini to detect
 */

// Issue 1: SQL Injection vulnerability (security issue)
export function buildUserQuery(userId) {
  return `SELECT * FROM users WHERE id = ${userId}`;
}

// Issue 2: Missing null check
export function getFullName(user) {
  return `${user.firstName} ${user.lastName}`;
}

// Issue 3: Unused variable
const unusedConfig = {
  apiKey: 'secret',
  endpoint: 'https://api.example.com'
};

// Issue 4: Inefficient array operation
export function hasDuplicates(items) {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i] === items[j]) {
        return true;
      }
    }
  }
  return false;
}

// Issue 5: Missing return type documentation
export function calculateDiscount(price, discount) {
  return price * (1 - discount);
}

export { unusedConfig };
