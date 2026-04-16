import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Trash2, Eye, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { documentsService } from "@/lib/api";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import { ToastContainer } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@/lib/types/api";

export default function DocumentsPreviewPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { toast, removeToast, toasts } = useToast();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        navigate("/sign-in");
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

  const handleDelete = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    const document = documents.find((d) => d.id === documentId);
    const documentName = document?.title || document?.filename || "Document";

    try {
      setDeletingId(documentId);
      const token = await getToken();
      if (!token) return;

      await documentsService.deleteDocument(documentId, token);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      
      // Show success toast
      toast({
        title: "Document deleted",
        description: `${documentName} has been deleted successfully.`,
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

  const handleViewDocument = (documentId: string) => {
    // Navigate to study materials page for this document
    navigate(`/study/${documentId}`);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing":
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Create a dummy conversation handler for sidebar
  const handleDummyConversation = () => {
    navigate("/chat");
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar 
        activeConversationId={null} 
        onSelectConversation={handleDummyConversation} 
        onNewChat={async () => {
          navigate("/chat");
        }} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-8 border-b border-border shrink-0 bg-card">
          <h1 className="text-3xl font-bold text-foreground mb-2">Documents</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your uploaded documents
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-muted/30">
          <div className="max-w-7xl mx-auto px-8 py-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading documents...</p>
                </div>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No documents found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Upload documents to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-card border border-border rounded-xl p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20 flex flex-col"
                  >
                    {/* Document Header */}
                    <div className="mb-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                          doc.processing_status === "completed"
                            ? "bg-green-500/20 text-green-600 dark:text-green-400"
                            : doc.processing_status === "processing" || doc.processing_status === "pending"
                            ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                            : doc.processing_status === "failed"
                            ? "bg-red-500/20 text-red-600 dark:text-red-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(doc.processing_status)}
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            doc.processing_status === "completed"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : doc.processing_status === "processing" || doc.processing_status === "pending"
                              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              : doc.processing_status === "failed"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                          )}>
                            {doc.processing_status}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2 truncate">
                        {doc.title || doc.filename}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Uploaded {formatDate(doc.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 mt-auto">
                      {doc.processing_status === "completed" ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={() => handleViewDocument(doc.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Document
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Processing...
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(doc.id, e)}
                        disabled={deletingId === doc.id}
                      >
                        {deletingId === doc.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
