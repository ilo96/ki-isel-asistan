import "server-only";
import { headers } from "next/headers";
import { isAppUserAgent } from "@/lib/app-client";

/** İstek mağaza uygulamasından mı geliyor? Tarayıcıya özel ekranları gizlemek için. */
export async function isAppRequest() {
  return isAppUserAgent((await headers()).get("user-agent"));
}
