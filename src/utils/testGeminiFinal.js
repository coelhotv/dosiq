/**
 * Final test file to validate Gemini Code Assist integration
 * This file intentionally contains issues for Gemini to detect
 */

// Issue 1: Missing return statement
export function sum(a, b) {
  const result = a + b;
}

// Issue 2: Unused parameter
export function processUser(user, options, callback) {
  return user.name;
}

// Issue 3: Incorrect array method
export function findUser(users, id) {
  users.filter(user => user.id === id);
}

// Issue 4: Potential null reference
export function getCity(user) {
  return user.address.city.toUpperCase();
}

// Issue 5: Missing break in switch
export function getStatus(code) {
  let status;
  switch (code) {
    case 200:
      status = 'OK';
    case 404:
      status = 'Not Found';
    default:
      status = 'Unknown';
  }
  return status;
}
