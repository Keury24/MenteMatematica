import { StatsView } from "@/components/StatsView";

export const dynamic = "force-dynamic";

export default function EstadisticasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Estadísticas</h2>
        <p className="text-sm text-white/50">
          Frecuencias, atrasos, chi-cuadrado, entropía y estructura de los sorteos.
        </p>
      </div>
      <StatsView />
    </div>
  );
}
