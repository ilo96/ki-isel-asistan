/*
 * Asistan sohbetinin istemciyle paylaşılan tipleri. Sunucu SSE ile ChatEvent gönderir;
 * istemci bunları mesaj parçalarına (MessagePart) çevirir. Kartlardaki metinler sunucuda
 * biçimlendirilir (para birimi, tarih), istemci yalnızca gösterir.
 */

export type CardIcon =
  | "expense"
  | "income"
  | "reminder"
  | "bill"
  | "task"
  | "summary"
  | "budget"
  | "balance"
  | "list"
  | "memory"
  | "delete"
  | "navigate"
  | "fitness"
  | "weight"
  | "goal";

export type ActionCard = {
  icon: CardIcon;
  title: string;
  /** Kısa satırlar: "₺350 · Yemek · Bugün" gibi. */
  lines: string[];
  href?: string;
};

export type ActionState = "proposed" | "executed" | "rejected" | "undone" | "expired" | "failed";

export type MessagePart =
  | { type: "tool"; id: string; name: string; status: "running" | "done" | "error"; label: string }
  | {
      type: "action";
      id: string;
      actionId: string | null;
      state: ActionState;
      card: ActionCard;
      undoable: boolean;
    };

export type ChatEvent =
  | { type: "start"; conversationId: string; engine: "claude" | "offline" }
  | { type: "status"; text: string }
  | { type: "text-delta"; text: string }
  | { type: "tool-start"; id: string; name: string; label: string }
  | { type: "tool-end"; id: string; ok: boolean; label: string }
  | {
      type: "action";
      id: string;
      actionId: string | null;
      state: ActionState;
      card: ActionCard;
      undoable: boolean;
    }
  | { type: "navigate"; href: string }
  | { type: "suggestions"; items: string[] }
  | { type: "done"; messageId: string }
  | { type: "error"; code: "rate_limited" | "unauthorized" | "invalid" | "unknown" };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: MessagePart[];
};

export type ConversationSummary = { id: string; title: string; lastMessageAt: string };
