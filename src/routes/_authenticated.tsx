import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell, useRequireAuth } from "@/components/app-shell";
import { getMySubscriptionStatus } from "@/lib/subscriptions.functions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const getStatus = useServerFn(getMySubscriptionStatus);
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getStatus(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const onActivate = path.startsWith("/activate");

  useEffect(() => {
    if (!user || statusLoading || !status) return;
    if (!status.active && !onActivate) {
      navigate({ to: "/activate", replace: true });
    }
  }, [user, status, statusLoading, onActivate, navigate]);

  if (loading || !user || statusLoading) {
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
