# Graftroom Context & Token Optimization Rules

1. **Pre-turn AST Graph Navigation:**
   - Prefer querying `graftroom_graph` before running broad, token-expensive `grep` or multiple file reads.
   - Use `graftroom_graph(action="skeleton")` to check signatures before inspecting full bodies.

2. **Output Compression & CCR Retrieval:**
   - When generating or processing large tool outputs (> 100 lines), compress them with `graftroom_compress`.
   - Resolve `[CCR:<hash>]` markers using `graftroom_retrieve`.

3. **Shared Cross-Agent Memory:**
   - Check `.graftroom/memory.db` or `graftroom_learn` for known repository patterns and error loops.
