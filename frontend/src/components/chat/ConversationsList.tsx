// Conversations List Component

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatService } from "@/lib/api";
import type { Conversation } from "@/lib/types/api";

interface ConversationsListProps {
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}

export default function ConversationsList({
  activeConversationId,
  onSelectConversation,
}: ConversationsListProps) {
  const { getToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const convs = await chatService.listConversations(token);
      setConversations(convs);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    try {
      setDeletingId(conversationId);
      const token = await getToken();
      if (!token) return;

      await chatService.deleteConversation(conversationId, token);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      
      // If deleted conversation was active, switch to default
      if (conversationId === activeConversationId) {
        const token = await getToken();
        if (token) {
          const defaultConv = await chatService.getOrCreateDefaultConversation(token);
          onSelectConversation(defaultConv.id);
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      alert("Failed to delete conversation. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col">
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground">
          <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" />
          <p className="text-xs">Loading...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <MessageSquare className="h-5 w-5 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No conversations yet</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {conversations.slice(0, 5).map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={cn(
                "w-full px-3 py-2 rounded-md transition-colors duration-150 text-left group relative",
                "flex items-center justify-between gap-2",
                activeConversationId === conv.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-normal">
                  {conv.title || "New Chat"}
                </p>
              </div>
              {activeConversationId === conv.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-primary-foreground/20"
                  onClick={(e) => handleDelete(conv.id, e)}
                  disabled={deletingId === conv.id}
                >
                  {deletingId === conv.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

