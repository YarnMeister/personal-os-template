/**
 * check-profile-exists — server function that tests whether context/profile.md
 * exists in the repo root.
 *
 * Called by PhaseSeeding's 5-second auto-poll and the manual Refresh button
 * to detect when the user's AI assistant has written the bootstrapped profile.
 */

import { createServerFn } from "@tanstack/react-start";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function profileFilePath(): string {
  return resolve(process.cwd(), "../context/profile.md");
}

export const checkProfileExists = createServerFn({
  method: "GET",
  strict: false,
}).handler(async (): Promise<{ exists: boolean }> => {
  return { exists: existsSync(profileFilePath()) };
});
