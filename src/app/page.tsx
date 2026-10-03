import { redirect } from "next/navigation";

// Landing sayfası sonraki aşamada; şimdilik doğrudan dashboard.
export default function RootPage() {
  redirect("/home");
}
