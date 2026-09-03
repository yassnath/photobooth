import { useCallback, useEffect, useRef, useState } from "react";

import type { CameraDevice, CameraStatus, FacingMode } from "../types/photobooth";

const CAMERA_DEVICE_STORAGE_KEY = "pixiebooth.preferred-camera-device";
const externalCameraPattern = /\b(usb|external|webcam|logitech|brio|c9\d\d|obsbot|elgato|cam link|capture|sony|canon|nikon|fujifilm|droidcam|ivcam)\b/i;
const integratedCameraPattern = /\b(integrated|built.?in|facetime|front|user facing|hd user facing)\b/i;
const virtualCameraPattern = /\b(virtual|obs virtual|snap camera|xsplit|manycam)\b/i;

interface StartCameraOptions {
  deviceId?: string;
  facingMode?: FacingMode;
}

interface CaptureFrameOptions {
  filter?: string;
  mirror?: boolean;
}

function toCameraDevice(device: MediaDeviceInfo, index: number): CameraDevice {
  return {
    deviceId: device.deviceId,
    groupId: device.groupId,
    label: device.label || `Camera ${index + 1}`,
  };
}

function readStoredDeviceId() {
  try {
    return localStorage.getItem(CAMERA_DEVICE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function rememberDeviceId(deviceId: string) {
  try {
    if (deviceId) localStorage.setItem(CAMERA_DEVICE_STORAGE_KEY, deviceId);
  } catch {
    // Some kiosk policies and private modes disable localStorage writes.
  }
}

function cameraScore(device: CameraDevice, preferredDeviceId: string, index: number) {
  let score = 100 - index;
  const label = device.label || "";

  if (device.deviceId && device.deviceId === preferredDeviceId) score += 35;
  if (externalCameraPattern.test(label)) score += 80;
  if (integratedCameraPattern.test(label)) score += 20;
  if (virtualCameraPattern.test(label)) score -= 120;
  if (label) score += 5;

  return score;
}

function choosePreferredCamera(devices: CameraDevice[], preferredDeviceId = "") {
  const usableDevices = devices.filter((device) => Boolean(device.deviceId));
  if (usableDevices.length === 0) return null;

  return [...usableDevices].sort(
    (left, right) =>
      cameraScore(right, preferredDeviceId, devices.indexOf(right)) -
      cameraScore(left, preferredDeviceId, devices.indexOf(left)),
  )[0];
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera permission is blocked. Allow camera access in your browser, then try again.";
    }

    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "No matching camera was found. Plug in a camera or choose another device.";
    }

    if (error.name === "NotReadableError") {
      return "The selected camera is already in use by another app.";
    }
  }

  return "Camera could not be started. Try another camera or refresh the device list.";
}

export function useCameraStream() {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const didAutoStartRef = useRef(false);
  const isAutoSwitchingRef = useRef(false);
  const manualDeviceSelectionRef = useRef(false);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [activeFacingMode, setActiveFacingMode] = useState<FacingMode | undefined>();
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }
  }, []);

  const videoRef = useCallback((element: HTMLVideoElement | null) => {
    videoElementRef.current = element;

    if (element && streamRef.current) {
      element.srcObject = streamRef.current;
      void element.play().catch(() => {
        // Some browsers wait for a user gesture even after permission succeeds.
      });
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return [];
    }

    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    const cameraDevices = mediaDevices.filter((device) => device.kind === "videoinput").map(toCameraDevice);
    setDevices(cameraDevices);

    return cameraDevices;
  }, []);

  const bindStream = useCallback(
    async (stream: MediaStream) => {
      streamRef.current = stream;
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setStatus("blocked");
          setError("Camera disconnected. Reconnecting to the best available camera...");
          void refreshDevices();
        };
      });

      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
        try {
          await videoElementRef.current.play();
        } catch {
          // Some browsers require a gesture, but the stream is still bound.
        }
      }

      const [track] = stream.getVideoTracks();
      const settings = track?.getSettings();
      const deviceId = settings?.deviceId || "";
      const trackFacingMode = settings?.facingMode === "environment" ? "environment" : settings?.facingMode === "user" ? "user" : undefined;

      if (deviceId) {
        setSelectedDeviceId(deviceId);
        if (!manualDeviceSelectionRef.current) rememberDeviceId(deviceId);
      }

      setActiveFacingMode(trackFacingMode);
      setStatus("ready");
      setError(null);
      await refreshDevices();
    },
    [refreshDevices],
  );

  const startCamera = useCallback(
    async (options: StartCameraOptions = {}) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        setError("Camera access is not supported in this browser or origin. Use HTTPS or localhost.");
        return false;
      }

      setStatus("requesting");
      setError(null);
      stopStream();

      const preferredFacingMode = options.facingMode ?? facingMode;
      const knownDevices = await refreshDevices().catch(() => []);
      const preferredDevice = options.deviceId
        ? null
        : choosePreferredCamera(knownDevices, readStoredDeviceId());
      const baseVideoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      };

      const preferredConstraints: MediaStreamConstraints = {
        audio: false,
        video: (options.deviceId || preferredDevice?.deviceId)
          ? { ...baseVideoConstraints, deviceId: { exact: options.deviceId || preferredDevice?.deviceId } }
          : { ...baseVideoConstraints, facingMode: { ideal: preferredFacingMode } },
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
        await bindStream(stream);
        return true;
      } catch (firstError) {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: baseVideoConstraints,
          });
          await bindStream(fallbackStream);
          return true;
        } catch {
          setStatus("blocked");
          setError(cameraErrorMessage(firstError));
          await refreshDevices();
          return false;
        }
      }
    },
    [bindStream, facingMode, refreshDevices, stopStream],
  );

  const selectDevice = useCallback(
    async (deviceId: string) => {
      manualDeviceSelectionRef.current = true;
      setSelectedDeviceId(deviceId);
      rememberDeviceId(deviceId);
      await startCamera({ deviceId });
    },
    [startCamera],
  );

  const switchCamera = useCallback(async () => {
    const cameraDevices = devices.length > 0 ? devices : await refreshDevices();

    if (cameraDevices.length > 1 && selectedDeviceId) {
      const currentIndex = cameraDevices.findIndex((device) => device.deviceId === selectedDeviceId);
      const nextDevice = cameraDevices[(currentIndex + 1 + cameraDevices.length) % cameraDevices.length];
      manualDeviceSelectionRef.current = true;
      await selectDevice(nextDevice.deviceId);
      return;
    }

    const nextFacingMode: FacingMode = facingMode === "user" ? "environment" : "user";
    manualDeviceSelectionRef.current = true;
    setFacingMode(nextFacingMode);
    await startCamera({ facingMode: nextFacingMode });
  }, [devices, facingMode, refreshDevices, selectDevice, selectedDeviceId, startCamera]);

  const captureFrame = useCallback(({ filter, mirror = false }: CaptureFrameOptions = {}) => {
    const video = videoElementRef.current;

    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.filter = filter || "none";

    if (mirror) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    if (!didAutoStartRef.current) {
      didAutoStartRef.current = true;
      void startCamera();
    }

    return () => stopStream();
  }, []);

  useEffect(() => {
    if (manualDeviceSelectionRef.current || isAutoSwitchingRef.current || status === "requesting") {
      return undefined;
    }

    const preferred = choosePreferredCamera(devices, readStoredDeviceId());
    if (!preferred?.deviceId) {
      return undefined;
    }

    const selectedStillAvailable = !selectedDeviceId || devices.some((device) => device.deviceId === selectedDeviceId);
    const shouldSwitchToPreferred = preferred.deviceId !== selectedDeviceId && status === "ready";
    const shouldReconnect = status === "idle" || status === "blocked" || !selectedStillAvailable;

    if (!shouldSwitchToPreferred && !shouldReconnect) {
      return undefined;
    }

    isAutoSwitchingRef.current = true;
    void startCamera({ deviceId: preferred.deviceId }).finally(() => {
      isAutoSwitchingRef.current = false;
    });

    return undefined;
  }, [devices, selectedDeviceId, startCamera, status]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) {
      return undefined;
    }

    const handleDeviceChange = () => {
      void refreshDevices().then((nextDevices) => {
        if (selectedDeviceId && !nextDevices.some((device) => device.deviceId === selectedDeviceId)) {
          manualDeviceSelectionRef.current = false;
          setSelectedDeviceId("");
        }
      });
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, [refreshDevices]);

  return {
    videoRef,
    devices,
    selectedDeviceId,
    facingMode,
    activeFacingMode,
    status,
    error,
    refreshDevices,
    startCamera,
    selectDevice,
    switchCamera,
    captureFrame,
  };
}
