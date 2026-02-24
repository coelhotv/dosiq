/**
 * Test file for Gemini Code Assist integration - Round 6
 * This file intentionally contains issues for Gemini to detect
 * Testing after all fixes: database migration, response headers, GITHUB_TOKEN
 */

// Issue 1: Missing return statement
export function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  // Missing return statement
}

// Issue 2: Unused variable
export function processData(data, config, options) {
  const processed = data.map(x => x.value);
  return processed;
}

// Issue 3: Using filter instead of find
export function getUserById(users, id) {
  return users.filter(user => user.id === id);
}

// Issue 4: Potential null/undefined access
export function getFullName(user) {
  return user.profile.firstName + ' ' + user.profile.lastName;
}

// Issue 5: Missing break in switch
export function getHttpStatusMessage(code) {
  let message;
  switch (code) {
    case 200:
      message = 'OK';
    case 201:
      message = 'Created';
    case 400:
      message = 'Bad Request';
    default:
      message = 'Unknown';
  }
  return message;
}
