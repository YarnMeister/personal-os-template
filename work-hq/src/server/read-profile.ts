/**
 * read-profile — server function that reads context/profile.md from the repo
 * root and returns its content, or null when the file does not exist.
 *
 * Called by PhaseReviewCorrect (story 010) on mount and on manual Refresh.
 * The file is read at request time — not via import.meta.glob — because
 * context/profile.md is gitignored and written by the user's AI assistant
 * after onboarding phase 3 completes.
 */

import { createServerFn } from "@tanstack/react-start";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function profileFilePath(): string {
  return resolve(process.cwd(), "../context/profile.md");
}

export const readProfile = createServerFn({
  method: "GET",
  strict: false,
}).handler(async (): Promise<{ content: string | null }> => {
  const path = profileFilePath();
  if (!existsSync(path)) return { content: null };
  return { content: readFileSync(path, "utf-8") };
});
