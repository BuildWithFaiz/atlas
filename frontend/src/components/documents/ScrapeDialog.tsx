// Website Scraping Dialog

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Globe,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { documentsService } from "@/lib/api";
import type { Document } from "@/lib/types/api";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast";

interface ScrapeDialogProps {
  open: boolean;
  onClose: () => void;
  onScrapeSuccess?: (document: Document) => void;
}

interface URLWithStatus {
  id: string;
  url: string;
  status: "pending" | "scraping" | "processing" | "completed" | "failed" | "duplicate";
  document?: Document;
  error?: string;
}

export default function ScrapeDialog({
  open,
  onClose,
  onScrapeSuccess,
}: ScrapeDialogProps) {
  const { getToken } = useAuth();
  const { toast, toasts, removeToast } = useToast();
  const [urls, setUrls] = useState<URLWithStatus[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [useDynamic, setUseDynamic] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setUrls([]);
        setIsScraping(false);
        setUrlInput("");
        setUseDynamic(false);
      }, 300);
    }
  }, [open]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && urlInputRef.current) {
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Define updateURLStatus BEFORE the useEffect that uses it
  const updateURLStatus = useCallback(
    (id: string, updates: Partial<URLWithStatus>) => {
      setUrls((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    },
    []
  );

  // Poll for document processing status updates
  useEffect(() => {
    const processingUrls = urls.filter(
      (u) => u.status === "processing" && u.document?.id
    );

    if (processingUrls.length === 0 || !open) return;

    const checkDocumentStatus = async () => {
      const token = await getToken();
      if (!token) return;

      for (const urlWithStatus of processingUrls) {
        if (!urlWithStatus.document?.id) continue;

        try {
          const updatedDoc = await documentsService.getDocument(
            urlWithStatus.document.id,
            token
          );

          // Only update if status actually changed
          if (
            updatedDoc.processing_status === "completed" &&
            urlWithStatus.status === "processing"
          ) {
            updateURLStatus(urlWithStatus.id, {
              status: "completed",
              document: updatedDoc,
            });

            toast({
              title: "Website Processing Complete",
              description: `${urlWithStatus.url} has been processed and is ready to use.`,
              variant: "success",
            });

            if (onScrapeSuccess) {
              onScrapeSuccess(updatedDoc);
            }
          } else if (
            updatedDoc.processing_status === "failed" &&
            urlWithStatus.status === "processing"
          ) {
            updateURLStatus(urlWithStatus.id, {
              status: "failed",
              document: updatedDoc,
              error: "Processing failed on the server",
            });

            toast({
              title: "Website Processing Failed",
              description: `${urlWithStatus.url} failed to process. Please try scraping again.`,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error checking document status:", error);
        }
      }
    };

    const interval = setInterval(checkDocumentStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [urls, open, getToken, updateURLStatus, toast, onScrapeSuccess]);

  const validateURL = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleAddURL = () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;

    if (!validateURL(trimmedUrl)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicates in the queue
    if (urls.some((u) => u.url === trimmedUrl)) {
      toast({
        title: "URL Already Added",
        description: "This URL is already in the scraping queue.",
        variant: "default",
      });
      return;
    }

    const newURL: URLWithStatus = {
      id: Date.now().toString() + Math.random().toString(),
      url: trimmedUrl,
      status: "pending",
    };

    setUrls((prev) => [...prev, newURL]);
    setUrlInput("");
  };

  const handleRemoveURL = (id: string) => {
    setUrls((prev) => prev.filter((u) => u.id !== id));
  };

  const handleScrape = async () => {
    const pendingUrls = urls.filter((u) => u.status === "pending");
    if (pendingUrls.length === 0) return;

    setIsScraping(true);
    const token = await getToken();
    if (!token) {
      setIsScraping(false);
      return;
    }

    for (const urlWithStatus of pendingUrls) {
      try {
        updateURLStatus(urlWithStatus.id, { status: "scraping" });

        toast({
          title: "Website Scraping Started",
          description: `Scraping ${urlWithStatus.url}...`,
          variant: "default",
        });

        const document = await documentsService.scrapeWebsite(
          urlWithStatus.url,
          token,
          useDynamic
        );

        if (document.is_duplicate) {
          updateURLStatus(urlWithStatus.id, {
            status: "duplicate",
            document,
          });

          toast({
            title: "Website Already Scraped",
            description: `${urlWithStatus.url} was already scraped previously.`,
            variant: "default",
          });
        } else {
          updateURLStatus(urlWithStatus.id, {
            status: "processing",
            document,
          });

          toast({
            title: "Website Scraped Successfully",
            description: `${urlWithStatus.url} has been scraped and is being processed.`,
            variant: "success",
          });
        }
      } catch (error: any) {
        const errorMessage =
          error?.message || "Failed to scrape website. Please try again.";
        updateURLStatus(urlWithStatus.id, {
          status: "failed",
          error: errorMessage,
        });

        toast({
          title: "Scraping Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }

    setIsScraping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddURL();
    }
  };

  const pendingCount = urls.filter((u) => u.status === "pending").length;
  const scrapingCount = urls.filter((u) => u.status === "scraping").length;
  const processingCount = urls.filter((u) => u.status === "processing").length;
  const completedCount = urls.filter((u) => u.status === "completed").length;
  const failedCount = urls.filter((u) => u.status === "failed").length;
  const duplicateCount = urls.filter((u) => u.status === "duplicate").length;
  const allDone = urls.length > 0 && pendingCount === 0 && scrapingCount === 0 && processingCount === 0;

  if (!open) return null;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          onClick={allDone ? onClose : undefined}
        />

        {/* Dialog */}
        <div className="relative z-50 w-full max-w-2xl bg-card border border-border rounded-lg shadow-lg p-6 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Scrape Website</h3>
              {urls.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {completedCount} completed • {processingCount} processing • {pendingCount} pending
                  {failedCount > 0 && ` • ${failedCount} failed`}
                  {duplicateCount > 0 && ` • ${duplicateCount} duplicate`}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
              disabled={isScraping && !allDone}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0 mb-4">
            <div className="space-y-2">
              {urls.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-lg">
                  <Globe className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-1">Enter URL to scrape</p>
                  <p className="text-xs text-muted-foreground">Add a website URL to scrape and ingest its content</p>
                  <div className="flex gap-2 mt-4 w-full">
                    <Input
                      ref={urlInputRef}
                      placeholder="https://example.com/article"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isScraping}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAddURL}
                      disabled={!urlInput.trim() || isScraping}
                      size="icon"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      id="use-dynamic"
                      checked={useDynamic}
                      onChange={(e) => setUseDynamic(e.target.checked)}
                      disabled={isScraping}
                      className="rounded"
                    />
                    <label
                      htmlFor="use-dynamic"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Use dynamic scraping (for JavaScript-rendered pages)
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  {/* URL Input Section */}
                  <div className="flex gap-2 pb-2">
                    <Input
                      ref={urlInputRef}
                      placeholder="https://example.com/article"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isScraping}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAddURL}
                      disabled={!urlInput.trim() || isScraping}
                      size="icon"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Dynamic Scraping Toggle */}
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="use-dynamic"
                      checked={useDynamic}
                      onChange={(e) => setUseDynamic(e.target.checked)}
                      disabled={isScraping}
                      className="rounded"
                    />
                    <label
                      htmlFor="use-dynamic"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Use dynamic scraping (for JavaScript-rendered pages)
                    </label>
                  </div>

                  {urls.map((urlWithStatus) => (
                    <div
                      key={urlWithStatus.id}
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-lg transition-colors",
                        urlWithStatus.status === "completed"
                          ? "bg-green-500/10 border-green-500/20"
                          : urlWithStatus.status === "duplicate"
                          ? "bg-blue-500/10 border-blue-500/20"
                          : urlWithStatus.status === "failed"
                          ? "bg-red-500/10 border-red-500/20"
                          : urlWithStatus.status === "processing" || urlWithStatus.status === "scraping"
                          ? "bg-yellow-500/10 border-yellow-500/20"
                          : "bg-secondary/50 border-border"
                      )}
                    >
                      <div className="flex-shrink-0">
                        {urlWithStatus.status === "scraping" || urlWithStatus.status === "processing" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-yellow-600 dark:text-yellow-400" />
                        ) : urlWithStatus.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : urlWithStatus.status === "duplicate" ? (
                          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        ) : urlWithStatus.status === "failed" ? (
                          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        ) : (
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={urlWithStatus.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-medium text-primary hover:underline truncate flex items-center gap-1"
                        >
                          {urlWithStatus.url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded",
                              urlWithStatus.status === "completed"
                                ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                : urlWithStatus.status === "duplicate"
                                ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                : urlWithStatus.status === "failed"
                                ? "bg-red-500/20 text-red-600 dark:text-red-400"
                                : urlWithStatus.status === "processing" || urlWithStatus.status === "scraping"
                                ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                : "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                            )}
                          >
                            {urlWithStatus.status}
                          </span>
                        </div>
                        {urlWithStatus.error && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {urlWithStatus.error}
                          </p>
                        )}
                      </div>
                      {urlWithStatus.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleRemoveURL(urlWithStatus.id)}
                          disabled={isScraping}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose} disabled={isScraping && !allDone}>
              {allDone ? "Close" : "Cancel"}
            </Button>
            {urls.length > 0 && pendingCount > 0 && (
              <Button onClick={handleScrape} disabled={isScraping || pendingCount === 0}>
                {isScraping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  `Scrape ${pendingCount} URL${pendingCount !== 1 ? "s" : ""}`
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
