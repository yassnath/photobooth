import { createHash, randomUUID } from "node:crypto";

function midtransBaseUrl(settings) {
  return settings.production ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

function midtransAuthorization(serverKey) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export async function createProviderPayment(config, payment, notificationUrl) {
  if (config.paymentProvider !== "midtrans") {
    return {
      provider: "mock",
      transactionId: `mock-${payment.orderId}`,
      qrString: `PIXIEBOOTH-MOCK|ORDER:${payment.orderId}|AMOUNT:${payment.amount}|NONCE:${randomUUID()}`,
      qrUrl: null,
      raw: { transaction_status: "pending", mock: true },
    };
  }

  if (!config.midtrans.serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi.");
  }

  const response = await fetch(`${midtransBaseUrl(config.midtrans)}/v2/charge`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: midtransAuthorization(config.midtrans.serverKey),
      ...(notificationUrl ? { "X-Override-Notification": notificationUrl } : {}),
    },
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: {
        order_id: payment.orderId,
        gross_amount: payment.amount,
      },
      item_details: [
        {
          id: "photobooth-session",
          price: payment.amount,
          quantity: 1,
          name: "Photobooth Session",
        },
      ],
      qris: { acquirer: config.midtrans.acquirer },
      custom_field1: payment.id,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.status_message || payload.message || `Midtrans HTTP ${response.status}`);
  }

  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const qrAction = actions.find((item) => item.name === "generate-qr-code-v2") || actions.find((item) => item.name === "generate-qr-code");
  return {
    provider: "midtrans",
    transactionId: payload.transaction_id || null,
    qrString: payload.qr_string || null,
    qrUrl: qrAction?.url || null,
    raw: payload,
  };
}

export function verifyMidtransWebhook(config, payload) {
  if (!config.midtrans.serverKey) return false;
  const source = `${payload.order_id || ""}${payload.status_code || ""}${payload.gross_amount || ""}${config.midtrans.serverKey}`;
  const signature = createHash("sha512").update(source).digest("hex");
  return signature === payload.signature_key;
}

export function normalizeMidtransStatus(payload) {
  const status = payload.transaction_status;
  const fraudAccepted = !payload.fraud_status || String(payload.fraud_status).toLowerCase() === "accept";
  if ((status === "settlement" || status === "capture") && fraudAccepted) return "paid";
  if (status === "expire") return "expired";
  if (status === "cancel" || status === "deny" || status === "failure") return "failed";
  return "pending";
}

export async function fetchMidtransStatus(config, orderId) {
  if (config.paymentProvider !== "midtrans" || !config.midtrans.serverKey) return null;
  const response = await fetch(`${midtransBaseUrl(config.midtrans)}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: "application/json", Authorization: midtransAuthorization(config.midtrans.serverKey) },
  });
  if (!response.ok) return null;
  return response.json();
}

export async function fetchMidtransQr(config, qrUrl) {
  const response = await fetch(qrUrl, {
    headers: config.midtrans.serverKey ? { Authorization: midtransAuthorization(config.midtrans.serverKey) } : {},
  });
  if (!response.ok) throw new Error(`QR Midtrans HTTP ${response.status}`);
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
  };
}
