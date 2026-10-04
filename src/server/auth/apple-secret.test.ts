import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { APPLE_SECRET_TTL_SECONDS, createAppleClientSecret } from "./apple-secret";

describe("Apple client secret", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("Apple'ın beklediği alanlarla ES256 imzalı bir JWT üretir", () => {
    const now = 1_800_000_000;
    // Ortam değişkenindeki gibi satır sonları kaçışlı verilir.
    const jwt = createAppleClientSecret(
      {
        teamId: "TEAM123456",
        keyId: "KEY1234567",
        clientId: "app.ornek.web",
        privateKey: pem.replace(/\n/g, "\\n"),
      },
      now,
    );
    const [h, p, s] = jwt.split(".");
    const header = JSON.parse(Buffer.from(h!, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString());

    expect(header).toEqual({ alg: "ES256", kid: "KEY1234567", typ: "JWT" });
    expect(payload).toEqual({
      iss: "TEAM123456",
      iat: now,
      exp: now + APPLE_SECRET_TTL_SECONDS,
      aud: "https://appleid.apple.com",
      sub: "app.ornek.web",
    });
    expect(APPLE_SECRET_TTL_SECONDS).toBeLessThanOrEqual(15_777_000);
    const ok = verify(
      "sha256",
      Buffer.from(`${h}.${p}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(s!, "base64url"),
    );
    expect(ok).toBe(true);
  });
});
