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

Ana sayfayı dolu görmek için boş ana sayfadaki **Örnek veriyle dene** düğmesi örnek gelir,
gider, bütçe ve hatırlatıcılar ekler (geliştirmede her zaman, production'da yalnızca
`DEMO_MODE=1` ile görünür). `/dev/components` sayfasından bu veriler temizlenebilir.

### Asistan

`ANTHROPIC_API_KEY` tanımlıysa asistan Claude ile çalışır (`AI_MODEL`, özetler için
`AI_FAST_MODEL`). Anahtar yoksa ya da Claude yanıt veremezse Türkçe kural tabanlı
çevrimdışı motor devreye girer; gider/gelir ekleme, hatırlatıcı, görev, bütçe, özet ve
bakiye komutlarını anlar. Anahtar yalnızca sunucuda kullanılır.

Araçlar `src/server/ai/tools.ts` içinde Zod şemalarıyla tanımlı. Okumalar hemen çalışır;
açık komutla verilen yazmalar hemen yapılır ve **Geri al** ile geri alınabilir; çıkarım
yapılan yazmalar, silmeler ve bütçe değişiklikleri önce onay kartı olarak gelir (15 dakika
geçerli). Her işlem `ai_actions` tablosunda saklanır.

### Bildirimler

Uygulama açılınca ve `/api/cron/notifications` (Bearer `CRON_SECRET`, `vercel.json` ile
15 dakikada bir) çağrıldığında fatura, hatırlatıcı, bütçe ve haftalık özet bildirimleri
üretilir; sessiz saatler ve günlük üst sınır Ayarlar'dan değişir. Web Push için
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` gerekir (`npx web-push generate-vapid-keys`).

### PWA

`src/app/manifest.ts` ve `public/sw.js` (yalnızca production'da kaydedilir) uygulamayı
ana ekrana eklenebilir yapar; bağlantı yokken `public/offline.html` gösterilir.

### Uçtan uca testler

```bash
pnpm build
BETTER_AUTH_SECRET=<32+ karakter> BETTER_AUTH_URL=http://localhost:3100 \
  LOCAL_DB=1 DEMO_MODE=1 AUTH_RATE_LIMIT=0 pnpm start -p 3100
BASE_URL=http://localhost:3100 pnpm e2e   # mobil (Pixel 7) ve masaüstü, axe erişilebilirlik dahil
```

`BASE_URL` verilmezse Playwright geliştirme sunucusunu kendisi açar. `LOCAL_DB`,
`DEMO_MODE` ve `AUTH_RATE_LIMIT=0` yalnızca önizleme ve testler içindir.

| Komut            | Ne yapar                         |
| ---------------- | -------------------------------- |
| `pnpm lint`      | ESLint                           |
| `pnpm typecheck` | TypeScript (strict)              |
| `pnpm test`      | Vitest birim testleri            |
| `pnpm build`     | Production derlemesi             |
| `pnpm e2e`       | Playwright uçtan uca testleri    |
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
