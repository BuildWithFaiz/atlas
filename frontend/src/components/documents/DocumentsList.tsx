// Documents List Component for Sidebar

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Trash2, Search, Plus, BookOpen, Globe, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { documentsService } from "@/lib/api";
import type { Document } from "@/lib/types/api";
import UploadDialog from "./UploadDialog";
import { useToast } from "@/hooks/use-toast";

interface DocumentsListProps {
  onDocumentSelect?: (documentId: string) => void;
}

export default function DocumentsList({ onDocumentSelect }: DocumentsListProps) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [getToken]);

  // Poll for status updates on processing documents
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.processing_status === 'processing' || d.processing_status === 'pending'
    );
    
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadDocuments();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const userDocs = await documentsService.listUserDocuments(token);
      setDocuments(userDocs);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(documentId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;

    const documentIdToDelete = confirmDeleteId;
    const documentToDelete = documents.find((d) => d.id === documentIdToDelete);
    
    try {
      setDeletingId(documentIdToDelete);
      setConfirmDeleteId(null);
      const token = await getToken();
      if (!token) return;

      await documentsService.deleteDocument(documentIdToDelete, token);
      setDocuments((prev) => prev.filter((d) => d.id !== documentIdToDelete));
      
      // Show success toast
      toast({
        title: "Document deleted",
        description: `"${documentToDelete?.title || documentToDelete?.filename || 'Document'}" has been deleted successfully.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
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

  const handleUploadSuccess = (document: Document) => {
    // Add new document to the list if it doesn't already exist
    setDocuments((prev) => {
      const exists = prev.some((d) => d.id === document.id);
      if (exists) return prev;
      return [document, ...prev];
    });
    
    // Refresh the full list to get latest status updates
    setTimeout(() => {
      loadDocuments();
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="p-2 border-b border-border shrink-0">
        <Button
          className="w-full"
          size="sm"
          onClick={() => setIsUploadDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
            <p className="text-xs">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No documents yet</p>
            <p className="text-xs mt-1 opacity-70">Upload a document to get started</p>
          </div>
        ) : (
          <div className="px-2 py-1 space-y-0.5">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  onDocumentSelect?.(doc.id);
                  navigate("/documents");
                }}
                className="w-full px-3 py-2.5 rounded-md transition-colors duration-150 text-left group relative hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {doc.source_type === 'web' ? (
                      <Globe className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-normal text-foreground truncate">
                        {doc.title || doc.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            doc.processing_status === "completed"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : doc.processing_status === "processing"
                              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              : doc.processing_status === "failed"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                          )}
                        >
                          {doc.processing_status}
                        </span>
                        {doc.source_type === 'web' && doc.source_url && (
                          <a
                            href={doc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary hover:underline flex items-center gap-1 truncate max-w-[150px]"
                            title={doc.source_url}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{new URL(doc.source_url).hostname}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (doc.processing_status === 'completed') {
                          navigate(`/study/${doc.id}`);
                        } else {
                          onDocumentSelect?.(doc.id);
                        }
                      }}
                      title={doc.processing_status === 'completed' ? "Generate study materials" : "View document"}
                    >
                      {doc.processing_status === 'completed' ? (
                        <BookOpen className="h-3.5 w-3.5" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => handleDeleteClick(doc.id, e)}
                      disabled={deletingId === doc.id}
                      title="Delete document"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <UploadDialog
        open={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        (() => {
          const documentToDelete = documents.find((d) => d.id === confirmDeleteId);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-background/80 backdrop-blur-sm"
                onClick={handleCancelDelete}
              />
              
              {/* Dialog */}
              <div 
                className="relative z-50 w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Delete Document</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Are you sure you want to delete "{documentToDelete?.title || documentToDelete?.filename || 'this document'}"? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={handleCancelDelete}
                        disabled={deletingId === confirmDeleteId}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleConfirmDelete}
                        disabled={deletingId === confirmDeleteId}
                      >
                        {deletingId === confirmDeleteId ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}

