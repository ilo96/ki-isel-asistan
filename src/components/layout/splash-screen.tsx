import { BrandV } from "@/components/brand/brand-mark";
import { APP_NAME } from "@/config/brand";

/*
 * Açılış animasyonu: uygulama her açıldığında (sekme/oturum başına bir kez) küre belirir,
 * içinde V çizilir, adı yazılır, sonra ekran yumuşakça açılır. Saf CSS'tir; JavaScript yüklenmeden ilk karede
 * görünür, hidrasyonu beklemez ve tıklamaları hiç engellemez (pointer-events: none).
 * Küçük satır içi betik, aynı oturumda ikinci kez göstermemek ve otomatik testlerde
 * (navigator.webdriver) atlamak için <html data-splash="off"> koyar.
 */
const skipScript = `try{var s=window.sessionStorage;if(navigator.webdriver||s.getItem("splash")){document.documentElement.dataset.splash="off"}else{s.setItem("splash","1")}}catch(e){}`;

export function SplashScreen() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: skipScript }} />
      <div aria-hidden className="splash">
        <div className="splash-glow ai-gradient" />
        <div className="splash-orb">
          <span className="splash-orb-fill" />
          <span className="splash-orb-light" />
          <BrandV className="splash-v" />
        </div>
        <p className="splash-name">
          {Array.from(APP_NAME).map((ch, i) => (
            <span key={i} style={{ animationDelay: `${520 + i * 45}ms` }}>
              {ch}
            </span>
          ))}
        </p>
      </div>
    </>
  );
}
