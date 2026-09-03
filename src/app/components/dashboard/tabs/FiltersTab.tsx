import { Plus, RefreshCcw, Trash2 } from "lucide-react";
import { FILTERS } from "../../../data/photobooth";
import type { FilterPreset } from "../../../types/photobooth";
import { type FilterBuilder, buildFilterCss } from "../DashboardUtils";

interface FiltersTabProps {
  filters: FilterPreset[];
  filterDraft: FilterPreset;
  setFilterDraft: React.Dispatch<React.SetStateAction<FilterPreset>>;
  filterBuilder: FilterBuilder;
  setFilterBuilder: React.Dispatch<React.SetStateAction<FilterBuilder>>;
  onSaveFilter: () => void;
  onUpdateFilters: React.Dispatch<React.SetStateAction<FilterPreset[]>>;
  onOpenDeleteFilterModal: (id: string, label: string) => void;
}

export function FiltersTab({
  filters,
  filterDraft,
  setFilterDraft,
  filterBuilder,
  setFilterBuilder,
  onSaveFilter,
  onUpdateFilters,
  onOpenDeleteFilterModal,
}: FiltersTabProps) {
  const updateBuilder = (key: keyof FilterBuilder, val: number) => {
    setFilterBuilder((curr) => {
      const next = { ...curr, [key]: val };
      setFilterDraft((draft) => ({ ...draft, css: buildFilterCss(next) }));
      return next;
    });
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-5">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="text-lg font-black text-foreground">Filter Studio</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-black text-foreground">
              Name
              <input
                value={filterDraft.label}
                onChange={(event) => setFilterDraft((current) => ({ ...current, label: event.target.value }))}
                className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
              />
            </label>
            <label className="space-y-1 text-sm font-black text-foreground">
              Source
              <input
                value={filterDraft.source || ""}
                onChange={(event) => setFilterDraft((current) => ({ ...current, source: event.target.value }))}
                placeholder="Lightroom, VSCO, custom..."
                className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
              />
            </label>
          </div>
          <label className="mt-3 block space-y-1 text-sm font-black text-foreground">
            CSS Filter String
            <textarea
              value={filterDraft.css}
              onChange={(event) => setFilterDraft((current) => ({ ...current, css: event.target.value }))}
              rows={3}
              className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 font-mono text-xs outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onSaveFilter} className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-md">
              <Plus size={16} /> Save Filter
            </button>
            <button onClick={() => onUpdateFilters(FILTERS)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-muted-foreground">
              <RefreshCcw size={16} /> Reset ke Default
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10">
          <h2 className="text-lg font-black text-foreground">Visual Builder</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              { label: `Brightness (${filterBuilder.brightness}%)`, key: "brightness", min: 50, max: 200 },
              { label: `Contrast (${filterBuilder.contrast}%)`, key: "contrast", min: 50, max: 200 },
              { label: `Saturation (${filterBuilder.saturation}%)`, key: "saturation", min: 0, max: 250 },
              { label: `Sepia (${filterBuilder.sepia}%)`, key: "sepia", min: 0, max: 100 },
              { label: `Grayscale (${filterBuilder.grayscale}%)`, key: "grayscale", min: 0, max: 100 },
              { label: `Hue Rotate (${filterBuilder.hue}deg)`, key: "hue", min: -180, max: 180 },
              { label: `Blur (${filterBuilder.blur}px)`, key: "blur", min: 0, max: 10 },
            ].map((control) => (
              <label key={control.key} className="space-y-1 text-xs font-black text-foreground">
                {control.label}
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  value={filterBuilder[control.key as keyof FilterBuilder]}
                  onChange={(event) => updateBuilder(control.key as keyof FilterBuilder, Number(event.target.value))}
                  className="w-full"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/70 p-4 shadow-inner dark:border-white/10 dark:bg-white/10">
          <h3 className="text-sm font-black text-foreground">Preview Result</h3>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/80 bg-slate-900 shadow-md">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80"
              alt="Filter Live Preview"
              style={{ filter: filterDraft.css || "none" }}
              className="h-64 w-full object-cover transition-all duration-300"
            />
          </div>
          <p className="mt-3 truncate text-center text-xs font-black text-foreground">{filterDraft.label || "Preset Live Preview"}</p>
        </div>

        <div className="space-y-3">
          {filters.map((filter) => (
            <div key={filter.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm dark:border-white/10 dark:bg-white/10">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-foreground">{filter.label}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{filter.css}</p>
                {filter.source && <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{filter.source}</span>}
              </div>
              <button
                onClick={() => onOpenDeleteFilterModal(filter.id, filter.label)}
                className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40"
                aria-label={`Delete filter ${filter.label}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
