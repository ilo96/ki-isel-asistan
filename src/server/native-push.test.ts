import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apnsPayload, fcmPayload, sendFcm } from "./native-push";

const message = { title: "Fatura yaklaşıyor", body: "Elektrik faturası yarın.", href: "/finance", tag: "bill:1" };

describe("mağaza uygulaması bildirimleri", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("iOS yükünde dokununca açılacak sayfa yer alır", () => {
    expect(apnsPayload(message)).toEqual({
      aps: { alert: { title: message.title, body: message.body }, sound: "default" },
      href: "/finance",
    });
  });

  it("Android yükü varsayılan kanala, yüksek öncelikle gider", () => {
    const p = fcmPayload("tok", message).message;
    expect(p.token).toBe("tok");
    expect(p.data).toEqual({ href: "/finance" });
    expect(p.android).toEqual({ priority: "HIGH", notification: { tag: "bill:1", channel_id: "default" } });
  });

  it("FCM'e imzalı yetkiyle gönderir, silinmiş cihazı 'gone' sayar", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const account = {
      project_id: "vantrel-test",
      client_email: "push@vantrel-test.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("oauth2")) return Response.json({ access_token: "erisim", expires_in: 3600 });
        if (calls.length === 2) return new Response("{}", { status: 200 });
        return new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: 404 });
      }),
    );

    expect(await sendFcm(account, "cihaz-1", message)).toBe("ok");
    const assertion = new URLSearchParams(String(calls[0]!.init.body)).get("assertion")!;
    const [h, p, s] = assertion.split(".");
    expect(verify("sha256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s!, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(p!, "base64url").toString())).toMatchObject({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    });
    expect(calls[1]!.url).toBe("https://fcm.googleapis.com/v1/projects/vantrel-test/messages:send");
    expect((calls[1]!.init.headers as Record<string, string>).authorization).toBe("Bearer erisim");

    // Erişim belirteci önbellekten gelir; ikinci gönderimde yeniden yetki istenmez.
    expect(await sendFcm(account, "cihaz-2", message)).toBe("gone");
    expect(calls.filter((c) => c.url.includes("oauth2"))).toHaveLength(1);
  });
});
