import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Loader2, X, BookOpen, FileText, CreditCard } from "lucide-react";
import { documentsService } from "@/lib/api";
import { cn } from "@/lib/utils";

interface StudyMaterialsDialogProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
}

type MaterialType = "quiz" | "notes" | "flashcards" | null;

export default function StudyMaterialsDialog({
  open,
  onClose,
  documentId,
  documentTitle,
}: StudyMaterialsDialogProps) {
  const { getToken } = useAuth();
  const [selectedType, setSelectedType] = useState<MaterialType>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = async (type: MaterialType) => {
    if (!type) return;

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
      } else if (type === "notes") {
        data = await documentsService.generateNotes(documentId, "outline", token);
      } else if (type === "flashcards") {
        data = await documentsService.generateFlashcards(documentId, 20, token);
      }

      setGeneratedData(data);
      setSelectedType(type);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to generate study materials");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setGeneratedData(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      <div className="relative z-50 w-full max-w-2xl bg-card border border-border rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Generate Study Materials</h3>
            <p className="text-sm text-muted-foreground mt-1">{documentTitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClose}
            disabled={isGenerating}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!selectedType ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleGenerate("quiz")}
                disabled={isGenerating}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 border-2 border-border rounded-lg transition-all",
                  "hover:border-primary hover:bg-secondary/50",
                  isGenerating && "opacity-50 cursor-not-allowed"
                )}
              >
                <BookOpen className="h-8 w-8 text-primary" />
                <span className="font-medium">Generate Quiz</span>
                <span className="text-xs text-muted-foreground text-center">
                  Create quiz questions from this document
                </span>
              </button>

              <button
                onClick={() => handleGenerate("notes")}
                disabled={isGenerating}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 border-2 border-border rounded-lg transition-all",
                  "hover:border-primary hover:bg-secondary/50",
                  isGenerating && "opacity-50 cursor-not-allowed"
                )}
              >
                <FileText className="h-8 w-8 text-primary" />
                <span className="font-medium">Generate Notes</span>
                <span className="text-xs text-muted-foreground text-center">
                  Create structured notes from this document
                </span>
              </button>

              <button
                onClick={() => handleGenerate("flashcards")}
                disabled={isGenerating}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 border-2 border-border rounded-lg transition-all",
                  "hover:border-primary hover:bg-secondary/50",
                  isGenerating && "opacity-50 cursor-not-allowed"
                )}
              >
                <CreditCard className="h-8 w-8 text-primary" />
                <span className="font-medium">Generate Flashcards</span>
                <span className="text-xs text-muted-foreground text-center">
                  Create flashcards from this document
                </span>
              </button>
            </div>

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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold capitalize">{selectedType}</h4>
              <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                Back
              </Button>
            </div>

            {generatedData && (
              <div className="space-y-4">
                {selectedType === "quiz" && generatedData.quiz && (
                  <div className="space-y-4">
                    {generatedData.quiz.questions?.map((q: any, idx: number) => (
                      <div key={idx} className="p-4 border border-border rounded-lg">
                        <p className="font-medium mb-2">{idx + 1}. {q.question}</p>
                        {q.type === "multiple_choice" && q.options && (
                          <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                            {q.options.map((opt: string, optIdx: number) => (
                              <li key={optIdx}>{opt}</li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded">
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">
                            Answer: {q.correct_answer}
                          </p>
                          {q.explanation && (
                            <p className="text-xs text-muted-foreground mt-1">{q.explanation}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedType === "notes" && generatedData.notes && (
                  <div className="space-y-4">
                    {generatedData.notes.title && (
                      <h5 className="text-lg font-semibold mb-3">{generatedData.notes.title}</h5>
                    )}
                    {generatedData.notes.sections?.map((section: any, idx: number) => (
                      <div key={idx} className="p-4 border border-border rounded-lg bg-card">
                        <h6 className="font-medium mb-3 text-foreground">{section.heading}</h6>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {section.content}
                        </p>
                        {section.subsections && (
                          <div className="mt-3 ml-2 space-y-2 border-l-2 border-primary/20 pl-4">
                            {section.subsections.map((sub: any, subIdx: number) => (
                              <div key={subIdx} className="space-y-1">
                                <p className="font-medium text-sm text-foreground">{sub.heading}</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">{sub.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {generatedData.notes.key_points && generatedData.notes.key_points.length > 0 && (
                      <div className="p-4 border border-border rounded-lg bg-card">
                        <h6 className="font-medium mb-2 text-foreground">Key Points to Remember</h6>
                        <ul className="space-y-2">
                          {generatedData.notes.key_points.map((point: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed">
                              <span className="text-primary mt-1 shrink-0">•</span>
                              <span className="text-foreground flex-1">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {generatedData.notes.summary && (
                      <div className="p-4 border border-border rounded-lg bg-card bg-secondary/20">
                        <h6 className="font-medium mb-2 text-foreground">Quick Summary</h6>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {generatedData.notes.summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedType === "flashcards" && generatedData.flashcards && (
                  <div className="space-y-4">
                    {generatedData.flashcards.cards?.map((card: any, idx: number) => (
                      <div key={idx} className="p-4 border border-border rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-secondary/50 rounded">
                            <p className="text-xs text-muted-foreground mb-1">Front</p>
                            <p className="font-medium">{card.front}</p>
                          </div>
                          <div className="p-3 bg-primary/10 rounded">
                            <p className="text-xs text-muted-foreground mb-1">Back</p>
                            <p className="font-medium">{card.back}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

