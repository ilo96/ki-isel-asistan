import "server-only";
import { APP_NAME } from "@/config/brand";
import { env } from "@/server/env";

type Email = { to: string; subject: string; text: string };

/**
 * E-posta gönderimi. RESEND_API_KEY tanımlıysa Resend API'si kullanılır;
 * değilse (yalnızca geliştirmede) içerik sunucu konsoluna yazılır.
 */
export async function sendEmail({ to, subject, text }: Email): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY) {
    console.info(`\n[e-posta] Kime: ${to}\nKonu: ${subject}\n\n${text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`,
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) throw new Error(`E-posta gönderilemedi (${res.status})`);
}
