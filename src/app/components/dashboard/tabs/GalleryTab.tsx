import type { PhotoSession } from "../../../types/photobooth";
import { formatDate } from "../DashboardUtils";

interface GalleryTabProps {
  sessions: PhotoSession[];
  allPhotos: Array<{ id: string; photo: string; session: PhotoSession }>;
  onSelectPhoto: (photo: string) => void;
}

export function GalleryTab({ allPhotos, onSelectPhoto }: GalleryTabProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground">Galeri Hasil Foto</h2>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{allPhotos.length} foto tersimpan</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {allPhotos.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectPhoto(item.photo)}
            className="overflow-hidden rounded-2xl border border-white/70 bg-white text-left shadow-sm transition-transform hover:scale-[1.02] dark:border-white/10 dark:bg-white/10"
          >
            <img src={item.photo} alt="Captured result" className="h-48 w-full object-cover" />
            <div className="p-3">
              <p className="text-sm font-black text-foreground">{item.session.frameLayout || (item.session.mode === "strip" ? "1x4" : "1x1")} · {item.session.resultFormat || "photo"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.session.createdAt)}</p>
            </div>
          </button>
        ))}
      </div>

      {allPhotos.length === 0 && (
        <p className="rounded-2xl bg-white/70 p-5 text-sm font-bold text-muted-foreground dark:bg-white/10">
          Belum ada hasil foto.
        </p>
      )}
    </section>
  );
}
