import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar senha — ViralFlow" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Link de recuperação enviado!");
  };

  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para seu email">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
          {loading ? "Enviando..." : "Enviar link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-primary-glow hover:underline">Voltar para login</Link>
      </p>
    </AuthShell>
  );
}
