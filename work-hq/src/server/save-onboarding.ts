/**
 * save-onboarding — server function that writes onboarding state to
 * docs/data/local/onboarding-state.json (gitignored, never committed).
 *
 * Pattern: file-backed persistence for Work HQ wizard state.
 * The client calls this on a debounced 2-second timer; localStorage is the
 * offline write-through cache and is never the primary source of truth.
 *
 * State shape (ADR-P6-003 §decision):
 *   { phase, answers, completedPhases, updatedAt }
 */

import { createServerFn } from "@tanstack/react-start";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const onboardingStateSchema = z.object({
  phase: z.number().int().min(1).max(6),
  answers: z.record(z.unknown()),
  completedPhases: z.array(z.number().int().min(1).max(6)),
  updatedAt: z.string(),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

/** Resolves relative to the repo root (one level up from work-hq/). */
function stateFilePath(): string {
  return resolve(process.cwd(), "../docs/data/local/onboarding-state.json");
}

export const saveOnboarding = createServerFn({ method: "POST" })
  .validator((data: unknown) => onboardingStateSchema.parse(data))
  .handler(async ({ data }) => {
    const filePath = stateFilePath();
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return { ok: true } as const;
  });
