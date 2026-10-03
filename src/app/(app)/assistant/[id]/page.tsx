import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ChatView } from "@/features/assistant/chat-view";
import { ConversationHistory } from "@/features/assistant/conversation-history";
import { engineName, getConversation, listConversations } from "@/server/ai/chat";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";

export const metadata: Metadata = { title: "Asistan" };

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ConversationPage({ params }: Props) {
  const [user, t, { id }] = await Promise.all([requireUser(), getTranslations("assistantPage"), params]);
  if (!UUID.test(id)) notFound();
  const db = await getDb();
  const [conversation, conversations] = await Promise.all([
    getConversation(db, user.id, id),
    listConversations(db, user.id),
  ]);
  if (!conversation) notFound();
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={conversation.title}
        action={<ConversationHistory conversations={conversations} currentId={id} />}
      />
      <ChatView
        key={id}
        conversationId={id}
        initialMessages={conversation.messages}
        offline={engineName() === "offline"}
      />
    </>
  );
}
