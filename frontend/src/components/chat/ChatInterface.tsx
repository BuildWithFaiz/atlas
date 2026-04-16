import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import WelcomeScreen from "./WelcomeScreen";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import ModeSelector from "./ModeSelector";
import { chatService } from "@/lib/api";
import type { ChatMessage } from "@/lib/types/api";

interface ChatInterfaceProps {
  conversationId: string | null;
}

export default function ChatInterface({ 
  conversationId
}: ChatInterfaceProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const hasMessages = messages.length > 0;

  // Load messages when conversation changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      try {
        setIsLoadingMessages(true);
        const token = await getToken();
        if (!token) return;

        const existingMessages = await chatService.getChatMessages(
          conversationId,
          token
        );
        setMessages(existingMessages);
      } catch (error) {
        console.error("Failed to load messages:", error);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [conversationId, getToken]);

  const handleSend = async (content: string) => {
    if (!conversationId) {
      console.error("No conversation ID available");
      return;
    }

    const token = await getToken();
    if (!token) {
      console.error("No authentication token available");
      return;
    }

    // Add user message immediately (optimistic update)
    const userMessage: ChatMessage = {
      id: Date.now(),
      conversation: conversationId,
      role: "user",
      content,
      citations: [],
      document_ids: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Send message to backend
      const response = await chatService.postMessage(
        conversationId,
        content,
        token,
        true // user_documents_only
      );

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        conversation: conversationId,
        role: "assistant",
        content: response.answer,
        citations: response.sources,
        document_ids: response.sources.map((s) => s.document_id),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove optimistic user message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        conversation: conversationId,
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
        citations: [],
        document_ids: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Select a conversation to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="px-8 py-6 border-b flex items-center justify-between">
        <h1 className="text-xl font-semibold">AI WorkSpace</h1>
        <ModeSelector />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-6">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading messages...</p>
            </div>
          ) : !hasMessages ? (
            <WelcomeScreen />
          ) : (
            <ChatMessages messages={messages} />
          )}
        </div>
      </div>

      <div className="border-t border-border shrink-0">
        <div className="max-w-4xl mx-auto px-8 py-5">
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

