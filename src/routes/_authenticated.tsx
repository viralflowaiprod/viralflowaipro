import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell, useRequireAuth } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useRequireAuth();
  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}
