import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import Sidebar from "@/components/layout/Sidebar";
import ChatInterface from "@/components/chat/ChatInterface";
import { chatService } from "@/lib/api";

const DEFAULT_CONVERSATION_KEY = "atlas_default_conversation_id";

export default function ChatPage() {
  const { getToken } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("atlas_sidebar_collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  // Initialize conversation on mount
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setIsInitializing(false);
          return;
        }

        // Check localStorage for existing conversation ID
        const storedId = localStorage.getItem(DEFAULT_CONVERSATION_KEY);
        if (storedId) {
          setActiveConversationId(storedId);
        } else {
          // Get or create default conversation
          const conv = await chatService.getOrCreateDefaultConversation(token);
          setActiveConversationId(conv.id);
          localStorage.setItem(DEFAULT_CONVERSATION_KEY, conv.id);
        }
      } catch (error) {
        console.error("Failed to initialize conversation:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeConversation();
  }, [getToken]);

  const handleNewChat = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      // Create new conversation
      const response = await chatService.createConversation(undefined, token);
      const newConversationId = response.conversation_id;
      
      setActiveConversationId(newConversationId);
      localStorage.setItem(DEFAULT_CONVERSATION_KEY, newConversationId);
    } catch (error) {
      console.error("Failed to create new chat:", error);
      alert("Failed to create new chat. Please try again.");
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    localStorage.setItem(DEFAULT_CONVERSATION_KEY, conversationId);
  };

  const handleToggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem("atlas_sidebar_collapsed", JSON.stringify(newState));
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatInterface conversationId={activeConversationId} />
      </div>
    </div>
  );
}

