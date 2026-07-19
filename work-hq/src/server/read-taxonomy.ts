/**
 * read-taxonomy — server function that reads and parses
 * context/org-structure.md into a structured taxonomy object.
 *
 * Format (ADR-P6-010 / file-contracts §1.4):
 *   # Org Structure · Updated: YYYY-MM-DD   ← title line (ignored)
 *   ## <Business Area>                        ← opens a new area
 *   - <Portfolio>                              ← top-level bullet (no leading space)
 *     - <Squad>                               ← nested bullet (leading whitespace)
 *
 * Parse rules (lenient on input whitespace):
 *   - `## ` line → new business area
 *   - line starting with `- ` and NO leading whitespace → portfolio under current area
 *   - line starting with `-` and HAS leading whitespace → squad under current portfolio
 *   - all other lines (blank, title, HTML comments) → ignored
 *
 * Returns { businessAreas: [] } when the file is absent or unreadable.
 * Modelled on load-onboarding.ts (createServerFn GET, strict: false).
 */

import { createServerFn } from "@tanstack/react-start";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface Squad {
  name: string;
}

export interface Portfolio {
  name: string;
  squads: string[];
}

export interface BusinessArea {
  name: string;
  portfolios: Portfolio[];
}

export interface Taxonomy {
  businessAreas: BusinessArea[];
}

/** Resolves relative to the repo root (one level up from work-hq/). */
function taxonomyFilePath(): string {
  return resolve(process.cwd(), "../context/org-structure.md");
}

/**
 * Parse the org-structure.md content into a Taxonomy object.
 * Lenient: any leading whitespace (tab or 2+ spaces) before `- ` counts as a
 * squad line; a `- ` with NO leading whitespace is a portfolio line.
 */
export function parseTaxonomy(content: string): Taxonomy {
  const lines = content.split("\n");
  const businessAreas: BusinessArea[] = [];
  let currentArea: BusinessArea | null = null;
  let currentPortfolio: Portfolio | null = null;

  for (const rawLine of lines) {
    // Business area heading: ## <name>
    if (rawLine.startsWith("## ")) {
      const name = rawLine.slice(3).trim();
      if (name) {
        currentArea = { name, portfolios: [] };
        currentPortfolio = null;
        businessAreas.push(currentArea);
      }
      continue;
    }

    // Squad line: leading whitespace + "- " (tab or any spaces count)
    if (/^\s+- /.test(rawLine)) {
      const name = rawLine.replace(/^\s+- /, "").trim();
      if (name && currentPortfolio) {
        currentPortfolio.squads.push(name);
      }
      continue;
    }

    // Portfolio line: "- " at column 0 (no leading whitespace)
    if (/^- /.test(rawLine)) {
      const name = rawLine.slice(2).trim();
      if (name && currentArea) {
        currentPortfolio = { name, squads: [] };
        currentArea.portfolios.push(currentPortfolio);
      }
      continue;
    }

    // All other lines (title, blank, HTML comment) — ignored.
  }

  return { businessAreas };
}

export const readTaxonomy = createServerFn({
  method: "GET",
  strict: false,
}).handler(async (): Promise<Taxonomy> => {
  const filePath = taxonomyFilePath();
  if (!existsSync(filePath)) {
    return { businessAreas: [] };
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    return parseTaxonomy(content);
  } catch {
    // Unreadable file — return empty taxonomy rather than throwing.
    return { businessAreas: [] };
  }
});
