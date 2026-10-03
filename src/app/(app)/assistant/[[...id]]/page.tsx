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

type Props = { params: Promise<{ id?: string[] }>; searchParams: Promise<{ q?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /assistant (yeni sohbet) ve /assistant/[id] tek sayfa: yeni sohbet açılınca adres
 * değişse de sohbet bileşeni yeniden kurulmaz, akan yanıt kesilmez.
 */
export default async function AssistantPage({ params, searchParams }: Props) {
  const [user, t, { id: segments }, { q }] = await Promise.all([
    requireUser(),
    getTranslations("assistantPage"),
    params,
    searchParams,
  ]);
  if (segments && (segments.length !== 1 || !UUID.test(segments[0]!))) notFound();
  const id = segments?.[0] ?? null;
  const db = await getDb();
  const [conversation, conversations] = await Promise.all([
    id ? getConversation(db, user.id, id) : null,
    listConversations(db, user.id),
  ]);
  if (id && !conversation) notFound();
  const prompt = id ? undefined : q?.trim().slice(0, 1000) || undefined;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={conversation?.title ?? t("subtitle")}
        action={<ConversationHistory conversations={conversations} currentId={id} />}
      />
      <ChatView
        key={prompt}
        conversationId={id}
        initialMessages={conversation?.messages ?? []}
        initialPrompt={prompt}
        offline={engineName() === "offline"}
      />
    </>
  );
}
