/**
 * read-bootstrap-prompt — server function that reads
 * templates/bootstrap-profile-prompt.md and substitutes [FULL_NAME] and
 * [WORK_EMAIL] placeholders with the values supplied by the user.
 *
 * Returns the fully substituted prompt string ready for the Collect & Copy
 * block in PhaseSeeding (story 009, AC3).
 */

import { createServerFn } from "@tanstack/react-start";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const inputSchema = z.object({
  fullName: z.string().min(1),
  workEmail: z.string().min(1),
});

function templateFilePath(): string {
  return resolve(process.cwd(), "../templates/bootstrap-profile-prompt.md");
}

export const readBootstrapPrompt = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ content: string }> => {
    const raw = readFileSync(templateFilePath(), "utf-8");
    const content = raw
      .replace(/\[FULL_NAME\]/g, data.fullName)
      .replace(/\[WORK_EMAIL\]/g, data.workEmail);
    return { content };
  });
