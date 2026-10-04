"use client";

import type { TransactionDraft } from "@/lib/finance/draft";

export type ReceiptError =
  | "unauthorized"
  | "not_configured"
  | "invalid"
  | "too_large"
  | "rate_limited"
  | "not_receipt"
  | "unknown";

const MAX_SIDE = 1600;

/** Telefon fotoğrafları 5–10 MB olur; okunaklılığı bozmadan ~300 KB JPEG'e küçültülür. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}

export async function scanReceipt(
  file: File,
): Promise<{ ok: true; draft: TransactionDraft } | { ok: false; error: ReceiptError }> {
  try {
    const body = new FormData();
    const image = await shrink(file);
    body.append("image", image, "receipt.jpg");
    const response = await fetch("/api/capture/receipt", { method: "POST", body });
    const data = (await response.json().catch(() => null)) as
      { ok: true; draft: TransactionDraft } | { ok: false; error: ReceiptError } | null;
    return data ?? { ok: false, error: "unknown" };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
