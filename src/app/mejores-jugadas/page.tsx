import { BestPlaysView } from "@/components/BestPlaysView";

export const dynamic = "force-dynamic";

export default function MejoresJugadasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Mejores Jugadas</h2>
        <p className="text-sm text-white/50">
          Motor matemático que prioriza números y arma jugadas por lotería y tipo de juego.
        </p>
      </div>
      <BestPlaysView />
    </div>
  );
}
