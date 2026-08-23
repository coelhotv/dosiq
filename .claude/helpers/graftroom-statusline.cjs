/**
 * Graftroom Claude Code Statusline Helper
 */
const { resolve } = require("path");
const fs = require("fs");

try {
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const dbPath = resolve(dir, ".graftroom", "memory.db");
  if (fs.existsSync(dbPath)) {
    process.stdout.write("[🌱 graftroom active]\n");
  } else {
    process.stdout.write("[🌱 graftroom]\n");
  }
} catch {
  process.stdout.write("[🌱 graftroom]\n");
}
