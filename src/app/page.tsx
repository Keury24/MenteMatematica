import Link from "next/link";
import { getCompanies, getGames, getStats, getMeta } from "@/lib/db";
import { KIND_LABEL } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Home() {
  const stats = getStats();
  const companies = getCompanies();
  const games = getGames();
  const lastIngest = getMeta("last_ingest");

  const byCompany = companies.map((c) => ({
    ...c,
    count: games.filter((g) => g.companyId === c.id).length,
  }));

  const kinds = Array.from(new Set(games.map((g) => g.kind)));

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip border-cyan-400/30 bg-cyan-400/10 text-cyan-100">Datos en vivo · conectate.com.do</span>
            {lastIngest && <span className="chip text-white/50">Última ingesta: {new Date(lastIngest).toLocaleString("es-DO")}</span>}
          </div>
          <h2 className="text-3xl font-black leading-tight sm:text-4xl">
            Análisis matemático y <span className="text-cyan-300">mejores jugadas</span> para las loterías dominicanas
          </h2>
          <p className="max-w-3xl text-sm text-white/60">
            Ingesta automática de resultados, análisis estadístico riguroso (frecuencia, recencia, atrasos, coocurrencia,
            cadenas de Markov, chi-cuadrado y entropía) y un motor que genera jugadas por lotería y tipo de juego,
            con probabilidades honestas y sin promesas falsas.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/mejores-jugadas" className="btn btn-primary">
              Ver Mejores Jugadas →
            </Link>
            <Link href="/estadisticas" className="btn">
              Estadísticas
            </Link>
            <Link href="/historico" className="btn">
              Histórico
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Juegos" value={stats.games} />
        <StatCard label="Compañías" value={stats.companies} />
        <StatCard label="Sorteos" value={stats.draws.toLocaleString("es-DO")} />
        <StatCard
          label="Días cubiertos"
          value={stats.days}
          hint={stats.oldestDate ? `${stats.oldestDate} → ${stats.newestDate}` : undefined}
        />
      </section>

      {stats.draws === 0 && (
        <section className="card border-amber-400/30 text-amber-100/90">
          <h3 className="mb-1 font-bold">Aún no hay histórico</h3>
          <p className="text-sm">
            Ejecuta la ingesta para descargar los resultados: <code className="rounded bg-black/30 px-1.5 py-0.5">npm run ingest -- --days 365</code>
          </p>
        </section>
      )}

      <section className="card">
        <h3 className="mb-3 text-lg font-bold">Loterías cubiertas</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byCompany.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.title}</span>
                <span className="chip text-white/50">{c.count} juegos</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="mb-3 text-lg font-bold">Tipos de juego analizados</h3>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <span key={k} className="chip text-white/70">
              {KIND_LABEL[k] ?? k}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 font-mono text-2xl font-black tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/40">{hint}</div> : null}
    </div>
  );
}
