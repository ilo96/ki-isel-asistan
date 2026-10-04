"use client";

import { Download, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { APP_NAME } from "@/config/brand";
import type { CurrencyCode } from "@/lib/money";
import type { MonthlyRecap } from "@/lib/recap";
import { drawRecap } from "./draw-recap";
import { recapStrings } from "./recap-text";

/**
 * Spotify Wrapped tarzı aylık karne. Ekrandaki kart ile paylaşılan görsel aynı metni
 * taşır; tutarlar varsayılan olarak gizlidir (paylaşınca harcaman herkese görünmesin).
 */
export function RecapView({ recap, currency }: { recap: MonthlyRecap; currency: CurrencyCode }) {
  const t = useTranslations("recap");
  const toast = useToast();
  const [showAmounts, setShowAmounts] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = useMemo(
    () => recapStrings(recap, { showAmounts, currency, t: (k, v) => t(k, v) }),
    [recap, showAmounts, currency, t],
  );
  const title = recap.partial
    ? t("titlePartial", { month: recap.label })
    : t("title", { month: recap.label });

  const image = () =>
    drawRecap(s, {
      title: recap.label,
      emoji: recap.persona.emoji,
      appName: APP_NAME,
      footer: t("footer", { app: APP_NAME }),
    });

  const share = async () => {
    setBusy(true);
    try {
      const blob = await image();
      const file = new File([blob], `${APP_NAME.toLowerCase()}-${recap.monthKey}.png`, {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: t("shareText", { month: recap.label, app: APP_NAME }),
        });
      } else {
        download(blob, file.name);
        toast({ message: t("downloaded") });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        toast({ message: t("shareFailed"), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      download(await image(), `${APP_NAME.toLowerCase()}-${recap.monthKey}.png`);
    } catch {
      toast({ message: t("shareFailed"), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
      <article
        aria-label={title}
        className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-sheet p-6 text-white shadow-raised"
        style={{ background: "linear-gradient(160deg, #2a1f7a, #6d5df6 50%, #1d8fc4)" }}
      >
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[#a26bf5]/50 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full bg-[#5ec8f2]/35 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="flex justify-between text-caption text-white/80">
            <span className="font-semibold">{APP_NAME}</span>
            <span className="first-letter:uppercase">{recap.label}</span>
          </div>
          <p className="mt-6 text-[56px] leading-none" aria-hidden>
            {recap.persona.emoji}
          </p>
          <h2 className="mt-3 text-[28px] leading-tight font-bold">{s.personaTitle}</h2>
          <p className="text-small text-white/85">{s.personaBody}</p>

          <p className="mt-6 text-[34px] leading-tight font-extrabold tabular-nums">{s.headline}</p>
          {s.headlineSub && <p className="text-small text-white/90">{s.headlineSub}</p>}

          {s.categories.length > 0 && (
            <ul className="mt-5 space-y-3 rounded-[20px] bg-white/12 p-4">
              {s.categories.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between gap-2 text-small">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {c.amount ? `${c.amount} · ` : ""}%{Math.round(c.share * 100)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${Math.max(4, c.share * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3">
            {s.stats.map((st) => (
              <div key={st.label} className="rounded-[18px] bg-white/12 p-3.5">
                <dd className="text-h2 font-extrabold tabular-nums">{st.value}</dd>
                <dt className="text-caption text-white/85">{st.label}</dt>
              </div>
            ))}
          </dl>
          {s.biggest && <p className="mt-4 text-small text-white/90">{s.biggest}</p>}
          <p className="mt-6 text-center text-caption text-white/70">
            {t("footer", { app: APP_NAME })}
          </p>
        </div>
      </article>

      <div className="space-y-4">
        <div className="rounded-card bg-surface p-5 shadow-card">
          <h2 className="text-h2 text-text">{t("shareTitle")}</h2>
          <p className="mt-1 text-small text-muted">{t("shareBody")}</p>
          <div className="mt-2">
            <Switch
              label={t("showAmounts")}
              description={t("showAmountsBody")}
              checked={showAmounts}
              onCheckedChange={setShowAmounts}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={share} loading={busy}>
              <Share2 aria-hidden />
              {t("share")}
            </Button>
            <Button variant="secondary" onClick={save} disabled={busy}>
              <Download aria-hidden />
              {t("download")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
