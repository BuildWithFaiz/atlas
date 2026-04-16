import { ScrollArea } from "@/components/ui/scroll-area";
import ChatMessage from "./ChatMessage";
import type { ChatMessage as ChatMessageType } from "@/lib/types/api";

interface ChatMessagesProps {
  messages: ChatMessageType[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <ScrollArea className="h-full py-6">
      <div className="space-y-6">
        {messages.map((message) => (
          <ChatMessage key={`${message.id}-${message.created_at}`} message={message} />
        ))}
      </div>
    </ScrollArea>
  );
}

