import { redirect } from "next/navigation";
import { dayIn, DEFAULT_TIMEZONE, shiftMonth } from "@/lib/dates";
import { requireUser } from "@/server/auth";

/** /recap: ayın ilk haftasında geçen ayın, sonra bu ayın (şimdiye kadarki) özeti. */
export default async function RecapIndex() {
  const user = await requireUser();
  const today = dayIn(new Date(), user.timezone ?? DEFAULT_TIMEZONE);
  const month =
    Number(today.slice(8, 10)) <= 7 ? shiftMonth(today.slice(0, 7), -1) : today.slice(0, 7);
  redirect(`/recap/${month}`);
}
