import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, LogIn, UserRound } from "lucide-react";
import { motion } from "motion/react";

import type { BoothThemeSettings } from "../types/photobooth";

interface LoginScreenProps {
  uiTheme: BoothThemeSettings;
  onBack: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
}

export function LoginScreen({ uiTheme, onBack, onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login admin gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="relative min-h-[100dvh] overflow-y-auto px-4 py-5 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.35 }}
    >
      <div className="booth-bg absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/70 text-foreground shadow-sm backdrop-blur-sm transition-transform hover:scale-105 dark:border-white/10 dark:bg-white/10"
            aria-label="Back to app"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-black text-foreground">{uiTheme.logoEmoji} {uiTheme.brandName}</p>
            <p className="truncate text-xs font-semibold text-muted-foreground">Admin dashboard</p>
          </div>
        </header>

        <main className="grid flex-1 items-center gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:py-8">
          <section className="hidden min-w-0 lg:block">
            <p className="text-sm font-black uppercase tracking-wide text-primary">Protected access</p>
            <h1 className="mt-3 max-w-xl text-5xl font-black leading-tight text-foreground" style={{ fontFamily: "Pacifico, cursive" }}>
              {uiTheme.logoEmoji} {uiTheme.brandName} Dashboard
            </h1>
            <p className="mt-4 max-w-lg text-base font-semibold leading-7 text-muted-foreground">
              Kelola tema booth, hasil foto, filter, dan frame dari satu ruang admin yang konsisten dengan tampilan aplikasi.
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {["Theme", "Photos", "Filters"].map((label) => (
                <div key={label} className="rounded-2xl border border-white/60 bg-white/55 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/10">
                  <p className="text-sm font-black text-foreground">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            className="mx-auto w-full max-w-md rounded-3xl border border-white/70 bg-white/75 p-5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/10 sm:p-6"
          >
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <LockKeyhole size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-foreground">Login Admin</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Masuk untuk membuka dashboard.</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-foreground">Username</span>
              <span className="relative block">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError("");
                  }}
                  autoComplete="username"
                  className="h-12 w-full rounded-2xl border border-white/70 bg-white/85 pl-11 pr-4 text-sm font-bold text-foreground outline-none ring-primary/30 transition focus:ring-4 dark:border-white/10 dark:bg-white/10"
                  placeholder="admin"
                />
              </span>
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-foreground">Password</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-12 w-full rounded-2xl border border-white/70 bg-white/85 pl-11 pr-12 text-sm font-bold text-foreground outline-none ring-primary/30 transition focus:ring-4 dark:border-white/10 dark:bg-white/10"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {error && (
              <p role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-500 px-5 text-sm font-black text-white shadow-xl shadow-pink-400/30 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn size={18} />
              {submitting ? "Memverifikasi..." : "Masuk Dashboard"}
            </button>

            <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">Session admin diamankan oleh server dan cookie HTTP-only.</p>
          </form>
        </main>
      </div>
    </motion.div>
  );
}
