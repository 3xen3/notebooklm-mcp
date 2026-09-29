/**
 * NotebookLM / Gemini Notebook host helpers.
 *
 * In July 2026 Google renamed NotebookLM to "Gemini Notebook" and moved the
 * app from notebooklm.google.com to notebook.google.com. The old host still
 * 301-redirects to the new one, so after login the browser lands on
 * notebook.google.com — which the original hard-coded
 * `startsWith("https://notebooklm.google.com/")` checks never matched.
 *
 * Every place that needs to recognise "we are on NotebookLM" goes through
 * these helpers so both hosts are accepted.
 */

/** Current host first; the legacy host still redirects to it. */
export const NOTEBOOKLM_HOSTS = ["notebook.google.com", "notebooklm.google.com"] as const;

/** Canonical host used when building / normalising URLs. */
export const NOTEBOOKLM_CANONICAL_HOST = NOTEBOOKLM_HOSTS[0];

export const NOTEBOOKLM_HOME_URL = `https://${NOTEBOOKLM_CANONICAL_HOST}/`;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True when `url` is an https URL on either NotebookLM host (any path / query). */
export function isNotebookLmUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = parse(url);
  if (!u || u.protocol !== "https:") return false;
  return (NOTEBOOKLM_HOSTS as readonly string[]).includes(u.hostname.toLowerCase());
}

/**
 * Rewrite a legacy notebooklm.google.com URL to the current
 * notebook.google.com host. Anything else is returned unchanged.
 * Avoids a redirect on every navigation and keeps origin comparisons
 * (e.g. sessionStorage restore) consistent with where the page really is.
 */
export function normalizeNotebookUrl(url: string): string {
  const u = parse(url);
  if (!u || !isNotebookLmUrl(url)) return url;
  if (u.hostname.toLowerCase() !== NOTEBOOKLM_CANONICAL_HOST) {
    u.hostname = NOTEBOOKLM_CANONICAL_HOST;
  }
  return u.toString();
}
