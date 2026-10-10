import { useMemo, useState, type KeyboardEvent } from "react";
import { MUSCLE_GROUPS } from "@/lib/gymmane/muscle-activity";
import type { MuscleActivity, MuscleGroup, MuscleIntensity, MuscleView } from "@/lib/gymmane/muscle-activity";

const FILL: Record<MuscleIntensity, string> = {
  none: "#5f6872",
  low: "#8ed3f7",
  moderate: "#3a7be0",
  high: "#f58220",
  "very-high": "#dc2f2f",
};
const INTENSITY_LABEL: Record<MuscleIntensity, string> = {
  none: "No recorded work",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very high",
};
const LEGEND: MuscleIntensity[] = ["none", "low", "moderate", "high", "very-high"];

// Left half of the figure only (x < 100); each path is mirrored across x = 100 for the right side.
const TORSO = "M99 60 C88 62 78 64 72 70 C68 90 70 120 74 140 C76 160 72 178 72 192 L99 196Z";
const NECK = "M93 44 L92 62 L99 62 L99 44Z";
const HAND = "M46 198 C43 208 43 216 46 224 C48 229 52 228 55 222 C58 214 58 206 57 200Z";
const LEG =
  "M99 190 L72 190 C66 220 66 262 74 284 C76 292 76 298 75 306 C73 322 74 336 76 350 L75 372 C73 382 68 388 65 395 C65 400 80 401 88 399 C91 396 90 388 88 378 L88 350 C90 330 92 312 92 296 C95 290 98 288 99 286Z";
const BODY_BASE: Record<MuscleView, string[]> = {
  front: [TORSO, NECK, HAND, LEG, "M72 280 C72 290 78 296 86 295 C90 292 91 284 90 278Z"],
  back: [TORSO, NECK, HAND, LEG],
};

const ARM = "M60 104 C57 116 55 130 56 146 L66 148 C69 134 70 118 70 102 C66 105 63 105 60 104Z";
const FOREARM = "M56 150 C52 164 49 180 47 198 L56 202 C60 186 64 168 66 150Z";
const SIDE_DELT = "M59 80 C54 82 51 90 52 100 C53 104 57 105 61 104 C58 98 57 90 59 80Z";
const CALF_FRONT = "M80 296 C74 304 72 322 75 346 L82 348 C87 334 89 314 88 298 C86 294 83 294 80 296Z";
const CALF_BACK = "M81 292 C73 302 71 322 75 346 L82 350 C88 336 91 314 89 296 C87 290 84 288 81 292Z";

const SHAPES: Record<MuscleView, Partial<Record<MuscleGroup, string[]>>> = {
  front: {
    chest: ["M99 70 C92 68 84 68 76 71 C72 76 71 88 73 98 C80 107 92 109 99 105Z"],
    "front-deltoids": ["M76 71 C68 69 62 73 59 80 C58 90 59 98 61 104 C66 104 70 101 73 98 C71 88 72 76 76 71Z"],
    "side-deltoids": [SIDE_DELT],
    biceps: [ARM],
    forearms: [FOREARM],
    abs: [
      "M98.5 108 L91 109 C89.5 113 89.5 117 91 120 L98.5 120Z",
      "M98.5 122 L90.5 122.5 C89 128 89 133 90.5 136 L98.5 136Z",
      "M98.5 138 L90.5 138.5 C89.5 144 90 149 91.5 152 L98.5 152Z",
      "M98.5 154 L92 154.5 C91 160 92 165 94 170 L98.5 174Z",
    ],
    obliques: ["M88 112 C85 128 86 150 90 170 C85 172 79 168 76 160 C72 148 71 128 73 108 C79 111 84 112 88 111Z"],
    quadriceps: ["M86 192 C76 196 69 214 68 240 C68 260 72 274 79 286 C84 288 89 284 91 276 C92 256 92 228 90 200 C89 196 88 194 86 192Z"],
    adductors: ["M99 190 C94 192 91 196 90 200 C92 228 92 256 91 276 L94 270 C98 258 99 244 99 232Z"],
    calves: [CALF_FRONT],
  },
  back: {
    traps: ["M99 48 C93 54 86 60 77 66 C80 74 84 82 88 92 C92 102 96 112 99 124Z"],
    "rear-deltoids": ["M77 68 C68 68 61 73 58 80 L58 98 C60 103 66 104 72 99 C73 90 74 80 77 68Z"],
    "side-deltoids": [SIDE_DELT],
    "upper-back": ["M79 80 C76 88 75 98 73 106 C76 118 84 126 92 134 L99 138 L99 124 C96 112 92 102 88 92 C84 84 80 80 79 80Z"],
    lats: ["M73 106 C76 118 84 126 92 134 L91 168 C86 172 82 174 79 172 C74 158 72 134 73 106Z"],
    triceps: [ARM],
    forearms: [FOREARM],
    "lower-back": ["M99 138 L92 136 C90 150 90 166 92 182 L99 190Z"],
    obliques: ["M79 172 C82 174 86 172 91 168 L92 182 C88 186 82 186 78 184 C77 180 78 176 79 172Z"],
    glutes: ["M99 190 C94 188 86 186 78 188 C72 196 72 210 80 220 C88 226 96 222 99 218Z"],
    hamstrings: ["M99 226 C92 228 84 226 78 224 C72 240 72 262 78 284 C84 286 90 284 92 276 C96 260 98 244 99 226Z"],
    calves: [CALF_BACK],
  },
};

// Soft envelopes keep gaps (e.g. between ab blocks) inside the selectable group.
const UNDERLAY: Partial<Record<MuscleView, Partial<Record<MuscleGroup, string>>>> = {
  front: { abs: "M99 106 L99 176 C93 177 90 174 89 166 L89 126 C89 114 92 108 99 106Z" },
};

const MIRROR = "translate(200 0) scale(-1 1)";

export function MuscleMap({
  muscles,
  selectedMuscle,
  onSelect,
}: {
  muscles: MuscleActivity[];
  selectedMuscle: MuscleGroup | null;
  onSelect: (id: MuscleGroup) => void;
}) {
  const [view, setView] = useState<MuscleView>("front");
  const byId = useMemo(() => new Map(muscles.map((m) => [m.id, m])), [muscles]);
  const intensityOf = (id: MuscleGroup): MuscleIntensity => byId.get(id)?.intensity ?? "none";
  const visible = MUSCLE_GROUPS.filter((g) => (g.views as readonly MuscleView[]).includes(view));

  const keyHandler = (id: MuscleGroup) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div
      data-testid="muscle-map"
      className="w-full rounded-2xl border border-[#303036] bg-[#17171B] p-3 text-[#F5F5F7] sm:p-4"
    >
      <style>{`.mm-region{cursor:pointer;outline:none}.mm-region path{transition:opacity .15s}.mm-region:hover path{opacity:.82}.mm-region:focus-visible path{stroke:#fff;stroke-width:2.2}`}</style>
      <div role="tablist" aria-label="Body view" className="mx-auto mb-3 grid max-w-xs grid-cols-2 gap-1 rounded-xl bg-[#0B0B0D] p-1">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            data-testid={`button-muscle-view-${v}`}
            className={`min-h-10 rounded-lg text-sm font-semibold capitalize ${
              view === v ? "bg-[#B7F34A] text-[#0B0B0D]" : "text-[#A1A1AA]"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <svg
        viewBox="0 0 200 400"
        role="group"
        aria-label={`Muscle workload map, ${view} view`}
        data-testid={`svg-muscle-map-${view}`}
        className="mx-auto block h-auto max-h-[70dvh] w-full max-w-[300px]"
      >
        <g fill="#2a2a31" stroke="#3a3a42" strokeWidth="1">
          {BODY_BASE[view].map((d, i) => (
            <g key={i}>
              <path d={d} />
              <path d={d} transform={MIRROR} />
            </g>
          ))}
          <ellipse cx="100" cy="31" rx="16" ry="18" />
        </g>
        {visible.map(({ id, label }) => {
          const paths = SHAPES[view][id] ?? [];
          const intensity = intensityOf(id);
          const selected = selectedMuscle === id;
          return (
            <g
              key={id}
              className="mm-region"
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${label}: ${INTENSITY_LABEL[intensity]}`}
              data-testid={`region-muscle-${id}`}
              data-intensity={intensity}
              onClick={() => onSelect(id)}
              onKeyDown={keyHandler(id)}
              fill={FILL[intensity]}
              stroke={selected ? "#ffffff" : "#17171B"}
              strokeWidth={selected ? 2.4 : 1.2}
              strokeLinejoin="round"
            >
              <title>{`${label}: ${INTENSITY_LABEL[intensity]}`}</title>
              {UNDERLAY[view]?.[id] && (
                <g fillOpacity={0.35} stroke="none">
                  <path d={UNDERLAY[view]![id]} />
                  <path d={UNDERLAY[view]![id]} transform={MIRROR} />
                </g>
              )}
              {paths.map((d, i) => (
                <g key={i}>
                  <path d={d} data-testid={`path-muscle-${id}-left-${i}`} />
                  <path d={d} transform={MIRROR} data-testid={`path-muscle-${id}-right-${i}`} />
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Muscle groups in this view">
        {visible.map(({ id, label }) => {
          const intensity = intensityOf(id);
          const selected = selectedMuscle === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-pressed={selected}
                data-testid={`button-muscle-${id}`}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left ${
                  selected ? "border-[#B7F34A] bg-[#222228]" : "border-[#303036] bg-[#0B0B0D]"
                }`}
              >
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: FILL[intensity] }} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{label}</span>
                  <span className="block truncate text-[10px] text-[#A1A1AA]">{INTENSITY_LABEL[intensity]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-[#A1A1AA]" data-testid="legend-muscle-map">
        {LEGEND.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: FILL[k] }} />
            {INTENSITY_LABEL[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MuscleMap;
