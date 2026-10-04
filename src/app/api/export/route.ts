import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { exportAccount, exportTransactionsCsv } from "@/server/services/account";

/** Verilerimi indir: ?format=csv işlemleri, aksi halde tüm hesabı JSON olarak verir. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!(await rateLimit(`export:${session.user.id}`, 10, 60 * 60_000)).ok) {
    return new Response("Too Many Requests", { status: 429 });
  }
  const db = await getDb();
  const day = new Date().toISOString().slice(0, 10);
  if (new URL(request.url).searchParams.get("format") === "csv") {
    return new Response(await exportTransactionsCsv(db, session.user.id), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="islemler-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(JSON.stringify(await exportAccount(db, session.user.id), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="asistan-verilerim-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
