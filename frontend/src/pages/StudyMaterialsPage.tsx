import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, BookOpen, FileText, CreditCard, RefreshCw } from "lucide-react";
import { documentsService } from "@/lib/api";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import InteractiveQuiz from "@/components/study/InteractiveQuiz";
import InteractiveFlashcards from "@/components/study/InteractiveFlashcards";

type MaterialType = "quiz" | "notes" | "flashcards" | null;

export default function StudyMaterialsPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [document, setDocument] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<MaterialType>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocument();
  }, [documentId, getToken]);

  // Check URL parameter for material type when component mounts or type changes
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam && (typeParam === 'quiz' || typeParam === 'notes' || typeParam === 'flashcards')) {
      setSelectedType(typeParam);
      // Load the material if document is already loaded
      if (document) {
        loadMaterial(typeParam);
      }
    }
  }, [searchParams, document]);

  const loadDocument = async () => {
    if (!documentId) return;
    
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        navigate("/sign-in");
        return;
      }

      const doc = await documentsService.getDocument(documentId, token);
      setDocument(doc);
      
      // Check if URL has a type parameter
      const typeParam = searchParams.get('type');
      if (typeParam && (typeParam === 'quiz' || typeParam === 'notes' || typeParam === 'flashcards')) {
        // Load the specific material type from URL
        await loadMaterial(typeParam);
      } else {
        // Try to load existing materials (quiz, notes, flashcards) - prioritize quiz
        try {
          const quiz = await documentsService.getQuiz(documentId, token);
          if (quiz) {
            setGeneratedData({ quiz: quiz.content });
            setSelectedType("quiz");
            return;
          }
        } catch {
          // No existing quiz
        }
        
        try {
          const notes = await documentsService.getNotes(documentId, token);
          if (notes) {
            setGeneratedData({ notes: notes.content });
            setSelectedType("notes");
            return;
          }
        } catch {
          // No existing notes
        }
        
        try {
          const flashcards = await documentsService.getFlashcards(documentId, token);
          if (flashcards) {
            setGeneratedData({ flashcards: flashcards.content });
            setSelectedType("flashcards");
            return;
          }
        } catch {
          // No existing flashcards
        }
      }
    } catch (err: any) {
      setError(err?.data?.error || "Failed to load document");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMaterial = async (type: "quiz" | "notes" | "flashcards") => {
    if (!documentId) return;
    
    try {
      const token = await getToken();
      if (!token) return;

      if (type === "quiz") {
        const quiz = await documentsService.getQuiz(documentId, token);
        if (quiz) {
          setGeneratedData({ quiz: quiz.content });
          setSelectedType("quiz");
        }
      } else if (type === "notes") {
        const notes = await documentsService.getNotes(documentId, token);
        if (notes) {
          setGeneratedData({ notes: notes.content });
          setSelectedType("notes");
        }
      } else if (type === "flashcards") {
        const flashcards = await documentsService.getFlashcards(documentId, token);
        if (flashcards) {
          setGeneratedData({ flashcards: flashcards.content });
          setSelectedType("flashcards");
        }
      }
    } catch (error) {
      console.error(`Failed to load ${type}:`, error);
      // If material doesn't exist, don't set selectedType so user can generate it
    }
  };

  const handleGenerate = async (type: MaterialType) => {
    if (!type || !documentId) return;

    try {
      setIsGenerating(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        setError("Please sign in to generate study materials");
        return;
      }

      let data;
      if (type === "quiz") {
        data = await documentsService.generateQuiz(documentId, 10, token);
        setGeneratedData({ quiz: data.quiz });
      } else if (type === "notes") {
        data = await documentsService.generateNotes(documentId, "outline", token);
        setGeneratedData({ notes: data.notes });
      } else if (type === "flashcards") {
        data = await documentsService.generateFlashcards(documentId, 20, token);
        setGeneratedData({ flashcards: data.flashcards });
      }

      setSelectedType(type);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to generate study materials");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    if (selectedType) {
      setGeneratedData(null);
      handleGenerate(selectedType);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Document not found</p>
          <Button onClick={() => navigate("/chat")}>Go Back</Button>
        </div>
      </div>
    );
  }

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
        <div className="px-8 py-6 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/chat")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Study Materials</h1>
              <p className="text-sm text-muted-foreground">{document.title || document.filename}</p>
            </div>
          </div>
          {selectedType && generatedData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isGenerating}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
              Regenerate
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-6">
            {!selectedType ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <h2 className="text-2xl font-semibold mb-2">Generate Study Materials</h2>
                  <p className="text-muted-foreground">
                    Choose a type of study material to generate from this document
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button
                    onClick={() => handleGenerate("quiz")}
                    disabled={isGenerating || document.processing_status !== "completed"}
                    className={cn(
                      "flex flex-col items-center gap-4 p-8 border-2 border-border rounded-lg transition-all",
                      "hover:border-primary hover:bg-secondary/50",
                      (isGenerating || document.processing_status !== "completed") && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <BookOpen className="h-12 w-12 text-primary" />
                    <span className="font-semibold text-lg">Generate Quiz</span>
                    <span className="text-sm text-muted-foreground text-center">
                      Create quiz questions from this document
                    </span>
                  </button>

                  <button
                    onClick={() => handleGenerate("notes")}
                    disabled={isGenerating || document.processing_status !== "completed"}
                    className={cn(
                      "flex flex-col items-center gap-4 p-8 border-2 border-border rounded-lg transition-all",
                      "hover:border-primary hover:bg-secondary/50",
                      (isGenerating || document.processing_status !== "completed") && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <FileText className="h-12 w-12 text-primary" />
                    <span className="font-semibold text-lg">Generate Notes</span>
                    <span className="text-sm text-muted-foreground text-center">
                      Create structured notes from this document
                    </span>
                  </button>

                  <button
                    onClick={() => handleGenerate("flashcards")}
                    disabled={isGenerating || document.processing_status !== "completed"}
                    className={cn(
                      "flex flex-col items-center gap-4 p-8 border-2 border-border rounded-lg transition-all",
                      "hover:border-primary hover:bg-secondary/50",
                      (isGenerating || document.processing_status !== "completed") && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <CreditCard className="h-12 w-12 text-primary" />
                    <span className="font-semibold text-lg">Generate Flashcards</span>
                    <span className="text-sm text-muted-foreground text-center">
                      Create flashcards from this document
                    </span>
                  </button>
                </div>

                {document.processing_status !== "completed" && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Document is still processing. Please wait until processing is complete.
                    </p>
                  </div>
                )}

                {isGenerating && (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Generating study materials...</span>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Quiz Display */}
                {selectedType === "quiz" && generatedData?.quiz && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-semibold">Interactive Quiz</h2>
                      <Button variant="outline" size="sm" onClick={() => setSelectedType(null)}>
                        Back
                      </Button>
                    </div>
                    <InteractiveQuiz
                      questions={generatedData.quiz.questions || []}
                      onComplete={(results) => {
                        console.log("Quiz completed:", results);
                      }}
                    />
                  </div>
                )}

                {/* Notes Display */}
                {selectedType === "notes" && generatedData?.notes && (
                  <div className="space-y-6 max-w-4xl">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-semibold">Study Notes</h2>
                      <Button variant="outline" size="sm" onClick={() => setSelectedType(null)}>
                        Back
                      </Button>
                    </div>
                    {generatedData.notes.title && (
                      <h3 className="text-xl font-semibold mb-2">{generatedData.notes.title}</h3>
                    )}
                    {generatedData.notes.sections?.map((section: any, idx: number) => (
                      <div key={idx} className="p-6 border border-border rounded-lg bg-card shadow-sm">
                        <h4 className="font-semibold text-lg mb-4 text-foreground">{section.heading}</h4>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="text-foreground leading-relaxed whitespace-pre-wrap mb-4 text-base">
                            {section.content}
                          </p>
                        </div>
                        {section.subsections && (
                          <div className="mt-5 ml-2 space-y-4 border-l-2 border-primary/30 pl-5">
                            {section.subsections.map((sub: any, subIdx: number) => (
                              <div key={subIdx} className="space-y-1">
                                <p className="font-medium text-base text-foreground">{sub.heading}</p>
                                <p className="text-muted-foreground leading-relaxed text-sm mt-1">
                                  {sub.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {generatedData.notes.key_points && generatedData.notes.key_points.length > 0 && (
                      <div className="p-6 border border-border rounded-lg bg-card shadow-sm">
                        <h4 className="font-semibold text-lg mb-4 text-foreground">Key Points to Remember</h4>
                        <ul className="space-y-3">
                          {generatedData.notes.key_points.map((point: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-3 text-base leading-relaxed">
                              <span className="text-primary mt-1.5 shrink-0">•</span>
                              <span className="text-foreground flex-1">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {generatedData.notes.summary && (
                      <div className="p-6 border border-border rounded-lg bg-card shadow-sm bg-secondary/20">
                        <h4 className="font-semibold text-lg mb-3 text-foreground">Quick Summary</h4>
                        <p className="text-foreground leading-relaxed whitespace-pre-wrap text-base">
                          {generatedData.notes.summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Flashcards Display */}
                {selectedType === "flashcards" && generatedData?.flashcards && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-semibold">Interactive Flashcards</h2>
                      <Button variant="outline" size="sm" onClick={() => setSelectedType(null)}>
                        Back
                      </Button>
                    </div>
                    <InteractiveFlashcards
                      cards={generatedData.flashcards.cards || []}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

