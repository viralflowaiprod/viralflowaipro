import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  getMySubscriptionStatus,
  redeemActivationCode,
} from "@/lib/subscriptions.functions";

export const Route = createFileRoute("/_authenticated/activate")({
  head: () => ({ meta: [{ title: "Ativar acesso — ViralFlow" }] }),
  component: ActivatePage,
});

function ActivatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getStatus = useServerFn(getMySubscriptionStatus);
  const redeem = useServerFn(redeemActivationCode);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getStatus(),
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await redeem({ data: { code: code.trim() } });
      toast.success("Acesso liberado!");
      await qc.invalidateQueries({ queryKey: ["subscription-status"] });
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao ativar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-xl mx-auto">
      <PageHeader
        title="Ativar assinatura"
        subtitle="Insira o código recebido após o pagamento (Kiwify, Hotmart, Kirvano ou Monetizze)."
      />

      {status?.active ? (
        <Card className="p-6 bg-gradient-surface border-success/30">
          <div className="flex items-center gap-3 mb-3 text-success">
            <ShieldCheck className="size-5" />
            <span className="font-medium">Assinatura ativa</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Plano: <strong>{status.subscription?.plan_tier ?? "admin"}</strong>
            {status.subscription?.source ? ` · via ${status.subscription.source}` : ""}
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: "/dashboard" })}>
            Ir para o dashboard
          </Button>
        </Card>
      ) : (
        <Card className="p-6 bg-gradient-surface border-border/60">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código de ativação</Label>
              <div className="relative">
                <KeyRound className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="code"
                  required
                  className="pl-9 uppercase tracking-wider"
                  placeholder="VF-XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary shadow-glow"
            >
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Ativar acesso
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Não tem código? Adquira o ViralFlow em uma das nossas plataformas
            parceiras e receba o código por email.
          </p>
        </Card>
      )}
    </div>
  );
}
