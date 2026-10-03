import type { Metadata } from "next";
import { AssistantSummary } from "@/features/dashboard/assistant-summary";
import { GoalCard } from "@/features/dashboard/goal-card";
import { Greeting } from "@/features/dashboard/greeting";
import { RecentTransactions } from "@/features/dashboard/recent-transactions";
import { SummaryCards } from "@/features/dashboard/summary-cards";
import { UpcomingList } from "@/features/dashboard/upcoming-list";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { isProduction } from "@/server/env";
import { buildInsights, getDashboard } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "Ana Sayfa" };

export default async function HomePage() {
  const user = await requireUser();
  const timeZone = user.timezone ?? DEFAULT_TIMEZONE;
  const data = await getDashboard(await getDb(), { id: user.id, timezone: timeZone });
  const currency = (user.currency ?? DEFAULT_CURRENCY) as CurrencyCode;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="space-y-4 pt-2">
        <Greeting name={firstName} />
        <AssistantSummary
          userId={user.id}
          insights={buildInsights(data)}
          isEmpty={data.isEmpty}
          currency={currency}
          showDemo={!isProduction()}
        />
      </section>

      <SummaryCards data={data} currency={currency} />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-4 lg:order-2 lg:col-span-5 lg:space-y-6">
          {data.goal && (
            <GoalCard goal={data.goal} daysLeft={data.daysLeftInMonth} currency={currency} />
          )}
          <UpcomingList items={data.upcoming} currency={currency} timeZone={timeZone} />
        </div>
        <div className="lg:order-1 lg:col-span-7">
          <RecentTransactions items={data.recent} currency={currency} />
        </div>
      </div>
    </div>
  );
}
