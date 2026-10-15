import type { Metadata } from "next";
import "./globals.css";
import { NavTabs } from "@/components/NavTabs";

export const metadata: Metadata = {
  title: "MenteMatemática · Análisis y jugadas de loterías",
  description:
    "Análisis estadístico y generación de jugadas para las loterías dominicanas, alimentado por conectate.com.do",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/30 to-blue-500/20 text-lg font-black text-cyan-200">
                ∑
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">MenteMatemática</h1>
                <p className="text-xs text-white/50">Análisis y jugadas · loterías dominicanas</p>
              </div>
            </div>
            <NavTabs />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-white/40">
          Datos de resultados: conectate.com.do · Herramienta analítica y de entretenimiento. Juegue con responsabilidad.
        </footer>
      </body>
    </html>
  );
}
