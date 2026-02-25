/**
 * Test file for Gemini priority classification validation
 * 
 * This file contains intentional code issues at different severity levels
 * to test the Gemini Code Assist review workflow's priority classification system.
 * 
 * DO NOT MERGE - This file is for testing purposes only
 * @test-priority-validation
 */

// ============================================================================
// CRITICAL: SQL Injection Vulnerability
// ============================================================================
/**
 * CRITICAL PRIORITY - SQL Injection
 * This function constructs SQL queries by directly concatenating user input,
 * which is a severe security vulnerability allowing arbitrary SQL execution.
 */
function getUserData(userId) {
  // CRITICAL: SQL injection vulnerability - user input directly in query
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  return db.query(query);
}

/**
 * CRITICAL: SQL Injection in authentication
 * Direct string interpolation in SQL allows authentication bypass
 */
function authenticateUser(username, password) {
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  return db.query(query);
}

// ============================================================================
// HIGH + SECURITY: Hardcoded Credentials
// ============================================================================
// HIGH security - Hardcoded API key (should trigger P1 blocking)
const API_KEY = "sk-1234567890abcdef";

// HIGH security - Hardcoded database password
const DB_PASSWORD = "SuperSecretPassword123!";

// HIGH security - Hardcoded JWT secret
const JWT_SECRET = "my-super-secret-jwt-key-dont-share";

// ============================================================================
// HIGH + PERFORMANCE: Inefficient Algorithms
// ============================================================================
/**
 * HIGH performance - O(n²) nested loop
 * Inefficient algorithm that causes performance degradation with large datasets
 */
function processItems(items) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      // This creates quadratic time complexity
      results.push(items[i] + items[j]);
    }
  }
  return results;
}

/**
 * HIGH performance - Memory leak potential
 * Recursive function without proper termination check can cause stack overflow
 */
function recursiveProcess(data) {
  // Missing base case for large datasets
  return recursiveProcess(data.slice(1));
}

/**
 * HIGH performance - Blocking synchronous operation
 * Synchronous file read in request handler blocks event loop
 */
function handleRequest(req, res) {
  const data = fs.readFileSync('/path/to/large/file.json');
  res.json(JSON.parse(data));
}

// ============================================================================
// HIGH + OTHER: Missing Error Handling (not security/performance)
// ============================================================================
/**
 * HIGH - Unhandled promise rejection
 * Missing error handling can cause crashes and undefined behavior
 */
function fetchData() {
  return fetch('/api/data');
}

/**
 * HIGH - Missing null check
 * Can cause runtime TypeError
 */
function getUserName(user) {
  return user.profile.name; // No null check on user or profile
}

/**
 * HIGH - Missing try-catch in async function
 * Unhandled exceptions can crash the application
 */
async function saveData(data) {
  const result = await database.save(data);
  return result;
}

// ============================================================================
// MEDIUM: Code Quality Issues
// ============================================================================
// MEDIUM - Missing JSDoc documentation
function calculateTotal(price, quantity) {
  return price * quantity;
}

// MEDIUM - Magic numbers without explanation
function isAdult(age) {
  return age >= 18; // What does 18 represent?
}

// MEDIUM - Unused variable
function processUser(user) {
  const unusedVariable = "this is never used";
  return user.name;
}

// MEDIUM - Inconsistent naming convention
function GetUserInfo(user_id) {
  return {
    userId: user_id,
    userName: user.name
  };
}

// ============================================================================
// LOW: Minor Issues (for completeness)
// ============================================================================
// LOW - Missing semicolon (style issue)
const x = 10

// LOW - Console.log left in production code
function debugFunction() {
  console.log('Debug: this should be removed');
}

// Export for testing purposes
module.exports = {
  getUserData,
  authenticateUser,
  processItems,
  recursiveProcess,
  handleRequest,
  fetchData,
  getUserName,
  saveData,
  calculateTotal,
  isAdult,
  processUser,
  GetUserInfo,
  debugFunction,
  API_KEY,
  DB_PASSWORD,
  JWT_SECRET
};