import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/work-hq/AppSidebar";
import { loadOnboarding } from "@/server/load-onboarding";

export const Route = createFileRoute("/_app")({
  // Reads docs/data/local/onboarding-state.json on every navigation so the
  // sidebar's onboarding progress reflects real state (story 017 AC1).
  loader: async () => loadOnboarding(),
  component: AppLayout,
});

function AppLayout() {
  const onboardingState = Route.useLoaderData();
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AppSidebar onboardingState={onboardingState} />
      <main className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
