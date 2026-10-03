"use client";

import { Plus, ReceiptText, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AssistantOrb, type OrbState } from "@/components/assistant/assistant-orb";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  ["bg", "bg-bg"],
  ["surface", "bg-surface"],
  ["surface-raised", "bg-surface-raised"],
  ["border", "bg-border"],
  ["text", "bg-text"],
  ["text-muted", "bg-muted"],
  ["accent", "bg-accent"],
  ["positive", "bg-positive"],
  ["negative", "bg-negative"],
  ["warning", "bg-warning"],
  ["ai-gradient", "ai-gradient"],
] as const;

const TYPE_SCALE = [
  ["Display", "text-display", "₺48.250"],
  ["H1", "text-h1", "İyi akşamlar"],
  ["H2", "text-h2", "Yaklaşanlar"],
  ["Body", "text-body", "Bu ay harcamaların geçen aya göre %8 daha düşük."],
  ["Small", "text-small", "Market · Bugün 14:20"],
  ["Caption", "text-caption", "EKİ 03"],
] as const;

const ORB_STATES: readonly OrbState[] = ["idle", "thinking", "done", "error"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardTitle className="mb-5">{title}</CardTitle>
      {children}
    </Card>
  );
}

export function Showcase() {
  const [sheet, setSheet] = useState(false);
  const [seg, setSeg] = useState<"week" | "month" | "6m">("month");
  const [doneKey, setDoneKey] = useState(0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Tema">
        <ThemeToggle withLabels />
      </Section>

      <Section title="Renkler">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {COLORS.map(([name, cls]) => (
            <div key={name}>
              <div className={`h-12 rounded-input border border-border ${cls}`} />
              <p className="mt-1.5 text-caption text-muted">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografi">
        <div className="space-y-3">
          {TYPE_SCALE.map(([name, cls, sample]) => (
            <div key={name} className="flex items-baseline gap-4">
              <span className="w-16 shrink-0 text-caption text-muted">{name}</span>
              <span className={`${cls} money truncate`}>{sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Asistan küresi">
        <div className="flex flex-wrap items-end gap-8">
          {ORB_STATES.map((state) => (
            <div key={state} className="flex flex-col items-center gap-2">
              <AssistantOrb key={state === "done" ? doneKey : state} state={state} size="lg" />
              <span className="text-caption text-muted">{state}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => setDoneKey((k) => k + 1)}>
          Tamamlandı animasyonunu tekrarla
        </Button>
      </Section>

      <Section title="Butonlar">
        <div className="flex flex-wrap gap-3">
          <Button>
            <Plus aria-hidden />
            Gider ekle
          </Button>
          <Button variant="secondary">İptal</Button>
          <Button variant="soft">
            <Sparkles aria-hidden />
            Asistana sor
          </Button>
          <Button variant="ghost">Atla</Button>
          <Button variant="danger">Sil</Button>
          <Button loading>Kaydediliyor</Button>
          <Button variant="secondary" disabled>
            Pasif
          </Button>
        </div>
      </Section>

      <Section title="Rozetler ve tutarlar">
        <div className="flex flex-wrap gap-2">
          <Badge>Diğer</Badge>
          <Badge tone="accent">AI</Badge>
          <Badge tone="positive">Gelir</Badge>
          <Badge tone="negative">Gider</Badge>
          <Badge tone="warning">%85 kullanıldı</Badge>
        </div>
        <div className="mt-5 space-y-2 text-h2">
          <div className="flex justify-between">
            <span className="text-body text-muted">Maaş</span>
            <Amount minor={4_500_000} kind="income" compact />
          </div>
          <div className="flex justify-between">
            <span className="text-body text-muted">Kira</span>
            <Amount minor={2_500_000} kind="expense" compact />
          </div>
          <div className="flex justify-between">
            <span className="text-body text-muted">Bakiye (sayma animasyonu)</span>
            <Amount minor={4_825_090} animated />
          </div>
        </div>
      </Section>

      <Section title="Bütçe çubukları">
        <div className="space-y-5">
          {[
            ["Ulaşım", 0.42],
            ["Market", 0.85],
            ["Eğlence", 1.08],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="mb-2 flex justify-between text-small">
                <span>{label}</span>
                <span className="money text-muted">%{Math.round((value as number) * 100)}</span>
              </div>
              <Progress value={value as number} label={label as string} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Girdi ve seçici">
        <div className="space-y-4">
          <Input placeholder="Açıklama" />
          <Input placeholder="Hatalı alan" aria-invalid defaultValue="abc" />
          <SegmentedControl
            label="Zaman aralığı"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "week", label: "Hafta" },
              { value: "month", label: "Ay" },
              { value: "6m", label: "Son 6 ay" },
            ]}
          />
          <div>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Sheet’i aç
            </Button>
            <Sheet open={sheet} onOpenChange={setSheet} title="Örnek sheet" description="Mobilde alttan, geniş ekranda ortadan açılır." closeLabel="Kapat">
              <p className="text-body text-muted">İçerik burada.</p>
            </Sheet>
          </div>
        </div>
      </Section>

      <Section title="Yükleniyor (skeleton)">
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Boş durum">
        <EmptyState
          icon={ReceiptText}
          title="Henüz gider yok"
          description="İlk giderini ekle, harcamalarını anlamaya başlayalım."
          action={<Button>Gider ekle</Button>}
          hint="Ya da yaz: “Bugün 350 TL yemek harcadım”"
          className="py-4"
        />
      </Section>

      <Section title="Hata durumu">
        <ErrorState
          title="Bir şeyler ters gitti"
          description="Bu bölümü şu an yükleyemedik."
          retryLabel="Tekrar dene"
          onRetry={() => undefined}
        />
      </Section>
    </div>
  );
}
