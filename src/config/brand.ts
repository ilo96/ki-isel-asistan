/**
 * Uygulamanın adı tek yerden gelir. İsim kesinleşince yalnızca burayı değiştirmek yeter;
 * arayüz metinleri (`app.name`), sayfa başlıkları, PWA manifest'i, e-postalar ve açılış ekranı
 * buradan okur. İstisna: `public/sw.js` ve `public/offline.html` derlenmeyen statik dosyalar,
 * oradaki "Asistan" yazıları elle güncellenmeli.
 */
export const APP_NAME = "Asistan";

/** Ana ekrana eklenince ve mağaza açıklamalarında görünen uzun ad. */
export const APP_FULL_NAME = `${APP_NAME}: kişisel finans ve gün asistanı`;

export const APP_DESCRIPTION =
  "Gelirini, giderini ve gününü senin yerine takip eden kişisel AI asistanın.";
