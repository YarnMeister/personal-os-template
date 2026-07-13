import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/work-hq/AppSidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
