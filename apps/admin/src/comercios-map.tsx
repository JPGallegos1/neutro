import {
  comercioKey,
  pinKindFor,
  type Comercio,
  type PinKind,
} from "@/comercio";

function project(
  lat: number,
  lng: number,
  center: { lat: number; lng: number },
  spanDeg: number,
  size: number,
) {
  const x = ((lng - center.lng) / spanDeg + 0.5) * size;
  const y = ((center.lat - lat) / spanDeg + 0.5) * size;
  return { x, y };
}

const PIN_CLASS: Record<PinKind, string> = {
  comercio: "bg-neutro-accent-blue",
  lead: "bg-neutro-text-muted",
  seleccionado: "bg-neutro-accent-orange scale-125",
};

export function ComerciosMap({
  comercios,
  selectedKey,
  leadKeys,
  center,
  onSelect,
}: {
  comercios: Comercio[];
  selectedKey: string | null;
  leadKeys: ReadonlySet<string>;
  center: { lat: number; lng: number };
  onSelect: (key: string) => void;
}) {
  const size = 320;
  const spanDeg = 0.04;
  return (
    <div
      className="relative overflow-hidden rounded-md bg-neutro-surface"
      data-admin-comercios-map
      style={{ width: size, height: size }}
      aria-label="Mapa de Comercios"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#262624_0%,#0a0a0a_70%)] opacity-40" />
      {comercios.map((c) => {
        const key = comercioKey(c);
        const kind = pinKindFor(key, selectedKey, leadKeys);
        const { x, y } = project(c.lat, c.lng, center, spanDeg, size);
        return (
          <button
            key={key}
            type="button"
            title={c.name}
            data-admin-pin={kind}
            data-admin-comercio-key={key}
            className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${PIN_CLASS[kind]}`}
            style={{ left: x, top: y }}
            onClick={() => onSelect(key)}
          />
        );
      })}
    </div>
  );
}
