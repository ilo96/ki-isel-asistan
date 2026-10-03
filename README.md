# Asistan

Kişisel AI asistanı + kişisel finans uygulaması. Mimari ve UI/UX planı:
[plan dokümanı](https://claude.ai/code/artifact/3b2c6c31-1486-4135-95fb-f7c0adc0829a).

## Çalıştırma

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Yerelde hiçbir hesap veya anahtar gerekmez: `DATABASE_URL` tanımlı değilse veriler
`.data/pglite` klasöründeki gömülü Postgres'te tutulur (migration'lar açılışta uygulanır),
şifre sıfırlama bağlantıları sunucu konsoluna yazılır. Production için gereken değişkenler
`.env.example` içinde.

İşlem ekleme ekranı gelene kadar ana sayfayı dolu görmek için, boş ana sayfadaki
**Örnek veriyle dene** düğmesi (yalnızca geliştirmede görünür) örnek gelir, gider, bütçe ve
hatırlatıcılar ekler. `/dev/components` sayfasından bu veriler temizlenebilir.

| Komut            | Ne yapar                         |
| ---------------- | -------------------------------- |
| `pnpm lint`      | ESLint                           |
| `pnpm typecheck` | TypeScript (strict)              |
| `pnpm test`      | Vitest birim testleri            |
| `pnpm build`     | Production derlemesi             |
| `pnpm db:generate` | Şemadan yeni migration üretir  |
| `pnpm db:migrate`  | Migration'ları `DATABASE_URL`'deki veritabanına uygular |

## Yapı

```
src/
  app/              route'lar; (auth) giriş akışı, onboarding, (app) oturum gerektiren kabuk
  components/
    ui/             primitives (Button, Card, Sheet, Skeleton, EmptyState …)
    layout/         sidebar, alt bar, üst bar, komut paleti, hızlı ekle
    assistant/      asistan küresi
  features/         ekranlara özel parçalar (dashboard, tasks, assistant …)
  lib/              para (kuruş), hareket sabitleri, form şemaları (Zod), auth istemcisi
  server/           yalnızca sunucu: db (Drizzle şeması), auth (Better Auth), services
drizzle/            SQL migration'ları
  styles/tokens.css light/dark design token'ları
messages/tr.json    arayüz metinleri (next-intl)
```

Kurallar:

- Componentler hex renk kullanmaz; yalnızca `src/styles/tokens.css` içindeki token'lar (`bg-surface`, `text-muted`, `text-positive` …).
- Para her yerde kuruş cinsinden tam sayıdır; ekrana `formatMoney` / `<Amount>` ile yazılır.
- Animasyon süreleri ve eğrileri `src/lib/motion.ts` içinde; `prefers-reduced-motion` otomatik desteklenir.
- Tüm metinler `messages/tr.json` içinde.
- Oturum gereken sayfa ve action'lar kullanıcıyı `requireUser()` / `getSession()` ile sunucuda alır; `src/middleware.ts` yalnızca çerez yoksa erken yönlendirir.

Tasarım sistemi önizlemesi: `/dev/components`.
