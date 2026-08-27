const agentBaseUrl = (import.meta.env.VITE_PRINTER_AGENT_URL || "http://127.0.0.1:4175").replace(/\/+$/, "");

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File cetak tidak dapat dibaca."));
    reader.readAsDataURL(blob);
  });
}

async function agentRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${agentBaseUrl}${path}`, {
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Printer agent tidak dapat memproses permintaan.");
  return payload as T;
}

export async function sendPrintJob(blob: Blob, copies: number, format: string) {
  const dataUrl = await blobToDataUrl(blob);
  return agentRequest<{ job: { id: string; status: string }; mode: string }>("/print", {
    method: "POST",
    body: JSON.stringify({ dataUrl, copies, format }),
  });
}

export function reportKioskState(kioskScreen: string, activeSession: boolean) {
  return agentRequest<{ ok: true }>("/device-state", {
    method: "POST",
    body: JSON.stringify({ kioskScreen, activeSession }),
  });
}

export function getPrinterAgentStatus() {
  return agentRequest<{ printer: { available: boolean; name: string; mode: string }; queueLength: number }>("/status");
}
