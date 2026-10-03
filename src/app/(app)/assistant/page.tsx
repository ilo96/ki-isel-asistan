import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { AssistantPreview } from "@/features/assistant/assistant-preview";

export const metadata: Metadata = { title: "Asistan" };

export default async function AssistantPage() {
  const t = await getTranslations("assistantPage");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <AssistantPreview />
    </>
  );
}
