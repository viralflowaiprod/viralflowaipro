import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link2, User as UserIcon } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Minha conta — ViralFlow" }] }),
  component: Accounts,
});

function Accounts() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { ...data, email: u.user.email };
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["my-connected-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("connected_accounts").select("*");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Minha conta" subtitle="Informações do perfil e redes conectadas" />

      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-full bg-primary/10 grid place-items-center">
            <UserIcon className="size-5 text-primary-glow" />
          </div>
          <div>
            <div className="font-medium">{profile?.full_name ?? "—"}</div>
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Redes conectadas</h3>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings/integrations"><Link2 className="size-4 mr-2" /> Conectar</Link>
          </Button>
        </div>
        {!accounts?.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma rede conectada. Conecte YouTube, Instagram ou TikTok para publicar automaticamente.
          </p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="flex justify-between border border-border/40 rounded-lg px-4 py-3">
                <span className="capitalize">{a.platform} — {a.account_name ?? "Conta autorizada"}</span>
                <Badge>{a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
