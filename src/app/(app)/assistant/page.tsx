import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ChatView } from "@/features/assistant/chat-view";
import { ConversationHistory } from "@/features/assistant/conversation-history";
import { engineName, listConversations } from "@/server/ai/chat";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";

export const metadata: Metadata = { title: "Asistan" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AssistantPage({ searchParams }: Props) {
  const [user, t, { q }] = await Promise.all([
    requireUser(),
    getTranslations("assistantPage"),
    searchParams,
  ]);
  const conversations = await listConversations(await getDb(), user.id);
  const prompt = q?.trim().slice(0, 1000) || undefined;
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={<ConversationHistory conversations={conversations} currentId={null} />}
      />
      <ChatView
        key={prompt ?? "new"}
        conversationId={null}
        initialMessages={[]}
        initialPrompt={prompt}
        offline={engineName() === "offline"}
      />
    </>
  );
}
