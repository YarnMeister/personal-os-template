import { cn } from "@/lib/utils";
import { StalenessBadge } from "./StalenessBadge";

export type OsSection = {
  title: string;
  render: React.ReactNode;
};

export function OsStatePanel({
  filename,
  updatedAt,
  sections,
  className,
}: {
  filename: string;
  updatedAt: string;
  sections: OsSection[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-8", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            File · {filename}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Active OS state
          </h2>
        </div>
        <StalenessBadge updatedAt={updatedAt} />
      </div>

      <div className="space-y-6">
        {sections.map((s) => (
          <div
            key={s.title}
            className="space-y-2 font-mono text-sm leading-relaxed"
          >
            <h3 className="font-sans text-sm font-semibold text-muted-foreground">
              ## {s.title}
            </h3>
            <div className="text-foreground/90">{s.render}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
