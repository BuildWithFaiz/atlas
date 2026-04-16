// History List Component

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { documentsService } from "@/lib/api";
import type { SearchHistory } from "@/lib/types/api";
import { useToast } from "@/hooks/use-toast";

interface HistoryListProps {
  onHistoryItemClick?: (query: string) => void;
}

export default function HistoryList({ onHistoryItemClick }: HistoryListProps) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const historyData = await documentsService.getSearchHistory(token);
      setHistory(historyData);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (historyId: number, query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      setDeletingId(historyId);
      const token = await getToken();
      if (!token) return;

      await documentsService.deleteSearchHistoryItem(historyId, token);
      setHistory((prev) => prev.filter((h) => h.id !== historyId));
      
      // Show success toast
      toast({
        title: "History deleted",
        description: `Search query "${query}" has been removed from history.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to delete history:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete history item. Please try again.",
        variant: "destructive",
      });
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
      ) : history.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <Clock className="h-5 w-5 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No search history yet</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {history.map((item) => (
            <div
              key={item.id}
              className="group relative w-full px-3 py-2 rounded-md transition-colors duration-150 text-left hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => onHistoryItemClick?.(item.search_query)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm truncate font-normal text-foreground">
                    {item.search_query}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(item.created_at)} • {item.results_count} results
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-destructive/20 hover:text-destructive"
                  onClick={(e) => handleDelete(item.id, item.search_query, e)}
                  disabled={deletingId === item.id}
                  title="Delete"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
