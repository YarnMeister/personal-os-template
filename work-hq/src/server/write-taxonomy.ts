/**
 * write-taxonomy — server function that writes the full taxonomy back to
 * context/org-structure.md in canonical form (ADR-P6-010 / file-contracts §1.4).
 *
 * Accepts the full { businessAreas } structure (NOT a delta — mirrors how
 * save-onboarding sends the whole state). Validates with zod, then re-serialises
 * the whole file:
 *   - Refreshes the `# Org Structure · Updated: <today>` header.
 *   - Preserves the guidance comment block.
 *   - Emits each business area as `## <name>`, each portfolio as `- <name>`,
 *     each squad as `  - <name>`, with one blank line between business areas.
 *
 * This is a full-file canonical write (NOT surgical text-patching), consistent
 * with scaffold-files / save-onboarding. Content and order are preserved exactly;
 * only non-canonical whitespace (tabs, extra blank lines) is normalised on
 * subsequent writes. A round-trip of the seeded file is byte-idempotent because
 * the seed is already canonical.
 *
 * Modelled on save-onboarding.ts (createServerFn POST, zod validator,
 * mkdirSync+writeFileSync).
 */

import { createServerFn } from "@tanstack/react-start";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const squadSchema = z.string().min(1);

const portfolioSchema = z.object({
  name: z.string().min(1),
  squads: z.array(squadSchema).default([]),
});

const businessAreaSchema = z.object({
  name: z.string().min(1),
  portfolios: z.array(portfolioSchema).default([]),
});

const taxonomyInputSchema = z.object({
  businessAreas: z.array(businessAreaSchema),
});

type TaxonomyInput = z.infer<typeof taxonomyInputSchema>;

/** Resolves relative to the repo root (one level up from work-hq/). */
function taxonomyFilePath(): string {
  return resolve(process.cwd(), "../context/org-structure.md");
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const GUIDANCE_COMMENT = `<!-- Personal OS business-area taxonomy · file-contracts §1.4 / ADR-P6-010.
     Edit by hand to match your organisation. Shape:
       ## <Business Area>
       - <Portfolio>
         - <Squad>
     The onboarding review picker reads this file and writes your additions
     back to it in this same shape. -->`;

/**
 * Serialise a Taxonomy object to canonical org-structure.md content.
 * Emits the staleness-header + guidance comment, then each business area
 * separated by one blank line.
 */
export function serializeTaxonomy(taxonomy: TaxonomyInput): string {
  const header = `# Org Structure · Updated: ${todayDate()}`;

  const areaBlocks = taxonomy.businessAreas
    .map((area) => {
      const portfolioLines = area.portfolios
        .map((portfolio) => {
          const squadLines = portfolio.squads
            .map((squad) => `  - ${squad}`)
            .join("\n");
          return `- ${portfolio.name}${squadLines ? `\n${squadLines}` : ""}`;
        })
        .join("\n");
      return `## ${area.name}${portfolioLines ? `\n${portfolioLines}` : ""}`;
    })
    .join("\n\n");

  return `${header}\n\n${GUIDANCE_COMMENT}\n\n${areaBlocks}\n`;
}

export const writeTaxonomy = createServerFn({ method: "POST" })
  .validator((data: unknown) => taxonomyInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const filePath = taxonomyFilePath();
    const content = serializeTaxonomy(data);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf-8");
    return { ok: true } as const;
  });
