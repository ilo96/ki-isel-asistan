"use client";

import type { RecapStrings } from "./recap-text";

/*
 * Paylaşılabilir görsel: 1080×1920 (Instagram hikâyesi) tuval çizimi. Kütüphane yok;
 * yazı tipi sayfada yüklü olanla aynıdır, Türkçe karakterler sorunsuz çıkar.
 */

const W = 1080;
const H = 1920;
const PAD = 88;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export async function drawRecap(
  s: RecapStrings,
  {
    title,
    emoji,
    appName,
    footer,
  }: { title: string; emoji: string; appName: string; footer: string },
): Promise<Blob> {
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = (weight: number, size: number) => (ctx.font = `${weight} ${size}px ${family}`);

  // Zemin: uygulamanın AI gradyanı + yumuşak ışık lekeleri.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#2a1f7a");
  bg.addColorStop(0.5, "#6d5df6");
  bg.addColorStop(1, "#1d8fc4");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [
    [900, 260, 420, "rgba(162,107,245,0.55)"],
    [120, 1500, 520, "rgba(94,200,242,0.35)"],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  let y = PAD + 40;
  font(600, 40);
  ctx.globalAlpha = 0.85;
  ctx.fillText(appName, PAD, y);
  ctx.textAlign = "right";
  ctx.fillText(title, W - PAD, y);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;

  // Persona
  y += 190;
  font(400, 150);
  ctx.fillText(emoji, PAD, y);
  y += 110;
  font(700, 84);
  ctx.fillText(fit(ctx, s.personaTitle, W - PAD * 2), PAD, y);
  y += 64;
  font(400, 40);
  ctx.globalAlpha = 0.85;
  ctx.fillText(fit(ctx, s.personaBody, W - PAD * 2), PAD, y);
  ctx.globalAlpha = 1;

  // Başlık rakamı
  y += 150;
  font(800, 96);
  ctx.fillText(fit(ctx, s.headline, W - PAD * 2), PAD, y);
  if (s.headlineSub) {
    y += 62;
    font(500, 42);
    ctx.globalAlpha = 0.9;
    ctx.fillText(s.headlineSub, PAD, y);
    ctx.globalAlpha = 1;
  }

  // Kategoriler
  if (s.categories.length) {
    y += 90;
    const boxH = 70 + s.categories.length * 110;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, PAD - 24, y - 60, W - PAD * 2 + 48, boxH, 40);
    ctx.fill();
    for (const c of s.categories) {
      ctx.fillStyle = "#fff";
      font(600, 40);
      ctx.fillText(fit(ctx, c.name, 560), PAD, y);
      ctx.textAlign = "right";
      font(500, 40);
      ctx.fillText(
        c.amount ? `${c.amount} · %${Math.round(c.share * 100)}` : `%${Math.round(c.share * 100)}`,
        W - PAD,
        y,
      );
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      roundRect(ctx, PAD, y + 22, W - PAD * 2, 18, 9);
      ctx.fill();
      ctx.fillStyle = "#fff";
      roundRect(ctx, PAD, y + 22, Math.max(18, (W - PAD * 2) * c.share), 18, 9);
      ctx.fill();
      y += 110;
    }
  }

  // İstatistik kutuları (2×2)
  y += 40;
  const cellW = (W - PAD * 2 - 32) / 2;
  s.stats.forEach((st, i) => {
    const cx = PAD + (i % 2) * (cellW + 32);
    const cy = y + Math.floor(i / 2) * 220;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, cx, cy, cellW, 190, 36);
    ctx.fill();
    ctx.fillStyle = "#fff";
    font(800, 64);
    ctx.fillText(fit(ctx, st.value, cellW - 64), cx + 36, cy + 96);
    font(500, 34);
    ctx.globalAlpha = 0.85;
    ctx.fillText(fit(ctx, st.label, cellW - 64), cx + 36, cy + 150);
    ctx.globalAlpha = 1;
  });
  y += Math.ceil(s.stats.length / 2) * 220;

  if (s.biggest) {
    y += 40;
    font(500, 38);
    ctx.globalAlpha = 0.9;
    ctx.fillText(fit(ctx, s.biggest, W - PAD * 2), PAD, y);
    ctx.globalAlpha = 1;
  }

  font(500, 34);
  ctx.globalAlpha = 0.75;
  ctx.textAlign = "center";
  ctx.fillText(footer, W / 2, H - PAD);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Görsel üretilemedi"))), "image/png"),
  );
}
