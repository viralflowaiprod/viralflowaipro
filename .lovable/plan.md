
# Plano de evolução — ViralFlow AI SaaS

O sistema já existe (auth + DB + integração n8n + painel admin + página de geração). Esta atualização é **incremental**, distribuída em 5 fases para entregar valor de forma estável sem refazer o que já funciona.

---

## Fase 1 — Sistema de Chaves de Ativação (Kiwify/Hotmart/Kirvano/Monetizze)

**Objetivo:** Bloquear o acesso ao app a usuários sem assinatura ativa.

- Nova tabela `activation_codes` (code, plataforma_origem, status: active/used/revoked, used_by, expires_at, plan_tier).
- Nova tabela `subscriptions` (user_id, code_id, status, current_period_end).
- Coluna `subscription_status` no `profiles`.
- Tela no `/signup` e `/login`: campo obrigatório "Código de ativação".
- Endpoint público `/api/public/webhooks/{kiwify|hotmart|kirvano|monetizze}` para receber compras/cancelamentos e gerar/revogar códigos.
- Gate global: usuário sem `subscription.status = active` é redirecionado para `/activate`.
- Painel admin: gerar códigos manuais, listar/revogar.

## Fase 2 — Multi-tenant + Modo Privado

- Confirmar RLS em todas as tabelas (profiles, videos, video_jobs, scheduled_posts) — já existe; auditar e reforçar.
- Storage buckets privados Supabase: `user-media` com path `{user_id}/{campaign_id}/{file}` e policies por `auth.uid()`.
- Coluna `privacy_mode` em `profiles` (save_all | ephemeral).
- Quando `ephemeral`: pipeline gera mídia, publica e apaga storage/DB em 24h via cron.
- Admin mantém acesso via `supabaseAdmin` (já existe `has_role`).

## Fase 3 — Pipeline de Mídia completo (Gemini + Edge TTS + PolyNations + create-video)

- `n8nService.generateContent` evolui para enviar `{ idea, niche, goal }` e receber `{ script, copy, hashtags, structure }`.
- Webhook callback `/api/public/hooks/video-progress` recebe avanço de cada etapa do n8n e atualiza `video_jobs.progress` + `videos`.
- Etapas tracked: `script → tts → images (PolyNations) → assembly`.
- Validação: se PolyNations não retorna URLs, job vai para `failed` com mensagem clara.
- UI `/generation` mostra timeline de etapas (já existe base — adicionar steps).

## Fase 4 — Agendamento automático 36/dia

- Nova tabela `automation_settings` (user_id, enabled, mode: auto|manual, daily_quantity default 36, platforms[], time_slots jsonb default [08:00, 12:00, 17:00, …]).
- Cron `pg_cron` diário às 00:05: para cada usuário com `enabled=true`, gerar jobs do dia + agendar em `scheduled_posts`.
- Cron a cada 5 min: pegar `scheduled_posts` com `scheduled_for <= now()` e `status='scheduled'`, disparar n8n para publicar.
- Tela `/automation`: liga/desliga, escolhe modo, edita horários, cancela posts individuais.

## Fase 5 — Multiplataforma de publicação

- Já existe `/settings/integrations` (YouTube/Instagram/TikTok). Adicionar **Pinterest**.
- Cada `scheduled_post` carrega `platforms: string[]`.
- n8n recebe lista e publica em paralelo, retorna status por plataforma → tabela `post_results`.
- UI `/schedule`: usuário marca/desmarca plataformas por post.

---

## Detalhes técnicos

**Stack respeitada:**
- TanStack Start + `createServerFn` para lógica interna.
- Server routes `/api/public/*` apenas para webhooks externos (Kiwify, n8n callback).
- Supabase com RLS + `supabaseAdmin` em handlers verificados.
- n8n centralizado em `src/lib/n8n-service.ts` (já existe).

**Secrets necessários (pedirei conforme cada fase):**
- Fase 1: `KIWIFY_WEBHOOK_SECRET`, `HOTMART_WEBHOOK_SECRET`, `KIRVANO_WEBHOOK_SECRET`, `MONETIZZE_WEBHOOK_SECRET`.
- Fase 3: nada novo (PolyNations fica no n8n).
- Fase 5: credenciais OAuth de cada rede no n8n.

**O que NÃO vou fazer agora:**
- Reescrever auth/DB já existentes.
- Implementar PolyNations no front (fica no n8n).
- Cobrar pagamento direto (Lovable Payments) — o fluxo é via plataformas externas com código de ativação.

---

## Próximo passo

Aprovando este plano, começo pela **Fase 1 (chaves de ativação)** — é o bloqueio comercial que destrava todo o resto. Cada fase entrego e valido antes de seguir. Confirma qual fase começar ou se quer ajustar a ordem?
