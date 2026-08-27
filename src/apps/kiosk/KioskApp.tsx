import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";

import { ProgressBar } from "../../app/components/shared/ProgressBar";
import { DEFAULT_EDITOR_STATE, DEFAULT_UI_THEME, FILTERS, SESSION_DURATION_MS, TEMPLATES } from "../../app/data/photobooth";
import { useLocalStorageState } from "../../app/hooks/useLocalStorageState";
import { CameraScreen } from "../../app/screens/CameraScreen";
import { ConsentScreen } from "../../app/screens/ConsentScreen";
import { EditorScreen } from "../../app/screens/EditorScreen";
import { GalleryScreen } from "../../app/screens/GalleryScreen";
import { GoodbyeScreen } from "../../app/screens/GoodbyeScreen";
import { ModeSelectorScreen } from "../../app/screens/ModeSelectorScreen";
import { PaymentScreen } from "../../app/screens/PaymentScreen";
import { PrintScreen } from "../../app/screens/PrintScreen";
import { ResultScreen } from "../../app/screens/ResultScreen";
import { ShareScreen } from "../../app/screens/ShareScreen";
import { TemplateSelectorScreen } from "../../app/screens/TemplateSelectorScreen";
import { WelcomeScreen } from "../../app/screens/WelcomeScreen";
import type { BoothThemeSettings, CaptureMode, ConsentSettings, EditorState, FilterPreset, FrameLayout, PaymentRecord, PhotoSession, ResultFormat, Screen, TemplateOption } from "../../app/types/photobooth";
import { photoboothApi } from "../../shared/api/client";
import { reportKioskState } from "../../shared/agent/client";
import { cleanupLocalBackups, clearKioskRecovery, loadKioskRecovery, saveKioskRecovery, saveLocalSessionBackup } from "../../shared/storage/localPhotoBackup";

interface KioskRecoverySnapshot {
  screen: Screen;
  mode: CaptureMode;
  frameLayout: FrameLayout;
  templateId: string;
  photos: string[];
  editor: EditorState;
  payment: PaymentRecord | null;
  consent: ConsentSettings | null;
  sessionEndsAt: number | null;
  currentSessionId: string | null;
}

const recoverableScreens: Screen[] = ["consent", "template", "camera", "editor", "result", "gallery", "print"];

function createDefaultEditorState(): EditorState {
  return {
    ...DEFAULT_EDITOR_STATE,
    stickers: [...DEFAULT_EDITOR_STATE.stickers],
    adjustments: { ...DEFAULT_EDITOR_STATE.adjustments },
  };
}

export function KioskApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [frameLayout, setFrameLayout] = useState<FrameLayout>("1x1");
  const [templateId, setTemplateId] = useState("han-river");
  const [photos, setPhotos] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditorState>(() => createDefaultEditorState());
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [consent, setConsent] = useState<ConsentSettings | null>(null);
  const [sessionEndsAt, setSessionEndsAt] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionPrice, setSessionPrice] = useState(25_000);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [uiTheme, setUiTheme] = useLocalStorageState<BoothThemeSettings>("pixiebooth.ui-theme", DEFAULT_UI_THEME);
  const [filters, setFilters] = useLocalStorageState<FilterPreset[]>("pixiebooth.filters", FILTERS);
  const [frames, setFrames] = useLocalStorageState<TemplateOption[]>("pixiebooth.frames", TEMPLATES);

  const goTo = (nextScreen: Screen) => setScreen(nextScreen);
  const resultFormat: ResultFormat = mode === "gif" ? "gif" : mode === "live" ? "live" : "photo";
  const openDashboard = () => window.location.assign("/admin");
  const rootStyle = {
    minHeight: "100dvh",
    overflow: "hidden",
    "--booth-bg-start": uiTheme.background.start,
    "--booth-bg-middle": uiTheme.background.middle,
    "--booth-bg-end": uiTheme.background.end,
    "--booth-primary": uiTheme.primaryColor,
    "--booth-secondary": uiTheme.secondaryColor,
    "--primary": uiTheme.primaryColor,
    "--ring": uiTheme.primaryColor,
  } as CSSProperties;

  const restart = () => {
    void clearKioskRecovery();
    setPhotos([]);
    setEditor(createDefaultEditorState());
    setPayment(null);
    setConsent(null);
    setMode("photo");
    setFrameLayout("1x1");
    setSessionEndsAt(null);
    setCurrentSessionId(null);
    setSessionError("");
    goTo("welcome");
  };

  const retake = () => {
    setPhotos([]);
    setEditor(createDefaultEditorState());
    goTo("camera");
  };

  const saveSession = async (nextEditor: EditorState) => {
    setSessionError("");
    const sessionId = currentSessionId || globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
    const now = new Date().toISOString();
    const nextSession: PhotoSession = {
      id: sessionId,
      createdAt: now,
      mode,
      templateId,
      frameLayout,
      resultFormat,
      payment: payment || undefined,
      consent: consent || undefined,
      photos,
      editor: nextEditor,
    };

    await saveLocalSessionBackup(nextSession);
    await photoboothApi.savePhotoSession(nextSession);
    setCurrentSessionId(sessionId);
    return sessionId;
  };

  useEffect(() => {
    const restore = async () => {
      try {
        const snapshot = await loadKioskRecovery<KioskRecoverySnapshot>();
        const timerValid = !snapshot?.sessionEndsAt || snapshot.sessionEndsAt > Date.now();
        if (snapshot?.payment && recoverableScreens.includes(snapshot.screen) && timerValid) {
          setMode(snapshot.mode);
          setFrameLayout(snapshot.frameLayout);
          setTemplateId(snapshot.templateId);
          setPhotos(snapshot.photos);
          setEditor(snapshot.editor);
          setPayment(snapshot.payment);
          setConsent(snapshot.consent);
          setSessionEndsAt(snapshot.sessionEndsAt);
          setCurrentSessionId(snapshot.currentSessionId);
          setScreen(snapshot.screen);
        } else if (snapshot) {
          await clearKioskRecovery();
        }
      } catch {
        await clearKioskRecovery().catch(() => undefined);
      } finally {
        setRecoveryReady(true);
      }
    };
    void restore();
  }, []);

  useEffect(() => {
    void cleanupLocalBackups();
    void photoboothApi.getConfig().then((runtime) => {
      if (runtime.theme) setUiTheme(runtime.theme);
      if (runtime.filters) setFilters(runtime.filters);
      if (runtime.frames) setFrames(runtime.frames);
      setSessionPrice(runtime.sessionPrice);
    }).catch(() => undefined);
  }, [setFilters, setFrames, setUiTheme]);

  useEffect(() => {
    if (!recoveryReady) return;
    if (!payment || screen === "welcome" || screen === "goodbye") {
      if (screen === "goodbye") void clearKioskRecovery();
      return;
    }
    const snapshot: KioskRecoverySnapshot = {
      screen,
      mode,
      frameLayout,
      templateId,
      photos,
      editor,
      payment,
      consent,
      sessionEndsAt,
      currentSessionId,
    };
    void saveKioskRecovery(snapshot).catch(() => undefined);
  }, [consent, currentSessionId, editor, frameLayout, mode, payment, photos, recoveryReady, screen, sessionEndsAt, templateId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    void reportKioskState(screen, screen !== "welcome" && screen !== "goodbye").catch(() => undefined);
  }, [screen]);

  useEffect(() => {
    if (!sessionEndsAt) return undefined;
    const remaining = sessionEndsAt - Date.now();
    const expireSession = () => {
      setPhotos([]);
      setEditor(createDefaultEditorState());
      setPayment(null);
      setConsent(null);
      setCurrentSessionId(null);
      setSessionEndsAt(null);
      setScreen("welcome");
      void clearKioskRecovery();
    };

    if (remaining <= 0) {
      expireSession();
      return undefined;
    }

    const timer = window.setTimeout(expireSession, remaining);
    return () => window.clearTimeout(timer);
  }, [sessionEndsAt]);

  if (!recoveryReady) {
    return <div className="booth-bg grid min-h-[100dvh] place-items-center text-sm font-black text-primary">Memulihkan booth...</div>;
  }

  return (
    <div className={isDark ? "dark" : ""} style={rootStyle}>
      <ProgressBar screen={screen} />
      <AnimatePresence mode="wait">
        {screen === "welcome" && (
          <WelcomeScreen
            key="welcome"
            isDark={isDark}
            uiTheme={uiTheme}
            onStart={() => goTo("mode")}
            onDashboard={openDashboard}
            onToggleDark={() => setIsDark((value) => !value)}
          />
        )}

        {screen === "mode" && (
          <ModeSelectorScreen
            key="mode"
            initialMode={mode}
            onBack={restart}
            onSelect={(selectedMode) => {
              setMode(selectedMode);
              setPhotos([]);
              setEditor(createDefaultEditorState());
              setSessionEndsAt(null);
              goTo("payment");
            }}
          />
        )}

        {screen === "payment" && (
          <PaymentScreen
            key="payment"
            uiTheme={uiTheme}
            amount={sessionPrice}
            onBack={() => goTo("mode")}
            onPaid={(nextPayment) => {
              setSessionError("");
              setPayment(nextPayment);
              setConsent(null);
              setPhotos([]);
              setEditor(createDefaultEditorState());
              setCurrentSessionId(null);
              setSessionEndsAt(null);
              goTo("consent");
            }}
          />
        )}

        {screen === "consent" && payment && (
          <ConsentScreen
            key="consent"
            sessionEndsAt={sessionEndsAt}
            onBack={() => goTo("payment")}
            onContinue={(nextConsent) => {
              setConsent(nextConsent);
              goTo("template");
            }}
          />
        )}

        {screen === "consent" && !payment && (
          <PaymentScreen key="consent-payment" uiTheme={uiTheme} amount={sessionPrice} onBack={restart} onPaid={(nextPayment) => {
            setPayment(nextPayment);
          }} />
        )}

        {screen === "template" && (
          <TemplateSelectorScreen
            key="template"
            templates={frames}
            sessionEndsAt={sessionEndsAt}
            onBack={() => goTo("consent")}
            onSelect={(selectedTemplate, selectedLayout) => {
              setTemplateId(selectedTemplate);
              setFrameLayout(selectedLayout);
              setSessionEndsAt((current) => current || Date.now() + SESSION_DURATION_MS);
              goTo("camera");
            }}
          />
        )}

        {screen === "camera" && sessionEndsAt && (
          <CameraScreen
            key="camera"
            frameLayout={frameLayout}
            sessionEndsAt={sessionEndsAt}
            templateId={templateId}
            frames={frames}
            onBack={() => goTo("template")}
            onComplete={(capturedPhotos) => {
              setPhotos(capturedPhotos);
              setEditor(createDefaultEditorState());
              setCurrentSessionId(null);
              goTo("editor");
            }}
          />
        )}

        {screen === "editor" && sessionEndsAt && (
          <EditorScreen
            key="editor"
            photos={photos}
            mode={mode}
            frameLayout={frameLayout}
            sessionEndsAt={sessionEndsAt}
            templateId={templateId}
            initialEditor={editor}
            filters={filters}
            frames={frames}
            brandName={uiTheme.brandName}
            onBack={() => goTo("camera")}
            onContinue={async (nextEditor) => {
              setEditor(nextEditor);
              try {
                await saveSession(nextEditor);
                goTo("result");
              } catch (saveError) {
                console.error("Session could not be persisted:", saveError);
                setSessionError(saveError instanceof Error ? saveError.message : "Sesi tidak dapat disimpan ke server.");
              }
            }}
          />
        )}

        {screen === "result" && sessionEndsAt && (
          <ResultScreen
            key="result"
            photos={photos}
            mode={mode}
            frameLayout={frameLayout}
            sessionEndsAt={sessionEndsAt}
            sessionId={currentSessionId || "current-session"}
            templateId={templateId}
            editor={editor}
            format={resultFormat}
            filters={filters}
            frames={frames}
            brandName={uiTheme.brandName}
            onRetake={retake}
            onEdit={() => goTo("editor")}
            onPrint={() => goTo("print")}
            onGallery={() => goTo("gallery")}
            onFinish={() => goTo("goodbye")}
          />
        )}

        {screen === "share" && <ShareScreen key="share" onBack={() => goTo("result")} onGoodbye={() => goTo("goodbye")} />}

        {screen === "gallery" && <GalleryScreen key="gallery" photos={photos} onBack={() => goTo("result")} />}

        {screen === "print" && (
          <PrintScreen
            key="print"
            photos={photos}
            mode={mode}
            frameLayout={frameLayout}
            templateId={templateId}
            editor={editor}
            filters={filters}
            frames={frames}
            brandName={uiTheme.brandName}
            onBack={() => goTo("result")}
          />
        )}

        {screen === "goodbye" && <GoodbyeScreen key="goodbye" onRestart={restart} />}
      </AnimatePresence>
      {sessionError && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-[80] flex w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 items-center justify-between gap-3 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-xl">
          <span>{sessionError}</span>
          <button type="button" onClick={() => setSessionError("")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15" aria-label="Tutup pesan">×</button>
        </div>
      )}
    </div>
  );
}
