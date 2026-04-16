import { useState, useEffect, useRef } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Plus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ConversationsList from "@/components/chat/ConversationsList";
import DocumentsList from "@/components/documents/DocumentsList";
import HistoryList from "@/components/history/HistoryList";
import { ToastContainer } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => Promise<void>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SIDEBAR_COLLAPSED_KEY = "atlas_sidebar_collapsed";

export default function Sidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalToggleCollapse,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeNav, setActiveNav] = useState("chat");
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved ? JSON.parse(saved) : false;
  });
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast, removeToast, toasts } = useToast();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Use external state if provided, otherwise use internal state
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed;

  // Save collapse state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
        variant: "default",
      });
      navigate("/");
    } catch (error) {
      toast({
        title: "Sign out failed",
        description: "There was an error signing out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Determine active nav based on current route
  const getActiveNav = () => {
    if (location.pathname.startsWith("/study")) {
      return "study";
    }
    if (location.pathname === "/chat") {
      return "chat";
    }
    if (location.pathname === "/documents") {
      return "documents";
    }
    return activeNav;
  };

  const currentActiveNav = getActiveNav();
  const isNewChatActive = currentActiveNav === "chat" && !activeConversationId;

  const toggleCollapse = () => {
    if (externalToggleCollapse) {
      externalToggleCollapse();
    } else {
      setInternalCollapsed(!isCollapsed);
    }
  };

  const handleNavClick = (nav: string) => {
    setActiveNav(nav);
  };

  // Navigation items configuration
  const navItems = [
    {
      id: "chat",
      label: "AI Chat",
      icon: MessageSquare,
      onClick: () => {
        handleNavClick("chat");
        navigate("/chat");
      },
      active: currentActiveNav === "chat" && !isNewChatActive,
    },
    {
      id: "study",
      label: "Study Materials",
      icon: BookOpen,
      onClick: () => {
        handleNavClick("study");
        navigate("/study");
      },
      active: currentActiveNav === "study",
    },
    {
      id: "documents",
      label: "Documents",
      icon: FileText,
      onClick: () => {
        handleNavClick("documents");
        navigate("/documents");
      },
      active: location.pathname === "/documents" || activeNav === "documents",
    },
  ];

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card border-r border-border",
        "transition-all duration-300 ease-in-out overflow-hidden",
        isCollapsed ? "w-[60px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-border shrink-0",
        isCollapsed ? "justify-center px-2 py-3" : "justify-between px-3 py-3"
      )}>
        {isCollapsed ? (
          <button
            onClick={toggleCollapse}
            className={cn(
              "flex items-center justify-center",
              "h-8 w-8 rounded-md shrink-0",
              "hover:bg-accent transition-colors duration-150",
              "text-muted-foreground hover:text-foreground"
            )}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              onClick={() => window.location.href = "/"}
              className="flex items-center gap-2 flex-1 min-w-0 group"
            >
              <div className="grid grid-cols-3 gap-1 w-8 h-8 transition-transform group-hover:scale-110 shrink-0">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary transition-all group-hover:bg-primary/80"
                  />
                ))}
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Atlas
              </span>
            </button>
            <button
              onClick={toggleCollapse}
              className={cn(
                "flex items-center justify-center",
                "h-8 w-8 rounded-md shrink-0",
                "hover:bg-accent transition-colors duration-150",
                "text-muted-foreground hover:text-foreground"
              )}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {isCollapsed ? (
          /* Collapsed: Icon-only mode */
          <div className="flex flex-col items-center gap-1 py-2 px-2 overflow-y-auto">
            {/* New Chat Button */}
            <button
              onClick={async () => {
                await onNewChat();
                handleNavClick("chat");
                navigate("/chat");
              }}
              className={cn(
                "flex items-center justify-center",
                "h-9 w-9 rounded-md shrink-0",
                "hover:bg-accent transition-colors duration-150",
                "text-foreground",
                isNewChatActive && "bg-primary text-primary-foreground"
              )}
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Navigation Icons */}
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    "flex items-center justify-center",
                    "h-9 w-9 rounded-md shrink-0",
                    "hover:bg-accent transition-colors duration-150",
                    "text-foreground",
                    item.active && "bg-primary text-primary-foreground"
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        ) : activeNav === "documents" ? (
          /* Expanded: Documents view */
          <div className="flex-1 min-h-0 overflow-hidden">
            <DocumentsList
              onDocumentSelect={(documentId) => {
                console.log("Selected document:", documentId);
              }}
            />
          </div>
        ) : (
          /* Expanded: Full navigation with conversations */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="flex flex-col py-2">
                {/* New Chat Button */}
                <div className="px-2 mb-1">
                  <button
                    onClick={async () => {
                      await onNewChat();
                      handleNavClick("chat");
                      navigate("/chat");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md",
                      "text-sm font-medium transition-colors duration-150",
                      "hover:bg-accent",
                      isNewChatActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">New Chat</span>
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="px-2 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={item.onClick}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-md",
                          "text-sm font-medium transition-colors duration-150",
                          item.active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-accent"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Conversations Section */}
                {currentActiveNav === "chat" && (
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="px-3 mb-2">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Recent
                      </h3>
                    </div>
                    <div className="px-2">
                      <ConversationsList
                        activeConversationId={activeConversationId}
                        onSelectConversation={(id) => {
                          onSelectConversation(id);
                          handleNavClick("chat");
                        }}
                      />
                    </div>
                  </div>
                )}

              
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* User Profile Footer */}
      <div className={cn(
        "border-t border-border shrink-0 relative",
        isCollapsed ? "p-2" : "p-3"
      )}>
        {isCollapsed ? (
          <div className="flex justify-center">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="relative"
            >
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  className="w-8 h-8 rounded-md cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-offset-2 ring-offset-background ring-primary/20 hover:ring-primary/40"
                  title={user.fullName || "User"}
                />
              ) : (
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-offset-2 ring-offset-background ring-primary/20 hover:ring-primary/40">
                  {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
                </div>
              )}
            </button>
          </div>
        ) : (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors duration-150 group"
            >
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  className="w-8 h-8 rounded-md shrink-0 ring-2 ring-offset-2 ring-offset-background ring-primary/20 group-hover:ring-primary/40 transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium shrink-0 ring-2 ring-offset-2 ring-offset-background ring-primary/20 group-hover:ring-primary/40 transition-all">
                  {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate text-foreground">
                  {user?.fullName || user?.firstName || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress || "user@example.com"}
                </p>
              </div>
              {isUserMenuOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {/* User Menu Dropdown */}
            {isUserMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
                <div className="py-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Menu Dropdown for Collapsed State */}
        {isCollapsed && isUserMenuOpen && (
          <div className="absolute bottom-full left-2 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px] animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
            <div className="py-1">
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.fullName || user?.firstName || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress || "user@example.com"}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
