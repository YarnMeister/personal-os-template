/**
 * load-onboarding — server function that reads onboarding state from
 * docs/data/local/onboarding-state.json.
 *
 * Returns the persisted state object, or null when the file does not exist
 * (fresh session — the wizard starts at phase 1 with empty answers).
 */

import { createServerFn } from "@tanstack/react-start";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const onboardingStateSchema = z.object({
  phase: z.number().int().min(1).max(6),
  answers: z.record(z.unknown()),
  completedPhases: z.array(z.number().int().min(1).max(6)),
  updatedAt: z.string(),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

function stateFilePath(): string {
  return resolve(process.cwd(), "../docs/data/local/onboarding-state.json");
}

export const loadOnboarding = createServerFn({
  method: "GET",
  strict: false,
}).handler(async (): Promise<OnboardingState | null> => {
  const filePath = stateFilePath();
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, "utf-8");
    return onboardingStateSchema.parse(JSON.parse(raw));
  } catch {
    // Corrupted or schema-mismatched file — treat as fresh session.
    return null;
  }
});
