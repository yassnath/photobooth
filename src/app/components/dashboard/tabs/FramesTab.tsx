import { Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import type { FrameCategory, FrameLayout, FrameTemplate } from "../../../types/photobooth";
import { TEMPLATES } from "../../../data/photobooth";
import { ChromaImage } from "../ChromaImage";
import { frameCategories, getFrameResolutionLabel } from "../DashboardUtils";

interface FramesTabProps {
  frames: FrameTemplate[];
  frameDraft: FrameTemplate;
  setFrameDraft: React.Dispatch<React.SetStateAction<FrameTemplate>>;
  frameFormRef: React.RefObject<HTMLDivElement | null>;
  loadFrameOverlay: (file?: File) => void;
  scanAndLockSlots: () => void;
  saveFrame: () => void;
  onUpdateFrames: React.Dispatch<React.SetStateAction<FrameTemplate[]>>;
  onOpenDeleteFrameModal: (id: string, label: string) => void;
}

export function FramesTab({
  frames,
  frameDraft,
  setFrameDraft,
  frameFormRef,
  loadFrameOverlay,
  scanAndLockSlots,
  saveFrame,
  onUpdateFrames,
  onOpenDeleteFrameModal,
}: FramesTabProps) {
  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <div ref={frameFormRef} className="rounded-3xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/10 scroll-mt-6">
            <h2 className="text-lg font-black text-foreground">Frame Studio</h2>

            <div className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="font-black text-amber-950 dark:text-amber-100">📐 Panduan Ukuran & Format PNG Frame:</div>
              <ul className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] font-bold">
                <li>• <strong>1x1</strong>: 600 x 800 px (Rasio 3:4)</li>
                <li>• <strong>1x2</strong>: 600 x 1200 px (Rasio 1:2)</li>
                <li>• <strong>1x3 Strip</strong>: 600 x 1800 px (Rasio 1:3)</li>
                <li>• <strong>1x4 Strip</strong>: 600 x 1800 px (Rasio 1:3)</li>
              </ul>
              <p className="mt-2 text-[10.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                💡 <strong>Greenscreen Autocut:</strong> Isi slot tempat foto pada gambar PNG dengan warna hijau murni (<code className="rounded bg-green-200 px-1 font-mono font-bold text-green-900">#00FF00</code>). Sistem akan otomatis mendeteksi dan menghapus area hijau agar foto berada tepat di belakang frame!
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-black text-foreground">
                Frame Name
                <input
                  value={frameDraft.label}
                  onChange={(event) => setFrameDraft((current) => ({ ...current, label: event.target.value }))}
                  className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                />
              </label>
              <label className="space-y-1 text-sm font-black text-foreground">
                Category
                <select
                  value={frameDraft.category}
                  onChange={(event) => setFrameDraft((current) => ({ ...current, category: event.target.value as FrameCategory }))}
                  className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                >
                  {frameCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-black text-foreground">
                Target Layout
                <select
                  value={frameDraft.layout || "all"}
                  onChange={(event) => setFrameDraft((current) => ({ ...current, layout: event.target.value as FrameLayout | "all" }))}
                  className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                >
                  <option value="all">Semua Layout (Responsif)</option>
                  <option value="1x1">1x1 (Ratio 3:4 — 600 x 800 px)</option>
                  <option value="1x2">1x2 (Ratio 1:2 — 600 x 1200 px)</option>
                  <option value="1x3">1x3 Strip (Ratio 1:3 — 600 x 1800 px)</option>
                  <option value="1x4">1x4 Strip 4 Pose (Ratio 1:3 — 600 x 1800 px)</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-black text-foreground">
                Emoji
                <input
                  value={frameDraft.emoji}
                  onChange={(event) => setFrameDraft((current) => ({ ...current, emoji: event.target.value.slice(0, 4) }))}
                  className="w-full rounded-2xl border border-white bg-white/85 px-4 py-3 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                />
              </label>
              <label className="space-y-1 text-sm font-black text-foreground">
                Overlay PNG
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => loadFrameOverlay(event.target.files?.[0])}
                  className="w-full rounded-2xl border border-white bg-white/85 px-4 py-2 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/10"
                />
              </label>
              <label className="space-y-1 text-sm font-black text-foreground">
                Background
                <input
                  type="color"
                  value={frameDraft.color}
                  onChange={(event) => setFrameDraft((current) => ({ ...current, color: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-white bg-white/85 p-1 dark:border-white/10 dark:bg-white/10"
                />
              </label>
              <label className="space-y-1 text-sm font-black text-foreground md:col-span-2">
                Border / Accent Color
                <input
                  type="color"
                  value={frameDraft.accent}
                  onChange={(event) => setFrameDraft((current) => ({ ...current, accent: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-white bg-white/85 p-1 dark:border-white/10 dark:bg-white/10"
                />
              </label>
              <div className="md:col-span-2 space-y-2 rounded-2xl border border-white/60 bg-white/50 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-xs font-black text-foreground block">🎯 Lock Koordinat Slot Greenscreen</span>
                    <span className="text-[11px] text-muted-foreground">Kunci posisi & ukuran area greenscreen agar foto ditempatkan dengan presisi 100%.</span>
                  </div>
                  <button
                    type="button"
                    onClick={scanAndLockSlots}
                    className="w-full shrink-0 rounded-xl bg-pink-500 px-3 py-2 text-xs font-black text-white shadow-xs transition-colors hover:bg-pink-600 sm:w-auto sm:py-1.5"
                  >
                    🎯 Scan & Lock Otomatis
                  </button>
                </div>

                {frameDraft.slots && frameDraft.slots.length > 0 ? (
                  <div className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
                    {frameDraft.slots.map((slot, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-2 rounded-xl border border-black/5 bg-white/80 p-2 text-[11px] font-mono font-bold dark:bg-white/10 sm:grid-cols-[4.5rem_repeat(4,minmax(4.25rem,1fr))] sm:items-center">
                        <span className="col-span-2 font-black text-pink-600 dark:text-pink-400 sm:col-span-1">Slot #{idx + 1}</span>
                        <label className="min-w-0 flex items-center gap-1">
                          <span>X:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={slot.x}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setFrameDraft((curr) => {
                                const newSlots = [...(curr.slots || [])];
                                if (newSlots[idx]) newSlots[idx] = { ...newSlots[idx], x: val };
                                return { ...curr, slots: newSlots };
                              });
                            }}
                            className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs dark:border-white/20 dark:bg-black/30"
                          />
                          <span>%</span>
                        </label>
                        <label className="min-w-0 flex items-center gap-1">
                          <span>Y:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={slot.y}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setFrameDraft((curr) => {
                                const newSlots = [...(curr.slots || [])];
                                if (newSlots[idx]) newSlots[idx] = { ...newSlots[idx], y: val };
                                return { ...curr, slots: newSlots };
                              });
                            }}
                            className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs dark:border-white/20 dark:bg-black/30"
                          />
                          <span>%</span>
                        </label>
                        <label className="min-w-0 flex items-center gap-1">
                          <span>W:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={slot.w}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setFrameDraft((curr) => {
                                const newSlots = [...(curr.slots || [])];
                                if (newSlots[idx]) newSlots[idx] = { ...newSlots[idx], w: val };
                                return { ...curr, slots: newSlots };
                              });
                            }}
                            className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs dark:border-white/20 dark:bg-black/30"
                          />
                          <span>%</span>
                        </label>
                        <label className="min-w-0 flex items-center gap-1">
                          <span>H:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={slot.h}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setFrameDraft((curr) => {
                                const newSlots = [...(curr.slots || [])];
                                if (newSlots[idx]) newSlots[idx] = { ...newSlots[idx], h: val };
                                return { ...curr, slots: newSlots };
                              });
                            }}
                            className="w-14 rounded-md border border-gray-300 px-1 py-0.5 text-center text-xs dark:border-white/20 dark:bg-black/30"
                          />
                          <span>%</span>
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                    ⚠️ Belum ada slot terkunci. Klik "Scan & Lock Otomatis" atau unggah overlay PNG.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs font-black text-foreground md:col-span-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={frameDraft.chromaKeyGreen !== false}
                  onChange={(event) => setFrameDraft((current) => ({ ...current, chromaKeyGreen: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>🟢 Deteksi Greenscreen Otomatis (Hapus warna hijau pada PNG agar foto kelihatan)</span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={saveFrame} className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-md">
                <Plus size={16} /> Save Frame
              </button>
              <button onClick={() => onUpdateFrames(TEMPLATES)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-muted-foreground">
                <RefreshCcw size={16} /> Reset ke Default
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/10">
            <div className="text-center mb-2">
              <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Preview Frame Realtime</span>
            </div>
            <div
              className={`relative flex items-center justify-center overflow-hidden rounded-none text-5xl shadow-2xl transition-all border border-black/10 ${frameDraft.layout === "1x2"
                ? "w-48 aspect-[1/2]"
                : frameDraft.layout === "1x3" || frameDraft.layout === "1x4"
                  ? "w-40 aspect-[1/3]"
                  : "w-60 aspect-[3/4]"
                }`}
              style={{ backgroundColor: frameDraft.color }}
            >
              {frameDraft.slots && frameDraft.slots.length > 0 ? (
                frameDraft.slots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="absolute border-2 border-dashed border-pink-500 bg-pink-400/25 text-[9px] font-black text-pink-800 dark:text-pink-200 flex items-center justify-center pointer-events-none z-10 shadow-xs"
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.w}%`,
                      height: `${slot.h}%`,
                    }}
                  >
                    Slot #{idx + 1}
                  </div>
                ))
              ) : (
                <div className="absolute inset-[10%] flex flex-col gap-2">
                  <span className="min-h-0 flex-1 rounded-lg bg-white/80 border border-black/10 shadow-xs" />
                  <span className="min-h-0 flex-1 rounded-lg bg-white/80 border border-black/10 shadow-xs" />
                </div>
              )}
              <span className="relative z-10 text-4xl">{frameDraft.emoji}</span>
              {frameDraft.overlayImage && (
                <ChromaImage src={frameDraft.overlayImage} alt="" className="absolute inset-0 h-full w-full object-fill z-20 pointer-events-none" />
              )}
            </div>
            {frameDraft.slots && frameDraft.slots.length > 0 && (
              <p className="mt-3 text-center text-xs font-black text-pink-600 dark:text-pink-400">
                🎯 {frameDraft.slots.length} Slot Greenscreen Terkunci Presisi (100% Ratio)
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-white/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black text-foreground">Tabel Kelola Frame Template</h2>
            <p className="text-xs text-muted-foreground">Ubah detail, resolusi ukuran, target layout, dan status greenscreen secara fleksibel.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-black text-primary">
            {frames.length} Frame Tersimpan
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 2xl:hidden">
          {frames.map((frame) => (
            <article key={frame.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
              <div className="flex items-start gap-3">
                <div
                  className="relative flex aspect-[3/4] w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xl shadow-sm"
                  style={{ backgroundColor: frame.color, border: `2px solid ${frame.accent}` }}
                >
                  <span>{frame.emoji}</span>
                  {frame.overlayImage && <ChromaImage src={frame.overlayImage} alt="" className="absolute inset-0 h-full w-full object-cover pointer-events-none" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-black text-foreground">{frame.label}</p>
                    <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-[10px] font-black text-pink-700 dark:bg-pink-950/50 dark:text-pink-300">{frame.category}</span>
                  </div>
                  <p className="mt-1 break-all font-mono text-[10px] font-bold text-muted-foreground">{frame.id}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><p className="font-black uppercase text-muted-foreground">Target Layout</p><p className="mt-1 font-mono font-black text-primary">{frame.layout || "all"}</p></div>
                <div><p className="font-black uppercase text-muted-foreground">Ukuran</p><p className="mt-1 font-bold text-foreground">{getFrameResolutionLabel(frame.layout || "all")}</p></div>
                <div><p className="font-black uppercase text-muted-foreground">Greenscreen</p><p className="mt-1 font-bold text-foreground">{frame.chromaKeyGreen !== false ? "Auto Cut" : "Overlay Plain"}</p></div>
                <div><p className="font-black uppercase text-muted-foreground">Slot</p><p className="mt-1 font-bold text-foreground">{frame.slots?.length || 0} slot</p></div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/60 pt-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setFrameDraft(frame);
                    frameFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/75 px-3 text-xs font-black text-primary shadow-sm dark:bg-white/10"
                >
                  <Pencil size={15} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDeleteFrameModal(frame.id, frame.label)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-600 shadow-sm dark:bg-rose-950/40"
                >
                  <Trash2 size={15} /> Hapus
                </button>
              </div>
            </article>
          ))}
          {frames.length === 0 && <p className="col-span-full rounded-2xl bg-white/70 p-5 text-sm font-bold text-muted-foreground">Belum ada frame tersimpan.</p>}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-white/80 shadow-sm dark:border-white/10 2xl:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/80 dark:bg-white/5 font-black text-muted-foreground uppercase text-[10.5px] border-b border-white/60 dark:border-white/10">
              <tr>
                <th className="px-4 py-3">Preview</th>
                <th className="px-4 py-3">Nama Frame & Emoji</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Target Layout</th>
                <th className="px-4 py-3">Rekomendasi Ukuran</th>
                <th className="px-4 py-3">Greenscreen</th>
                <th className="px-4 py-3 text-right">Aksi Edit / Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/60 dark:divide-white/10 font-bold text-foreground">
              {frames.map((frame) => (
                <tr key={frame.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div
                      className="relative flex aspect-[3/4] w-11 items-center justify-center overflow-hidden rounded-md text-lg shadow-sm"
                      style={{ backgroundColor: frame.color, border: `2px solid ${frame.accent}` }}
                    >
                      <span>{frame.emoji}</span>
                      {frame.overlayImage && <ChromaImage src={frame.overlayImage} alt="" className="absolute inset-0 h-full w-full object-cover pointer-events-none" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-black text-sm block">{frame.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{frame.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 px-2.5 py-0.5 text-[11px] font-black">
                      {frame.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-primary">
                    {frame.layout || "all"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[11px]">
                    {getFrameResolutionLabel(frame.layout || "all")}
                  </td>
                  <td className="px-4 py-3">
                    {frame.chromaKeyGreen !== false ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[10.5px] font-black">
                        🟢 Auto Cut
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/10 text-muted-foreground px-2.5 py-0.5 text-[10.5px] font-bold">
                        ⚪ Overlay Plain
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => {
                        setFrameDraft(frame);
                        if (frameFormRef.current) {
                          frameFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                        } else {
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                      className="rounded-xl bg-white dark:bg-white/10 px-3 py-1.5 text-xs font-black text-primary hover:bg-primary hover:text-white transition-all shadow-xs"
                    >
                      <Pencil size={13} className="inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => onOpenDeleteFrameModal(frame.id, frame.label)}
                      className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                      aria-label={`Hapus ${frame.label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
