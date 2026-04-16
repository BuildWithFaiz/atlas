import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, FileText, CreditCard, CheckCircle2, XCircle, Clock } from "lucide-react";
import { documentsService } from "@/lib/api";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import type { Document } from "@/lib/types/api";

interface DocumentWithMaterials extends Document {
  hasQuiz?: boolean;
  hasNotes?: boolean;
  hasFlashcards?: boolean;
}

export default function StudyMaterialsListPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [documents, setDocuments] = useState<DocumentWithMaterials[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingFor, setGeneratingFor] = useState<{ docId: string; type: string } | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [getToken]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        navigate("/sign-in");
        return;
      }

      const userDocs = await documentsService.listUserDocuments(token);
      
      // Check which materials exist for each document
      const docsWithMaterials = await Promise.all(
        userDocs.map(async (doc) => {
          const docWithMaterials: DocumentWithMaterials = { ...doc };
          
          if (doc.processing_status === "completed") {
            try {
              await documentsService.getQuiz(doc.id, token);
              docWithMaterials.hasQuiz = true;
            } catch {
              docWithMaterials.hasQuiz = false;
            }
            
            try {
              await documentsService.getNotes(doc.id, token);
              docWithMaterials.hasNotes = true;
            } catch {
              docWithMaterials.hasNotes = false;
            }
            
            try {
              await documentsService.getFlashcards(doc.id, token);
              docWithMaterials.hasFlashcards = true;
            } catch {
              docWithMaterials.hasFlashcards = false;
            }
          }
          
          return docWithMaterials;
        })
      );
      
      setDocuments(docsWithMaterials);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewMaterial = (documentId: string, type: "quiz" | "notes" | "flashcards") => {
    navigate(`/study/${documentId}?type=${type}`);
  };

  const handleGenerateMaterial = async (documentId: string, type: "quiz" | "notes" | "flashcards") => {
    try {
      setGeneratingFor({ docId: documentId, type });
      const token = await getToken();
      if (!token) return;

      if (type === "quiz") {
        await documentsService.generateQuiz(documentId, 10, token);
      } else if (type === "notes") {
        await documentsService.generateNotes(documentId, "outline", token);
      } else if (type === "flashcards") {
        await documentsService.generateFlashcards(documentId, 20, token);
      }

      // Reload to update material status
      await loadDocuments();
    } catch (error: any) {
      console.error("Failed to generate material:", error);
      alert(error?.data?.error || error?.message || "Failed to generate study material");
    } finally {
      setGeneratingFor(null);
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Study Materials</h1>
          <p className="text-sm text-muted-foreground">
            Generate and access quizzes, notes, and flashcards from your documents
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
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No documents found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Upload documents to start generating study materials
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {documents.map((doc) => {
                  const isGenerating = generatingFor?.docId === doc.id;
                  const generatingType = generatingFor?.type;

                  return (
                    <div
                      key={doc.id}
                      className="bg-card border border-border rounded-xl p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20 flex flex-col"
                    >
                      {/* Document Header */}
                      <div className="mb-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-foreground mb-2 truncate">
                              {doc.title || doc.filename}
                            </h3>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                              <span>Uploaded {formatDate(doc.created_at)}</span>
                              {doc.processing_status !== "completed" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs font-medium w-fit">
                                  <Clock className="h-3 w-3" />
                                  {doc.processing_status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Study Materials - Stacked Vertically */}
                      {doc.processing_status === "completed" ? (
                        <div className="flex flex-col gap-4 flex-1">
                          {/* Quiz Card */}
                          <div className={cn(
                            "relative border rounded-lg p-4 transition-all",
                            doc.hasQuiz 
                              ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10" 
                              : "border-border bg-card hover:border-primary/30 hover:bg-accent/50"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors shrink-0",
                                doc.hasQuiz 
                                  ? "bg-green-500/20 text-green-600 dark:text-green-400" 
                                  : "bg-primary/10 text-primary"
                              )}>
                                <BookOpen className="h-5 w-5" />
                              </div>
                              
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-foreground">Quiz</span>
                                  {doc.hasQuiz ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                                
                                {doc.hasQuiz ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8 shrink-0"
                                    onClick={() => handleViewMaterial(doc.id, "quiz")}
                                  >
                                    View
                                  </Button>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="text-xs h-8 shrink-0"
                                    onClick={() => handleGenerateMaterial(doc.id, "quiz")}
                                    disabled={isGenerating}
                                  >
                                    {isGenerating && generatingType === "quiz" ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      "Generate"
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Notes Card */}
                          <div className={cn(
                            "relative border rounded-lg p-4 transition-all",
                            doc.hasNotes 
                              ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10" 
                              : "border-border bg-card hover:border-primary/30 hover:bg-accent/50"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors shrink-0",
                                doc.hasNotes 
                                  ? "bg-green-500/20 text-green-600 dark:text-green-400" 
                                  : "bg-primary/10 text-primary"
                              )}>
                                <FileText className="h-5 w-5" />
                              </div>
                              
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-foreground">Notes</span>
                                  {doc.hasNotes ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                                
                                {doc.hasNotes ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8 shrink-0"
                                    onClick={() => handleViewMaterial(doc.id, "notes")}
                                  >
                                    View
                                  </Button>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="text-xs h-8 shrink-0"
                                    onClick={() => handleGenerateMaterial(doc.id, "notes")}
                                    disabled={isGenerating}
                                  >
                                    {isGenerating && generatingType === "notes" ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      "Generate"
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Flashcards Card */}
                          <div className={cn(
                            "relative border rounded-lg p-4 transition-all",
                            doc.hasFlashcards 
                              ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10" 
                              : "border-border bg-card hover:border-primary/30 hover:bg-accent/50"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors shrink-0",
                                doc.hasFlashcards 
                                  ? "bg-green-500/20 text-green-600 dark:text-green-400" 
                                  : "bg-primary/10 text-primary"
                              )}>
                                <CreditCard className="h-5 w-5" />
                              </div>
                              
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-foreground">Flashcards</span>
                                  {doc.hasFlashcards ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                                
                                {doc.hasFlashcards ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8 shrink-0"
                                    onClick={() => handleViewMaterial(doc.id, "flashcards")}
                                  >
                                    View
                                  </Button>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="text-xs h-8 shrink-0"
                                    onClick={() => handleGenerateMaterial(doc.id, "flashcards")}
                                    disabled={isGenerating}
                                  >
                                    {isGenerating && generatingType === "flashcards" ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      "Generate"
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                            Document is still processing. Study materials will be available once processing is complete.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
