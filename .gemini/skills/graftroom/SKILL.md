---
name: graftroom
description: Codebase intelligence, AST symbol graph traversal, SmartCrusher context compression, CCR reversible storage, and cross-agent memory.
---

# Graftroom Context Intelligence

Graftroom provides zero-cost AST graph indexing, symbol traversal, and smart context engineering for AI coding agents.

## When to use Graftroom:
1. **Understanding code structure without reading whole files:**
   - Use `graftroom_graph(action="search", query="...")` to find relevant symbol definitions with exact spans.
   - Use `graftroom_graph(action="skeleton", file="path/to/file")` for signatures-only view.
2. **Refactoring & blast radius analysis:**
   - Use `graftroom_graph(action="callers", symbol="FunctionName")` to find every dependent call site.
   - Use `graftroom_graph(action="blast", diff="...")` before committing to verify downstream impacts.
3. **Compressing huge tool outputs:**
   - Use `graftroom_compress(content="...", type="json"|"diff"|"log"|"code")` to trim massive outputs.
   - Use `graftroom_retrieve(hash="...")` to fetch original uncompressed payloads when needed.
4. **Cross-agent error patterns & conventions:**
   - Use `graftroom_learn(action="query_patterns", query="...")` before debugging repeated errors.
   - Use `graftroom_learn(action="record_pattern", pattern="...", solution="...")` to remember lessons.
