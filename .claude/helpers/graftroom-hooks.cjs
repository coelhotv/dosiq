/**
 * Graftroom Claude Code Hooks Runner
 */
const { execFileSync } = require("child_process");
const { resolve } = require("path");

function readStdin() {
  try {
    return JSON.parse(process.env.GRAFTROOM_TEST_STDIN || require("fs").readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

const event = process.argv[2] || "prompt";
const input = readStdin();
const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

if (event === "prompt") {
  const prompt = String(input.prompt || "").trim();
  if (prompt.length >= 10) {
    try {
      const cli = process.env.GRAFTROOM_TEST_CLI || "graftroom";
      const out = execFileSync(process.execPath, [cli, "ask", prompt, dir, "--json", "-n", "3"], {
        encoding: "utf8",
        timeout: 10000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const parsed = JSON.parse(out);
      if (parsed && parsed.hits && parsed.hits.length > 0) {
        const lines = parsed.hits.map(h => "- " + h.title + " (" + h.pointer + ")");
        const context = "[graftroom pre-turn AST context]:\n" + lines.join("\n");
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context }
        }));
      }
    } catch {}
  }
} else if (event === "post-edit") {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "[graftroom] edit recorded" }
  }));
}
