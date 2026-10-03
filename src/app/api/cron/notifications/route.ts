import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { notifyAll } from "@/server/notify";

/*
 * Zamanlanmış bildirim işi (Vercel Cron ya da harici zamanlayıcı). CRON_SECRET olmadan
 * çalışmaz; istek Authorization: Bearer <CRON_SECRET> taşımalı.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const result = await notifyAll(await getDb());
  return Response.json(result);
}
