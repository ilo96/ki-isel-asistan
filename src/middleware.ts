import { NextResponse, type NextRequest } from "next/server";
import { shouldSendToLanding } from "@/lib/app-client";

/*
 * Hızlı ön kontrol: oturum çerezi yoksa korumalı sayfalar girişe yönlenir.
 * Çerezin geçerliliği burada değil, sunucuda (requireUser) veritabanıyla doğrulanır.
 *
 * APP_ONLY=1 (yayın): uygulama yalnızca mağaza uygulaması içinde açılır; tarayıcıdan gelen
 * sayfa istekleri LANDING_URL'deki tanıtım sayfasına yönlenir. API uçları etkilenmez.
 */

// Better Auth'un oturum çerezi; HTTPS'te __Secure- önekiyle yazılır.
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

const LANDING_URL = process.env.LANDING_URL ?? "https://vantrelcode.com";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    shouldSendToLanding({
      appOnly: process.env.APP_ONLY === "1",
      pathname,
      userAgent: request.headers.get("user-agent"),
    })
  ) {
    return NextResponse.redirect(LANDING_URL);
  }
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // API, Next iç dosyaları ve uzantılı statik dosyalar hariç her şey.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
