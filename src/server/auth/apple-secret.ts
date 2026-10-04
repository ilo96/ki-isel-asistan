import { createPrivateKey, sign } from "node:crypto";

/*
 * Apple'ın "client secret"ı sabit bir şifre değil, Apple'dan indirilen .p8 anahtarıyla imzalanan
 * ve en fazla 6 ay geçerli bir JWT'dir. Elle üretip APPLE_CLIENT_SECRET'a yapıştırmak yerine
 * anahtarın kendisi verilirse sunucu bunu kendisi üretir; böylece 6 ayda bir süresi dolmaz.
 */

/** Apple'ın izin verdiği en uzun süre 6 aydır; biraz pay bırakılır. */
export const APPLE_SECRET_TTL_SECONDS = 60 * 60 * 24 * 170;

type AppleKey = {
  teamId: string;
  keyId: string;
  /** .p8 dosyasının içeriği. Ortam değişkeninde satır sonları "\n" olarak yazılabilir. */
  privateKey: string;
  /** Services ID (web için APPLE_CLIENT_ID). */
  clientId: string;
};

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function createAppleClientSecret(
  key: AppleKey,
  now = Math.floor(Date.now() / 1000),
): string {
  const header = { alg: "ES256", kid: key.keyId, typ: "JWT" };
  const payload = {
    iss: key.teamId,
    iat: now,
    exp: now + APPLE_SECRET_TTL_SECONDS,
    aud: "https://appleid.apple.com",
    sub: key.clientId,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const privateKey = createPrivateKey(key.privateKey.replace(/\\n/g, "\n"));
  // JWT, DER değil ham r||s imza bekler.
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}
