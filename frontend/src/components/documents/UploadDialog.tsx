// Multiple PDF Upload Dialog with Queue-Based Processing

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Loader2, X, FileText, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { documentsService } from "@/lib/api";
import type { Document } from "@/lib/types/api";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadSuccess?: (document: Document) => void;
}

interface FileWithStatus {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'duplicate';
  document?: Document;
  error?: string;
}

export default function UploadDialog({
  open,
  onClose,
  onUploadSuccess,
}: UploadDialogProps) {
  const { getToken } = useAuth();
  const { toast, toasts, removeToast } = useToast();
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to allow animations
      setTimeout(() => {
        setFiles([]);
        setCurrentUploadIndex(null);
        setIsUploading(false);
      }, 300);
    }
  }, [open]);

  // Define updateFileStatus BEFORE the useEffect that uses it
  const updateFileStatus = useCallback((id: string, updates: Partial<FileWithStatus>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  // Poll for document processing status updates
  useEffect(() => {
    const processingFiles = files.filter(
      (f) => f.status === 'processing' && f.document?.id
    );

    if (processingFiles.length === 0 || !open) return;

    const checkDocumentStatus = async () => {
      const token = await getToken();
      if (!token) return;

      for (const fileWithStatus of processingFiles) {
        if (!fileWithStatus.document?.id) continue;

        try {
          const updatedDoc = await documentsService.getDocument(
            fileWithStatus.document.id,
            token
          );

          // Only update if status actually changed to avoid duplicate notifications
          if (
            updatedDoc.processing_status === 'completed' &&
            fileWithStatus.status === 'processing'
          ) {
            updateFileStatus(fileWithStatus.id, {
              status: 'completed',
              document: updatedDoc,
            });

            // Show completion notification
            toast({
              title: "PDF Processing Complete",
              description: `${fileWithStatus.file.name} has been processed and is ready to use.`,
              variant: "success",
            });
          } else if (
            updatedDoc.processing_status === 'failed' &&
            fileWithStatus.status === 'processing'
          ) {
            updateFileStatus(fileWithStatus.id, {
              status: 'failed',
              error: 'Processing failed. Please try uploading again.',
            });

            // Show failure notification
            toast({
              title: "PDF Processing Failed",
              description: `${fileWithStatus.file.name} failed to process. Please try uploading again.`,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error(
            `Failed to check status for document ${fileWithStatus.document.id}:`,
            error
          );
        }
      }
    };

    // Poll every 3 seconds
    const interval = setInterval(checkDocumentStatus, 3000);

    // Initial check
    checkDocumentStatus();

    return () => clearInterval(interval);
  }, [files, open, getToken, toast, updateFileStatus]);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: `"${file.name}" is not a PDF file. Only PDF files are allowed.` };
    }

    // Check file type
    if (file.type && file.type !== "application/pdf" && file.type !== "application/x-pdf") {
      return { valid: false, error: `"${file.name}" has invalid content type: ${file.type}` };
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum size is 50 MB.` 
      };
    }

    // Check minimum file size (10KB)
    const minSize = 10 * 1024; // 10KB
    if (file.size < minSize) {
      return { 
        valid: false, 
        error: `"${file.name}" is too small (${(file.size / 1024).toFixed(2)} KB). Minimum size is 10 KB.` 
      };
    }

    return { valid: true };
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: FileWithStatus[] = [];
    const invalidFiles: Array<{ name: string; error: string }> = [];

    Array.from(selectedFiles).forEach((file) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        invalidFiles.push({ name: file.name, error: validation.error || 'Invalid file' });
      } else {
        newFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: 'pending',
        });
      }
    });

    if (invalidFiles.length > 0) {
      const errorMessage = invalidFiles.map(f => `${f.name}: ${f.error}`).join('\n');
      alert(`The following files cannot be uploaded:\n${errorMessage}`);
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }

    // Reset input to allow selecting same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      // If we removed the currently uploading file, stop upload
      const removedIndex = prev.findIndex((f) => f.id === id);
      if (removedIndex === currentUploadIndex) {
        setCurrentUploadIndex(null);
        setIsUploading(false);
      }
      return updated;
    });
  };

  const processUploadQueue = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0 || isUploading) return;

    setIsUploading(true);
    const token = await getToken();
    
    if (!token) {
      alert("Please sign in to upload documents");
      setIsUploading(false);
      return;
    }

    // Process files sequentially
    for (let i = 0; i < pendingFiles.length; i++) {
      const fileWithStatus = pendingFiles[i];
      const fileIndex = files.findIndex((f) => f.id === fileWithStatus.id);
      
      setCurrentUploadIndex(fileIndex);
      updateFileStatus(fileWithStatus.id, { status: 'uploading' });

      try {
        const newDoc = await documentsService.uploadDocument(fileWithStatus.file, token);
        
        // Check if it's a duplicate
        const isDuplicate = newDoc.is_duplicate || false;
        
        updateFileStatus(fileWithStatus.id, {
          status: isDuplicate ? 'duplicate' : 'processing',
          document: newDoc,
        });

        if (!isDuplicate) {
          // Show success toast notification
          toast({
            title: "PDF Uploaded Successfully",
            description: `${fileWithStatus.file.name} has been uploaded and is being processed.`,
            variant: "success",
          });
          onUploadSuccess?.(newDoc);
        } else {
          // Show duplicate notification
          toast({
            title: "PDF Already Exists",
            description: `${fileWithStatus.file.name} was already uploaded previously.`,
            variant: "default",
          });
        }
      } catch (error: any) {
        // Parse error response for better error messages
        let errorMsg = "Failed to upload document";
        let errorDetails = "";

        if (error?.data) {
          errorMsg = error.data.error || error.data.detail || errorMsg;
          errorDetails = error.data.details || error.data.message || "";
        } else if (error?.message) {
          errorMsg = error.message;
        }

        // Combine error message and details
        const fullErrorMsg = errorDetails ? `${errorMsg}. ${errorDetails}` : errorMsg;
        
        const isDuplicateError = errorMsg.includes("already been uploaded") || 
                                errorMsg.includes("already exists") ||
                                errorMsg.includes("duplicate");
        
        updateFileStatus(fileWithStatus.id, {
          status: isDuplicateError ? 'duplicate' : 'failed',
          error: fullErrorMsg,
        });

        console.error("Upload error:", {
          file: fileWithStatus.file.name,
          error: error,
          errorData: error?.data,
          status: error?.status
        });
      }
    }

    setCurrentUploadIndex(null);
    setIsUploading(false);
  };

  const handleStartUpload = () => {
    processUploadQueue();
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;
  const processingCount = files.filter((f) => f.status === 'processing').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const duplicateCount = files.filter((f) => f.status === 'duplicate').length;
  const allDone = files.length > 0 && pendingCount === 0 && uploadingCount === 0 && processingCount === 0;

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
            <h3 className="text-lg font-semibold">Upload Documents</h3>
            {files.length > 0 && (
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
            disabled={isUploading && !allDone}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 mb-4">
          <div className="space-y-2">
            {files.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  disabled={isUploading}
                />
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Click to select PDF files</p>
                <p className="text-xs text-muted-foreground">You can select multiple files at once</p>
              </div>
            ) : (
              <>
                {files.map((fileWithStatus) => (
                  <div
                    key={fileWithStatus.id}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-lg transition-colors",
                      fileWithStatus.status === 'completed'
                        ? "bg-green-500/10 border-green-500/20"
                        : fileWithStatus.status === 'duplicate'
                        ? "bg-blue-500/10 border-blue-500/20"
                        : fileWithStatus.status === 'failed'
                        ? "bg-red-500/10 border-red-500/20"
                        : fileWithStatus.status === 'processing'
                        ? "bg-yellow-500/10 border-yellow-500/20"
                        : fileWithStatus.status === 'uploading'
                        ? "bg-yellow-500/10 border-yellow-500/20"
                        : "bg-secondary/50 border-border"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {fileWithStatus.status === 'uploading' || fileWithStatus.status === 'processing' ? (
                        <Loader2 className="h-5 w-5 animate-spin text-yellow-600 dark:text-yellow-400" />
                      ) : fileWithStatus.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : fileWithStatus.status === 'duplicate' ? (
                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : fileWithStatus.status === 'failed' ? (
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileWithStatus.file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {(fileWithStatus.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            fileWithStatus.status === 'completed'
                              ? "bg-green-500/20 text-green-600 dark:text-green-400"
                              : fileWithStatus.status === 'duplicate'
                              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                              : fileWithStatus.status === 'failed'
                              ? "bg-red-500/20 text-red-600 dark:text-red-400"
                              : fileWithStatus.status === 'processing'
                              ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                              : fileWithStatus.status === 'uploading'
                              ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                              : "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                          )}
                        >
                          {fileWithStatus.status}
                        </span>
                      </div>
                      {fileWithStatus.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {fileWithStatus.error}
                        </p>
                      )}
                    </div>
                    {fileWithStatus.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removeFile(fileWithStatus.id)}
                        disabled={isUploading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* Add more files button */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center p-3 border border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <Plus className="h-4 w-4 mr-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Add more files</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isUploading && !allDone}>
            {allDone ? 'Close' : 'Cancel'}
          </Button>
          {files.length > 0 && pendingCount > 0 && (
            <Button onClick={handleStartUpload} disabled={isUploading || pendingCount === 0}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
