// Pure builder for the "Collect & Copy" markdown handoff block.

export type HandoffKind =
  | "standup"
  | "wrap-up"
  | "process-backlog"
  | "gather-answers"
  | "first-standup"
  | "profile-bootstrap"
  | "profile-corrections"
  | "onboarding";

export type HandoffSection = { label: string; body: string | string[] };

export type HandoffSpec = {
  kind: HandoffKind;
  sections: HandoffSection[];
};

const today = () => new Date().toISOString().slice(0, 10);

export function buildHandoff({ kind, sections }: HandoffSpec): {
  markdown: string;
  bytes: number;
} {
  const header = `## Work HQ handoff · ${kind} · ${today()}`;
  const body = sections
    .filter((s) => {
      const v = s.body;
      return Array.isArray(v) ? v.filter(Boolean).length > 0 : !!v?.trim();
    })
    .map((s) => {
      const value = Array.isArray(s.body)
        ? s.body
            .filter(Boolean)
            .map((line) => `- ${line}`)
            .join("\n")
        : s.body.trim();
      return `**${s.label}**\n${value}`;
    })
    .join("\n\n");
  const markdown = body
    ? `${header}\n\n${body}\n`
    : `${header}\n\n_No input yet._\n`;
  const bytes = new TextEncoder().encode(markdown).length;
  return { markdown, bytes };
}
