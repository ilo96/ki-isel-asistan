import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";

// Landing sayfası sonraki bir fazda; şimdilik oturuma göre yönlendirir.
export default async function RootPage() {
  redirect((await getSession()) ? "/home" : "/login");
}
