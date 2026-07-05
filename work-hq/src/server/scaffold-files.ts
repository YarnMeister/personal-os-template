/**
 * scaffold-files — server function that writes personal OS context files
 * (context/me.md, context/org.md, context/active.md) from collected onboarding
 * answers.
 *
 * Called by the onboarding wizard at two points:
 *   1. Phase 4 manual-path Confirm — writes context/me.md and context/org.md.
 *   2. Phase 5 Confirm (both paths) — writes context/active.md.
 *
 * Distillation branch (ADR-P6-007 §decision; story 004 AC6):
 *   When context/profile.md is present on disk (the user took the bootstrap
 *   seeding path), scaffold-files skips me.md and org.md entirely.
 *   Those files are distilled from profile.md by the user's AI assistant via
 *   the lock-in handoff in story 011.  The wizard NEVER writes me.md or org.md
 *   when a seeded profile exists.
 *
 * Overwrite protection (story 004 AC4):
 *   If a target file already contains non-placeholder content (heuristic:
 *   no `[` characters AND no literal `YYYY-MM-DD`), the file is only
 *   overwritten when the caller passes the corresponding `overwrite*: true`
 *   flag — which the wizard sets only after the user explicitly confirms.
 *
 * Labour split (ADR-P6-004 §decision):
 *   The wizard NEVER writes AGENTS.md or any file under skills/.
 */

import { createServerFn } from "@tanstack/react-start";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

/* ── Zod schemas ── */

const prioritySchema = z.object({
  title: z.string().default(""),
  owner: z.string().default(""),
  dueDate: z.string().default(""),
});

/**
 * Only the fields scaffold-files uses are declared explicitly.
 * `.passthrough()` allows the full Answers object (with assistant, checks,
 * seedingPath, etc.) to be forwarded without a schema error.
 */
const answersSchema = z
  .object({
    role: z.string().default(""),
    workstyle: z.string().default(""),
    team: z.string().default(""),
    keyTools: z.array(z.string()).default([]),
    stakeholders: z.array(z.string()).default([]),
    glossary: z.string().default(""),
    priorities: z.array(prioritySchema).default([]),
    blockers: z.string().default(""),
    openQuestions: z.string().default(""),
  })
  .passthrough();

const inputSchema = z.object({
  /**
   * "me-org" — write context/me.md (and context/org.md if orgAgreed).
   *            Skipped entirely when context/profile.md exists (seeded path).
   * "active"  — write context/active.md.  Used for both bootstrap and
   *            manual paths after phase 5 completes.
   */
  target: z.enum(["me-org", "active"]),
  answers: answersSchema,
  /**
   * Whether the user accepted the org sensitivity-check gate.
   * org.md is only written when this is true and target === "me-org".
   */
  orgAgreed: z.boolean().default(false),
  /** Overwrite context/me.md even when it already has non-placeholder content. */
  overwriteMe: z.boolean().default(false),
  /** Overwrite context/org.md even when it already has non-placeholder content. */
  overwriteOrg: z.boolean().default(false),
  /** Overwrite context/active.md even when it already has non-placeholder content. */
  overwriteActive: z.boolean().default(false),
});

type Answers = z.infer<typeof answersSchema>;

/* ── File helpers ── */

function repoRoot(): string {
  return resolve(process.cwd(), "..");
}

/**
 * Non-placeholder heuristic: a file is "populated" when it contains neither
 * a `[` character nor the literal string `YYYY-MM-DD`.
 */
function isNonPlaceholder(content: string): boolean {
  return !content.includes("[") && !content.includes("YYYY-MM-DD");
}

/**
 * Returns true when the file exists on disk and passes the non-placeholder
 * heuristic.  Returns false when the file is missing or contains placeholder
 * markers.
 */
function existsNonPlaceholder(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    return isNonPlaceholder(readFileSync(filePath, "utf-8"));
  } catch {
    return false;
  }
}

function writeContextFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── Content builders ── */

/**
 * Renders context/me.md from the user's phase-4 manual interview answers.
 * Format: `# Me · Updated: YYYY-MM-DD` header + bullet list per AD-6.
 */
function buildMeContent(answers: Answers): string {
  const today = todayDate();
  const keyToolsStr =
    answers.keyTools.filter(Boolean).join(", ") || "(not specified)";
  return `# Me · Updated: ${today}

- **Role:** ${answers.role || "(not specified)"}
- **Working style:** ${answers.workstyle || "(not specified)"}
- **Team:** ${answers.team || "(not specified)"}
- **Key tools:** ${keyToolsStr}
`;
}

/**
 * Renders context/org.md from the user's phase-4 org-form answers.
 * The sensitivity gate in the wizard ensures no personnel data reaches
 * this committed file (ADR-P6-007 §decision).
 */
function buildOrgContent(answers: Answers): string {
  const today = todayDate();
  const stakeholdersStr =
    answers.stakeholders
      .filter(Boolean)
      .map((s) => `- ${s}`)
      .join("\n") || "(none entered)";
  const glossaryStr = answers.glossary || "(none entered)";
  return `# Org · Updated: ${today}

## Team structure
${answers.team || "(not specified)"}

## Key stakeholders
${stakeholdersStr}

## Glossary
${glossaryStr}
`;
}

/**
 * Renders context/active.md from the user's phase-5 right-now answers.
 * Each priority is formatted as: `<title> — Owner: <owner> — Due: <dueDate>`.
 */
function buildActiveContent(answers: Answers): string {
  const today = todayDate();
  const priorityLines =
    answers.priorities
      .filter((p) => p.title)
      .map((p) => {
        let line = p.title;
        if (p.owner) line += ` — Owner: ${p.owner}`;
        if (p.dueDate) line += ` — Due: ${p.dueDate}`;
        return `- ${line}`;
      })
      .join("\n") || "(none entered)";

  return `# Active · Updated: ${today}

## Priorities
${priorityLines}

## Blockers
${answers.blockers || "(none)"}

## Open questions
${answers.openQuestions || "(none)"}
`;
}

/* ── Server function ── */

export const scaffoldFiles = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(
    async ({ data }): Promise<{ written: string[]; skipped: string[] }> => {
      const root = repoRoot();
      const written: string[] = [];
      const skipped: string[] = [];

      if (data.target === "me-org") {
        // AC6: distillation branch — profile.md present means the user took
        // the Glean-bootstrap seeding path.  me.md and org.md will be
        // distilled from profile.md by the assistant (story 011 lock-in
        // handoff); the wizard must not clobber that work.
        const profilePath = resolve(root, "context/profile.md");
        if (existsSync(profilePath)) {
          skipped.push("context/me.md", "context/org.md");
          return { written, skipped };
        }

        // AC1: write context/me.md from role / workstyle / team / keyTools.
        const mePath = resolve(root, "context/me.md");
        if (existsNonPlaceholder(mePath) && !data.overwriteMe) {
          skipped.push("context/me.md");
        } else {
          writeContextFile(mePath, buildMeContent(data.answers));
          written.push("context/me.md");
        }

        // AC2: write context/org.md only when user confirmed sensitivity gate.
        // If sensitivity confirmation was declined, orgAgreed is false and
        // org.md is left unchanged (or not created).
        if (data.orgAgreed) {
          const orgPath = resolve(root, "context/org.md");
          if (existsNonPlaceholder(orgPath) && !data.overwriteOrg) {
            skipped.push("context/org.md");
          } else {
            writeContextFile(orgPath, buildOrgContent(data.answers));
            written.push("context/org.md");
          }
        }
      } else {
        // target === "active" — AC3: write context/active.md for both paths.
        const activePath = resolve(root, "context/active.md");
        if (existsNonPlaceholder(activePath) && !data.overwriteActive) {
          skipped.push("context/active.md");
        } else {
          writeContextFile(activePath, buildActiveContent(data.answers));
          written.push("context/active.md");
        }
      }

      return { written, skipped };
    },
  );
