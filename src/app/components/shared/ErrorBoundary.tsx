import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional context label shown in error UI (e.g. "Kiosk" or "Admin") */
  context?: string;
  /** If provided, renders as the fallback instead of default UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors anywhere in the subtree and shows a
 * recovery UI instead of a blank screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in all envs; extend here to send to Sentry/LogRocket
    console.error(`[ErrorBoundary:${this.props.context ?? "App"}] Uncaught render error:`, error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    const { children, fallback, context } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);

      return (
        <div className="booth-bg grid min-h-[100dvh] place-items-center px-6">
          <div className="max-w-sm rounded-3xl border border-white/60 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-white/10">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-500 text-3xl dark:bg-red-950/60">
              ⚠️
            </div>
            <h1 className="mb-2 text-lg font-black text-foreground">
              {context ? `${context} — ` : ""}Terjadi Kesalahan
            </h1>
            <p className="mb-1 text-sm text-muted-foreground">
              Aplikasi mengalami error yang tidak terduga.
            </p>
            <p className="mb-6 rounded-xl bg-red-50 px-3 py-2 text-xs font-mono text-red-600 dark:bg-red-950/40 dark:text-red-400 line-clamp-3">
              {error.message}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={this.reset}
                className="w-full rounded-2xl bg-primary py-3 text-sm font-black text-primary-foreground shadow-md transition-transform hover:scale-[1.02] active:scale-95"
              >
                Coba Lagi
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-2xl border border-white/60 bg-white/50 py-3 text-sm font-black text-foreground transition-transform hover:scale-[1.02] active:scale-95 dark:border-white/10 dark:bg-white/10"
              >
                Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
