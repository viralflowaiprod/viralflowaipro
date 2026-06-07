import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — ViralFlow" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Conta criada! Verifique seu email para confirmar.");
  };

  return (
    <AuthShell title="Criar conta" subtitle="Comece a gerar conteúdo viral em minutos">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput id="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
          {loading ? "Criando..." : "Criar conta"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta? <Link to="/login" className="text-primary-glow hover:underline">Entrar</Link>
      </p>
    </AuthShell>
  );
}
