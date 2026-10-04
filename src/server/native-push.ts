import "server-only";
import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

/*
 * Mağaza uygulamasına bildirim: Android'e Firebase Cloud Messaging (HTTP v1), iOS'a doğrudan
 * Apple Push Notification service (HTTP/2). Ek kütüphane yok; iki servis de kısa ömürlü,
 * kendi imzaladığımız JWT ile yetkilendirilir ve belirteçler bellekte önbelleklenir.
 */

export type NativeMessage = { title: string; body: string; href: string; tag?: string };
/** "gone": belirteç artık geçersiz (uygulama silinmiş); bir daha denenmemeli. */
export type SendResult = "ok" | "gone" | "error";

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const pem = (key: string) => createPrivateKey(key.replace(/\\n/g, "\n"));

function jwt(alg: "RS256" | "ES256", header: Record<string, string>, payload: object, key: string) {
  const input = `${base64url(JSON.stringify({ alg, typ: "JWT", ...header }))}.${base64url(JSON.stringify(payload))}`;
  const signature = sign("sha256", Buffer.from(input), {
    key: pem(key),
    ...(alg === "ES256" ? { dsaEncoding: "ieee-p1363" as const } : {}),
  });
  return `${input}.${base64url(signature)}`;
}

/* ------------------------------------------------------------ Android (FCM) */

export type FcmAccount = { project_id: string; client_email: string; private_key: string };

let fcmToken: { value: string; expiresAt: number } | undefined;

async function fcmAccessToken(account: FcmAccount) {
  if (fcmToken && fcmToken.expiresAt > Date.now() + 60_000) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt(
    "RS256",
    {},
    {
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    account.private_key,
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`FCM yetkisi alınamadı: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return fcmToken.value;
}

export function fcmPayload(token: string, m: NativeMessage) {
  return {
    message: {
      token,
      notification: { title: m.title, body: m.body },
      data: { href: m.href },
      android: { priority: "HIGH", notification: { tag: m.tag, channel_id: "default" } },
    },
  };
}

export async function sendFcm(account: FcmAccount, token: string, m: NativeMessage): Promise<SendResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${await fcmAccessToken(account)}`, "content-type": "application/json" },
    body: JSON.stringify(fcmPayload(token, m)),
  });
  if (res.ok) return "ok";
  const text = await res.text();
  if (res.status === 404 || text.includes("UNREGISTERED")) return "gone";
  console.error("FCM bildirimi gönderilemedi", res.status);
  return "error";
}

/* ------------------------------------------------------------ iOS (APNs) */

export type ApnsKey = { teamId: string; keyId: string; privateKey: string; bundleId: string; sandbox: boolean };

let apnsJwt: { value: string; issuedAt: number; keyId: string } | undefined;

/** Apple 20-60 dakika arası yenilenmesini ister. */
function apnsAuth(key: ApnsKey) {
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt && apnsJwt.keyId === key.keyId && now - apnsJwt.issuedAt < 40 * 60) return apnsJwt.value;
  apnsJwt = { value: jwt("ES256", { kid: key.keyId }, { iss: key.teamId, iat: now }, key.privateKey), issuedAt: now, keyId: key.keyId };
  return apnsJwt.value;
}

export function apnsPayload(m: NativeMessage) {
  return { aps: { alert: { title: m.title, body: m.body }, sound: "default" }, href: m.href };
}

export function sendApns(key: ApnsKey, token: string, m: NativeMessage): Promise<SendResult> {
  const host = key.sandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  return new Promise((resolve) => {
    const client = connect(host);
    const done = (result: SendResult) => {
      client.close();
      resolve(result);
    };
    client.on("error", (error) => {
      console.error("APNs bağlantısı kurulamadı", error.message);
      done("error");
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsAuth(key)}`,
      "apns-topic": key.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
      ...(m.tag ? { "apns-collapse-id": m.tag.slice(0, 64) } : {}),
      "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      if (status === 200) return done("ok");
      if (status === 410 || body.includes("BadDeviceToken") || body.includes("Unregistered")) return done("gone");
      console.error("APNs bildirimi gönderilemedi", status, body);
      done("error");
    });
    req.on("error", () => done("error"));
    req.end(JSON.stringify(apnsPayload(m)));
  });
}
