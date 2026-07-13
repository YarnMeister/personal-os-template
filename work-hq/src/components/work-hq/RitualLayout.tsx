import { cn } from "@/lib/utils";

export function RitualLayout({
  title,
  eyebrow,
  status,
  left,
  right,
  className,
}: {
  title: string;
  eyebrow?: string;
  status?: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-background/70 px-8 backdrop-blur-md">
        <div className="flex items-center gap-4">
          {eyebrow && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {eyebrow}
            </span>
          )}
          <h1 className="text-lg font-medium text-foreground">{title}</h1>
          {status}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          Saved to LocalStorage · just now
        </span>
      </header>

      <section className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-r border-border/70 bg-muted/20 p-8">
          <div className="mx-auto max-w-xl">{left}</div>
        </div>
        <div className="min-h-0 overflow-y-auto p-8">
          <div className="mx-auto max-w-xl">{right}</div>
        </div>
      </section>
    </div>
  );
}
