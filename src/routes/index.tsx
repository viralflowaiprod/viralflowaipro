import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Calendar, Sparkles, TrendingUp, Video, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ViralFlow — Automatize sua criação de conteúdo com IA" },
      {
        name: "description",
        content:
          "Gere, agende e publique até 80 vídeos virais por dia automaticamente. Plataforma SaaS de automação de conteúdo.",
      },

    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Video,
    title: "Geração automática",
    desc: "Até 80 vídeos por dia gerados com IA — hook, roteiro, voz e legendas.",
  },
  {
    icon: Calendar,
    title: "Agendamento inteligente",
    desc: "Programe postagens para os melhores horários em cada plataforma.",
  },
  {
    icon: TrendingUp,
    title: "Distribuição multi-plataforma",
    desc: "YouTube, Instagram, TikTok — uma fonte, todos os canais.",
  },
  {
    icon: Zap,
    title: "Baixo custo, alta escala",
    desc: "Multi-API keys com rotação automática para custo mínimo.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50 bg-background/70">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-primary shadow-glow grid place-items-center">
              <Bot className="size-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-lg">ViralFlow</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
          </nav>

        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
            <Sparkles className="size-3 text-primary-glow" />
            Geração automatizada de conteúdo com IA
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]">
            Conteúdo viral em <span className="text-gradient">piloto automático</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Gere até 80 vídeos virais por dia, programe e publique em todas as plataformas —
            sem editor, sem complicação.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-base">
                Acessar minha conta <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
          </div>

        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-card hover:shadow-glow transition-shadow"
            >
              <div className="size-10 rounded-lg bg-accent/40 grid place-items-center mb-4">
                <f.icon className="size-5 text-primary-glow" />
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ViralFlow. Feito para criadores.
      </footer>
    </div>
  );
}
