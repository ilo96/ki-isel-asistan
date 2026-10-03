# Asistan

Kişisel AI asistanı + kişisel finans uygulaması. Mimari ve UI/UX planı:
[plan dokümanı](https://claude.ai/code/artifact/3b2c6c31-1486-4135-95fb-f7c0adc0829a).

## Çalıştırma

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

| Komut            | Ne yapar                         |
| ---------------- | -------------------------------- |
| `pnpm lint`      | ESLint                           |
| `pnpm typecheck` | TypeScript (strict)              |
| `pnpm test`      | Vitest birim testleri            |
| `pnpm build`     | Production derlemesi             |

## Yapı

```
src/
  app/              route'lar; (app) grubu uygulama kabuğunu kullanır
  components/
    ui/             primitives (Button, Card, Sheet, Skeleton, EmptyState …)
    layout/         sidebar, alt bar, üst bar, komut paleti, hızlı ekle
    assistant/      asistan küresi
  features/         ekranlara özel parçalar (dashboard, tasks, assistant …)
  lib/              para (kuruş), hareket sabitleri, yardımcılar
  styles/tokens.css light/dark design token'ları
messages/tr.json    arayüz metinleri (next-intl)
```

Kurallar:

- Componentler hex renk kullanmaz; yalnızca `src/styles/tokens.css` içindeki token'lar (`bg-surface`, `text-muted`, `text-positive` …).
- Para her yerde kuruş cinsinden tam sayıdır; ekrana `formatMoney` / `<Amount>` ile yazılır.
- Animasyon süreleri ve eğrileri `src/lib/motion.ts` içinde; `prefers-reduced-motion` otomatik desteklenir.
- Tüm metinler `messages/tr.json` içinde.

Tasarım sistemi önizlemesi: `/dev/components`.
