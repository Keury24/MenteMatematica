"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Inicio" },
  { href: "/mejores-jugadas", label: "Mejores Jugadas" },
  { href: "/estadisticas", label: "Estadísticas" },
  { href: "/historico", label: "Histórico" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {TABS.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-cyan-400/20 text-cyan-100" : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
