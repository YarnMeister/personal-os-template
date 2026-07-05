/**
 * check-context-files — server function that inspects context/me.md,
 * context/org.md, and context/active.md for non-placeholder content.
 *
 * Non-placeholder heuristic (ADR-P6-004 §technical notes):
 *   A file is considered "populated" (non-placeholder) when it:
 *     1. exists on disk, AND
 *     2. contains no `[` characters, AND
 *     3. does not contain the literal string `YYYY-MM-DD`
 *
 * Called by the onboarding wizard on phase 4 and phase 5 component mount
 * to power the per-phase "file already exists" notice (story 004, AC4).
 */

import { createServerFn } from "@tanstack/react-start";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function repoRoot(): string {
  return resolve(process.cwd(), "..");
}

/**
 * Returns true when the file at `filePath` exists and contains real
 * (non-placeholder) content per the two-part heuristic above.
 */
function isNonPlaceholder(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const content = readFileSync(filePath, "utf-8");
    return !content.includes("[") && !content.includes("YYYY-MM-DD");
  } catch {
    return false;
  }
}

export const checkContextFiles = createServerFn({
  method: "GET",
  strict: false,
}).handler(
  async (): Promise<{ me: boolean; org: boolean; active: boolean }> => {
    const root = repoRoot();
    return {
      me: isNonPlaceholder(resolve(root, "context/me.md")),
      org: isNonPlaceholder(resolve(root, "context/org.md")),
      active: isNonPlaceholder(resolve(root, "context/active.md")),
    };
  },
);
