# Vantrel mobil uygulaması (Android ve iOS)

Vantrel şimdilik yalnızca mağaza uygulaması olarak yayınlanır. Herkese açık bir web uygulaması
yoktur; `vantrelcode.com` yalnızca indirme bağlantılarının olduğu tanıtım sayfasıdır.

## Nasıl çalışıyor

```
Telefon (Android / iOS uygulaması, Capacitor)
   │  ekranlar, kamera, mikrofon, bildirim, Apple/Google girişi
   ▼
https://app.vantrelcode.com  (bu Next.js uygulaması: ekranlar + API + AI + veritabanı)
   │
   ├── Neon (Postgres)          ├── Anthropic (asistan, fiş okuma)
   ├── Resend (şifre e-postası) └── FCM / APNs (bildirimler)

https://vantrelcode.com  (landing/ klasörü: tanıtım, gizlilik, hesap silme sayfaları)
```

- Uygulama, Capacitor ile yapılmış yerel bir kabuktur; ekranları `app.vantrelcode.com`'dan açar.
  Böylece yazılmış her ekran aynen kullanılır, ekran güncellemeleri mağaza onayı beklemeden
  yayına girer. Yalnızca yerel kabuk değişirse (yeni izin, yeni eklenti, ikon) mağazaya yeni
  sürüm gönderilir.
- Sunucu `APP_ONLY=1` ile çalışır: tarayıcıdan açılan sayfalar `vantrelcode.com`'a yönlenir.
  Kabuk her isteğe `VantrelApp/1` işareti ekler (`capacitor.config.ts`). Tek istisna e-postadaki
  şifre sıfırlama bağlantısıdır.
- Uygulamaya özel davranışlar:

| Özellik          | Uygulamada                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Bildirimler      | Telefonun kendi bildirimleri (Android: FCM, iOS: APNs)             |
| Google ile giriş | Telefonun Google penceresi (her iki sistemde)                     |
| Apple ile giriş  | iPhone'da yerel Apple penceresi; Android'de Apple'ın web sayfası  |
| Sesle ekleme     | Telefonun konuşma tanıması                                        |
| Fiş fotoğrafı    | Kamera ya da galeri                                               |
| Verileri indir   | Paylaşım menüsü (Dosyalar'a kaydet, e-postayla gönder…)            |
| Geri tuşu        | Android'de bir önceki sayfa, en başta uygulamadan çıkış           |
| Widget sayfası   | Gizli (tarayıcıya özel geçici çözümdü)                           |
| PWA / servis çalışanı | Kapalı                                                       |

## Klasörler

| Yol                    | Ne                                                            |
| ---------------------- | ------------------------------------------------------------- |
| `capacitor.config.ts`  | Uygulama kimliği `com.vantrelcode.app`, sunucu adresi, eklentiler |
| `android/`, `ios/`     | Yerel projeler (Android Studio / Xcode ile açılır)            |
| `assets/`              | İkon ve açılış ekranı kaynakları                              |
| `mobile/www/`          | Bağlantı yokken gösterilen yerel sayfa                        |
| `src/lib/native/`      | Yerel eklentilerin web tarafı                                 |
| `src/server/native-push.ts` | FCM ve APNs gönderimi                                    |
| `landing/`             | vantrelcode.com statik sitesi                                 |

## Geliştirme

```bash
pnpm install
pnpm mobile:sync                  # eklenti/izin değişince yerel projeleri günceller
pnpm mobile:android               # Android Studio'da açar
pnpm mobile:ios                   # Xcode'da açar (yalnızca Mac)

# Emülatörde yerel sunucuyu denemek için (pnpm dev açıkken):
VANTREL_APP_URL=http://10.0.2.2:3000 pnpm mobile:sync    # Android emülatörü
VANTREL_APP_URL=http://localhost:3000 pnpm mobile:sync   # iOS simülatörü
```

İkonlar `assets/` içinden üretilir: `npx @capacitor/assets generate --android --ios`.

## Yayına alma: yapılacaklar

### 1. Hesaplar (ilo)

- **Apple Developer Program**: yılda 99 $ — <https://developer.apple.com/programs/>
- **Google Play Console**: tek seferlik 25 $ — <https://play.google.com/console>
  (yeni kişisel hesaplarda yayından önce bir süre kapalı test şartı olabilir; Play Console söyler)
- **iOS derlemesi için Mac + Xcode**, ya da Mac'siz bulut derleme: Codemagic, Ionic Appflow
  veya Expo EAS benzeri bir hizmet. Android derlemesi Windows/Linux'ta Android Studio ile yapılır.

### 2. Sunucu: app.vantrelcode.com

1. Vercel'e bu depoyu bağla, alan adı olarak `app.vantrelcode.com` ekle.
2. Neon'da veritabanı aç (Frankfurt), `DATABASE_URL`'i gir, `pnpm db:migrate` çalıştır.
3. Ortam değişkenleri (`.env.example`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://app.vantrelcode.com`,
   `APP_ONLY=1`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` + `EMAIL_FROM`, `CRON_SECRET`.

### 3. Tanıtım sitesi: vantrelcode.com

Vercel'de ikinci bir proje aç, aynı depo, **Root Directory: `landing`**, Framework: Other.
Alan adı `vantrelcode.com`. Uygulamalar yayına girince `landing/index.html`'deki iki mağaza
bağlantısını doldur ve `aria-disabled` / "Yakında" yazılarını kaldır. `gizlilik.html`'deki
köşeli parantezli yerleri (veri sorumlusu adı, sağlayıcılar) doldur; metni bir hukukçuya
göstermen önerilir. `destek@vantrelcode.com` adresini aç.

### 4. Google girişi

Google Cloud Console › Credentials'da üç OAuth istemcisi:

- **Web application** → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- **iOS** (Bundle ID `com.vantrelcode.app`) → `GOOGLE_IOS_CLIENT_ID`. Ayrıca bu istemcinin
  "iOS URL scheme" değerini `ios/App/App/Info.plist`'teki `com.googleusercontent.apps.IOS-ISTEMCI-KIMLIGI`
  yerine yaz.
- **Android** (paket `com.vantrelcode.app` + imza SHA-1'i). Play Console'un "App signing"
  sayfasındaki SHA-1'i de ekle; kimliği hiçbir yere yazılmaz.

### 5. Apple girişi

Apple Developer'da App ID `com.vantrelcode.app` için **Sign in with Apple** ve
**Push Notifications** yeteneklerini aç. Android'deki Apple girişi web akışını kullandığı için
Services ID + `.p8` anahtarı da gerekli (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`,
`APPLE_PRIVATE_KEY`); Return URL: `https://app.vantrelcode.com/api/auth/callback/apple`.
App Store kuralı: uygulamada Google girişi varsa Apple girişi de olmak zorunda.

### 6. Bildirimler

- **Android**: Firebase'de proje aç, Android uygulaması ekle (`com.vantrelcode.app`),
  `google-services.json`'u `android/app/` içine koy. Bu dosya olmadan Android'de bildirim
  açılmaya çalışılırsa uygulama kapanır. Hizmet hesabı anahtarını `FCM_SERVICE_ACCOUNT`'a yaz.
- **iOS**: Apple Developer › Keys'te APNs anahtarı oluştur → `APNS_KEY_ID`, `APNS_PRIVATE_KEY`.

### 7. Mağaza kayıtları

Her iki mağaza için: uygulama adı, kısa/uzun açıklama, ekran görüntüleri (iPhone 6,9" ve
Android telefon), ikon (`assets/icon-only.png`), gizlilik politikası
(`https://vantrelcode.com/gizlilik.html`), destek adresi, yaş derecelendirmesi formu.
Google Play ayrıca "Veri güvenliği" formunu ve hesap silme adresini
(`https://vantrelcode.com/hesap-silme.html`) ister; App Store "Uygulama gizliliği" bölümünü.
İnceleme için bir test hesabı (e-posta + şifre) hazırla; Apple ve Google bununla giriş yapar.

### Bilinen sınırlar

- Uygulama sunucuya bağlıdır; internet yokken "Bağlantı yok" sayfası görünür.
- Ana ekran widget'ı ve uygulama simgesi kısayolları yerel kod ister; sonraki adım.
- iPad desteği kapalı (yalnızca iPhone); App Store iPad ekran görüntüsü istemez.
