import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldOff, KeyRound, Ban, Trash2, UserPlus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listUsers, setUserRole, toggleBan, sendPasswordReset, deleteUser, checkIsAdmin,
} from "@/lib/admin.functions";
import {
  adminGenerateCodes, adminListCodes, adminRevokeCode,
} from "@/lib/subscriptions.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ViralFlow" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fetchUsers = useServerFn(listUsers);
  const checkAdmin = useServerFn(checkIsAdmin);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const adminCheck = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdmin() });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    enabled: adminCheck.data?.isAdmin === true,
  });

  const grantFn = useServerFn(setUserRole);
  const banFn = useServerFn(toggleBan);
  const resetFn = useServerFn(sendPasswordReset);
  const delFn = useServerFn(deleteUser);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const grant = useMutation({
    mutationFn: (v: { userId: string; isAdmin: boolean }) =>
      grantFn({ data: { userId: v.userId, role: "admin", action: v.isAdmin ? "revoke" : "grant" } }),
    onSuccess: () => { toast.success("Papel atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const ban = useMutation({
    mutationFn: (v: { userId: string; ban: boolean }) => banFn({ data: v }),
    onSuccess: (_d, v) => { toast.success(v.ban ? "Usuário banido" : "Usuário reativado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: (email: string) => resetFn({ data: { email } }),
    onSuccess: () => toast.success("Link de reset enviado"),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (userId: string) => delFn({ data: { userId } }),
    onSuccess: () => { toast.success("Usuário excluído"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (adminCheck.isLoading) {
    return <div className="p-8"><div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  if (!adminCheck.data?.isAdmin) {
    return (
      <div className="p-8 max-w-2xl">
        <PageHeader title="Acesso restrito" subtitle="Esta área é exclusiva para administradores." />
        <div className="rounded-xl border border-border/60 bg-gradient-surface p-6 flex gap-3">
          <AlertCircle className="size-5 text-primary-glow shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Você ainda não é admin. Para se promover como o primeiro admin, execute este SQL no painel do banco (apenas uma vez):</p>
            <pre className="text-xs bg-background/60 p-3 rounded-lg overflow-x-auto"><code>{`INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'SEU_EMAIL@exemplo.com'
ON CONFLICT DO NOTHING;`}</code></pre>
            <p>Depois recarregue esta página.</p>
          </div>
        </div>
      </div>
    );
  }

  const filtered = (users.data ?? []).filter((u) =>
    !q || u.email.toLowerCase().includes(q.toLowerCase()) || u.full_name?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="Administração"
        subtitle={`${users.data?.length ?? 0} usuários cadastrados na plataforma`}
      />

      <div className="rounded-xl border border-border/60 bg-gradient-surface p-4 flex items-center gap-3">
        <Input
          placeholder="Buscar por email ou nome..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-xl border border-border/60 bg-gradient-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Último login</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {filtered.map((u) => {
              const isAdmin = u.roles.includes("admin");
              const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date();
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {isAdmin && <Badge className="bg-primary/20 text-primary-glow border-primary/30">admin</Badge>}
                    {!u.email_confirmed_at && <Badge variant="outline">não confirmado</Badge>}
                    {isBanned && <Badge variant="destructive">banido</Badge>}
                    {!isAdmin && u.email_confirmed_at && !isBanned && <Badge variant="secondary">ativo</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.last_sign_in_at
                      ? formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true, locale: ptBR })
                      : "nunca"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost" size="icon" title={isAdmin ? "Remover admin" : "Tornar admin"}
                      onClick={() => grant.mutate({ userId: u.id, isAdmin })}
                    >
                      {isAdmin ? <ShieldOff className="size-4" /> : <Shield className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Enviar reset de senha"
                      onClick={() => reset.mutate(u.email)}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title={isBanned ? "Reativar" : "Banir"}
                      onClick={() => ban.mutate({ userId: u.id, ban: !isBanned })}
                    >
                      <Ban className="size-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Excluir usuário"
                      onClick={() => {
                        if (confirm(`Excluir ${u.email}? Esta ação não pode ser desfeita.`)) del.mutate(u.id);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!users.isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border border-border/60 bg-gradient-surface p-5 text-sm text-muted-foreground flex gap-3">
        <UserPlus className="size-4 mt-0.5 text-primary-glow shrink-0" />
        <p>
          <strong className="text-foreground">Sobre senhas:</strong> as senhas dos usuários são criptografadas (bcrypt) pelo sistema de autenticação e não podem ser visualizadas em texto puro — nem por administradores. Use "Enviar reset de senha" para que o usuário defina uma nova.
        </p>
      </div>
    </div>
  );
}
