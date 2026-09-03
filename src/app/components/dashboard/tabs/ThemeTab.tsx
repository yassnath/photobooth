import { RefreshCcw } from "lucide-react";
import { BACKGROUND_PRESETS, DEFAULT_UI_THEME } from "../../../data/photobooth";
import type { BoothThemeSettings } from "../../../types/photobooth";

interface ThemeTabProps {
  uiTheme: BoothThemeSettings;
  updateTheme: (patch: Partial<BoothThemeSettings>) => void;
  applyBackgroundPreset: (presetId: string) => void;
  onResetTheme: (defaultTheme: BoothThemeSettings) => void;
}

export function ThemeTab({ uiTheme, updateTheme, applyBackgroundPreset, onResetTheme }: ThemeTabProps) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm font-black text-foreground">
            Brand Name
            <input
              value={uiTheme.brandName}
              onChange={(event) => updateTheme({ brandName: event.target.value })}
              className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
            />
          </label>
          <label className="space-y-1 text-sm font-black text-foreground">
            Logo
            <input
              value={uiTheme.logoEmoji}
              onChange={(event) => updateTheme({ logoEmoji: event.target.value.slice(0, 4) })}
              className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm font-black text-foreground">
          Tagline
          <input
            value={uiTheme.tagline}
            onChange={(event) => updateTheme({ tagline: event.target.value })}
            className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm font-black text-foreground">
            Primary Color
            <input
              type="color"
              value={uiTheme.primaryColor}
              onChange={(event) => updateTheme({ primaryColor: event.target.value })}
              className="h-12 w-full rounded-2xl border border-white/70 bg-white/80 p-1 dark:border-white/10 dark:bg-white/10"
            />
          </label>
          <label className="space-y-1 text-sm font-black text-foreground">
            Secondary Color
            <input
              type="color"
              value={uiTheme.secondaryColor}
              onChange={(event) => updateTheme({ secondaryColor: event.target.value })}
              className="h-12 w-full rounded-2xl border border-white/70 bg-white/80 p-1 dark:border-white/10 dark:bg-white/10"
            />
          </label>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-black text-foreground">Background Preset</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyBackgroundPreset(preset.id)}
                className={`overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition-transform hover:scale-[1.02] ${uiTheme.backgroundPresetId === preset.id ? "border-primary" : "border-white/70 dark:border-white/10"
                  }`}
              >
                <div className="h-20" style={{ background: `linear-gradient(135deg, ${preset.start}, ${preset.middle}, ${preset.end})` }} />
                <p className="p-3 text-sm font-black text-foreground">{preset.label}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onResetTheme(DEFAULT_UI_THEME)}
          className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm font-black text-muted-foreground transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10"
        >
          <RefreshCcw size={16} /> Reset Theme
        </button>
      </div>

      <div className="booth-bg flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/70 p-6 text-center shadow-inner dark:border-white/10">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl shadow-2xl" style={{ background: `linear-gradient(135deg, ${uiTheme.primaryColor}, ${uiTheme.secondaryColor})` }}>
          {uiTheme.logoEmoji}
        </div>
        <h3 className="mt-4 text-4xl font-black text-foreground" style={{ fontFamily: "Pacifico, cursive" }}>
          {uiTheme.brandName}
        </h3>
        <p className="mt-2 max-w-xs text-sm font-bold text-muted-foreground">{uiTheme.tagline}</p>
      </div>
    </section>
  );
}
