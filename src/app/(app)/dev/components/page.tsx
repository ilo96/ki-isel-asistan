import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Showcase } from "@/features/dev/showcase";

export const metadata: Metadata = { title: "Tasarım sistemi", robots: { index: false } };

/** Plan: her component'in normal, loading, empty ve error görünümü yan yana durur. */
export default function ComponentsPage() {
  return (
    <>
      <PageHeader title="Tasarım sistemi" subtitle="Token'lar, componentler ve durumları" />
      <Showcase />
    </>
  );
}
