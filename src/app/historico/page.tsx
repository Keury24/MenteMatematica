import { HistoricoView } from "@/components/HistoricoView";

export const dynamic = "force-dynamic";

export default function HistoricoPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Histórico de resultados</h2>
        <p className="text-sm text-white/50">Últimos sorteos registrados por juego.</p>
      </div>
      <HistoricoView />
    </div>
  );
}
