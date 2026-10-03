import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/features/dashboard/dashboard-skeleton";
import { DemoDataButton } from "@/features/dashboard/demo-data-button";
import { Showcase } from "@/features/dev/showcase";
import { isProduction } from "@/server/env";

export const metadata: Metadata = { title: "Tasarım sistemi", robots: { index: false } };

/** Plan: her component'in normal, loading, empty ve error görünümü yan yana durur. */
export default function ComponentsPage() {
  return (
    <>
      <PageHeader title="Tasarım sistemi" subtitle="Token'lar, componentler ve durumları" />
      <div className="space-y-4">
        {!isProduction() && (
          <Card>
            <CardTitle className="mb-4">Örnek veri</CardTitle>
            <div className="flex flex-wrap gap-6">
              <DemoDataButton mode="seed" />
              <DemoDataButton mode="clear" />
            </div>
          </Card>
        )}
        <Showcase />
        <Card>
          <CardTitle className="mb-5">Ana sayfa iskeleti</CardTitle>
          <DashboardSkeleton />
        </Card>
      </div>
    </>
  );
}
