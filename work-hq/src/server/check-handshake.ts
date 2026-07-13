/**
 * check-handshake — server function that reads docs/data/local/handshake.json
 * and returns whether the assistant has written the observed verification
 * handshake (story 015 / ADR-P6-008).
 *
 * Called by PhaseWire's 5-second auto-poll to detect when the user's AI
 * assistant has confirmed it loaded the constitution by writing the handshake
 * file. The wizard never writes this file — it is read-only here.
 *
 * Returns:
 *   detected  — true when handshake.json exists (existence-only; no mtime
 *               check, mirroring check-profile-exists staleness rule).
 *   verifiedAt — the ISO 8601 timestamp from the file, or null when absent /
 *               malformed.
 *   assistant  — the assistant name from the file, or null when absent /
 *               malformed.
 *
 * Malformed JSON is treated as detected: false, verifiedAt: null,
 * assistant: null — the route never throws.
 */

import { createServerFn } from "@tanstack/react-start";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function handshakeFilePath(): string {
  return resolve(process.cwd(), "../docs/data/local/handshake.json");
}

export const checkHandshake = createServerFn({
  method: "GET",
  strict: false,
}).handler(
  async (): Promise<{
    detected: boolean;
    verifiedAt: string | null;
    assistant: string | null;
  }> => {
    const filePath = handshakeFilePath();

    if (!existsSync(filePath)) {
      return { detected: false, verifiedAt: null, assistant: null };
    }

    // File exists — attempt to parse for display fields.
    try {
      const raw = readFileSync(filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        const obj = parsed as Record<string, unknown>;
        const verifiedAt =
          typeof obj["verifiedAt"] === "string" ? obj["verifiedAt"] : null;
        const assistant =
          typeof obj["assistant"] === "string" ? obj["assistant"] : null;
        return { detected: true, verifiedAt, assistant };
      }
      // Parsed but not an object — file exists, fields null.
      return { detected: true, verifiedAt: null, assistant: null };
    } catch {
      // JSON parse failure or read error — file exists but malformed.
      return { detected: true, verifiedAt: null, assistant: null };
    }
  },
);
