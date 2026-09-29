# notebooklm-mcp 2.0.1-gemini.3 — unofficial patch on top of v2.0.0

Upstream (PleasePrompto/notebooklm-mcp) was archived on 2026-09-10. In July 2026
Google renamed NotebookLM to **Gemini Notebook** and moved it from
`notebooklm.google.com` to `notebook.google.com`. v2.0.0 only recognised the old
host, so login was never detected (`authenticated: false` forever).

Changes:

1. **Login detection** — new `src/utils/notebook-url.ts` (`isNotebookLmUrl`,
   `normalizeNotebookUrl`). All five hard-coded
   `startsWith("https://notebooklm.google.com/")` / `includes(...)` checks in
   `src/auth/auth-manager.ts` now accept both hosts (any query string, e.g.
   `?pli=1`, `?hl=fr`). Login URL `continue=` points at `notebook.google.com`.
   (Upstream issues #88, #95, #102, #108, #113.)
2. **Notebook URLs** — library entries and browser sessions normalise legacy
   `notebooklm.google.com/notebook/<id>` links to `notebook.google.com`, so the
   sessionStorage-restore origin check matches the real page origin.
3. **`ask_question` returning only "Thoughts"** — the collapsed Gemini
   reasoning-panel header is stripped in `sanitizeAnswer()` (EN + TR and other
   locales). (Issue #88, breakage 2.)
4. **`add_source` timing out** — dialog selectors anchor on
   `.mat-mdc-dialog-container` instead of `[role="dialog"]`, which also matched a
   hidden emoji picker. (Issue #88, breakage 3.)
5. Tool descriptions mention `notebook.google.com`; version string bumped.
6. **`ask_question` blocked by a popup** (2.0.1-gemini.2) — Gemini Notebook can
   open a modal (dark `cdk-overlay-backdrop`) over the notebook, e.g. a
   first-run announcement, so clicking the query box timed out.
   `BrowserSession.dismissOverlays()` presses Escape, force-clicks the
   backdrop, then clicks an explicit close/acknowledge button; it runs before
   the chat input is used and once more if the click is still intercepted.
   If the popup survives, the error quotes its text. Escape + backdrop idea
   adapted from ChoiWheatley/notebooklm-mcp (MIT). Also adds the Turkish
   query-box label and the `button.add-source-link` entry point.
7. **Locked profile after a client restart** (2.0.1-gemini.3) — when the MCP
   client quits it often kills the server without a catchable signal (always on
   Windows), leaving the headless Chrome running with the profile locked; the
   next launch fails with Chrome exit code 21. `src/browser/orphan-chrome.ts`
   kills Chrome processes whose `--user-data-dir` is exactly our profile before
   launching (PowerShell/CIM on Windows, `ps` elsewhere). Exit code 21 now also
   triggers the isolated-profile fallback, and the server shuts down (closing
   Chrome) when the client closes stdin.

Build note: transpiled with `tsc --noCheck` (no type-check) because the build
sandbox could not reach the npm registry; the emitted JS was diffed against an
unpatched build of the same source and differs only in the lines above.
