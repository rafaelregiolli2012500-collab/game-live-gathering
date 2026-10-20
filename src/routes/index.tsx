import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GameHome = lazy(() => import("@/components/GameHome"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brasil Fight Arena — Lula vs Flávio" },
      { name: "description", content: "Jogo de luta arcade 2D com arena LIVE e presentes da plateia." },
      { property: "og:title", content: "Brasil Fight Arena — Lula vs Flávio" },
      { property: "og:description", content: "Jogo de luta arcade 2D com arena LIVE e presentes da plateia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Loading() {
  return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando arena…</div>;
}

function Index() {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <GameHome />
      </Suspense>
    </ClientOnly>
  );
}
