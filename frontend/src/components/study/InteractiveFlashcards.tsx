import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle, CheckCircle2, AlertCircle, FlipHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlashcardCard } from "@/lib/types/api";

interface InteractiveFlashcardsProps {
  cards: FlashcardCard[];
}

type CardStatus = 'known' | 'review' | 'unmarked';

export default function InteractiveFlashcards({ cards: initialCards }: InteractiveFlashcardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [cards, setCards] = useState<FlashcardCard[]>(initialCards);
  const [cardStatuses, setCardStatuses] = useState<Record<number, CardStatus>>({});
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  // Shuffle cards
  const shuffleCards = useCallback(() => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setShuffled(true);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [cards]);

  // Reset to original order
  const resetOrder = useCallback(() => {
    setCards(initialCards);
    setShuffled(false);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [initialCards]);

  // Handle shuffle toggle
  const handleShuffleToggle = () => {
    if (shuffled) {
      resetOrder();
    } else {
      shuffleCards();
    }
  };

  // Navigate to previous card
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(flippedCards.has(currentIndex - 1));
    }
  };

  // Navigate to next card
  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(flippedCards.has(currentIndex + 1));
    }
  };

  // Flip card
  const handleFlip = () => {
    setIsFlipped((prev) => {
      const newFlipped = !prev;
      if (newFlipped) {
        setFlippedCards((prevSet) => new Set(prevSet).add(currentIndex));
      }
      return newFlipped;
    });
  };

  // Mark card as known
  const handleMarkKnown = () => {
    setCardStatuses((prev) => ({
      ...prev,
      [currentIndex]: 'known',
    }));
  };

  // Mark card as need review
  const handleMarkReview = () => {
    setCardStatuses((prev) => ({
      ...prev,
      [currentIndex]: 'review',
    }));
  };

  // Reset card status
  const handleUnmark = () => {
    setCardStatuses((prev) => {
      const newStatuses = { ...prev };
      delete newStatuses[currentIndex];
      return newStatuses;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          handleFlip();
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          handleMarkKnown();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleMarkReview();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          handleShuffleToggle();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, cards.length, shuffled]);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(flippedCards.has(currentIndex));
  }, [currentIndex, flippedCards]);

  const currentCard = cards[currentIndex];
  const currentStatus = cardStatuses[currentIndex] || 'unmarked';
  const progress = ((currentIndex + 1) / cards.length) * 100;
  const knownCount = Object.values(cardStatuses).filter((s) => s === 'known').length;
  const reviewCount = Object.values(cardStatuses).filter((s) => s === 'review').length;
  const unmarkedCount = cards.length - knownCount - reviewCount;

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Header Controls */}
      <div className="bg-secondary/30 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShuffleToggle}
              className={cn(
                "flex items-center gap-2 transition-all",
                shuffled && "border-primary bg-primary/10 text-primary"
              )}
            >
              <Shuffle className={cn("h-4 w-4", shuffled && "text-primary")} />
              {shuffled ? "Shuffled" : "Shuffle"}
            </Button>
            {shuffled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetOrder}
                className="flex items-center gap-2 hover:bg-secondary"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="px-3 py-1.5 bg-card rounded-md border border-border font-medium">
                Card {currentIndex + 1} <span className="text-muted-foreground">/ {cards.length}</span>
              </div>
              <div className="w-40 h-2.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-md border border-green-500/20">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="font-medium text-green-700 dark:text-green-300">{knownCount} Known</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 rounded-md border border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="font-medium text-yellow-700 dark:text-yellow-300">{reviewCount} Review</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md border border-border">
            <span className="font-medium text-muted-foreground">{unmarkedCount} Unmarked</span>
          </div>
        </div>
      </div>

      {/* Card Container - Fullscreen */}
      <div className="flex-1 flex items-center justify-center min-h-[500px] mb-8 px-4">
        <div
          className="relative w-full max-w-4xl perspective-1000"
          style={{ perspective: '1000px' }}
        >
          {/* Card Aspect Ratio: 16:10 (rectangular) */}
          <div
            className="relative w-full preserve-3d transition-transform duration-500 cursor-pointer"
            style={{
              paddingBottom: '62.5%', // 16:10 aspect ratio (10/16 = 0.625)
              transformStyle: 'preserve-3d',
            }}
            onClick={handleFlip}
          >
            <div
              className={cn(
                "absolute inset-0 preserve-3d transition-transform duration-500",
                isFlipped && "rotate-y-180"
              )}
              style={{
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Front of Card */}
              <div
                className={cn(
                  "absolute inset-0 backface-hidden rounded-xl border-2 bg-gradient-to-br from-card to-secondary/30 p-10 flex flex-col items-center justify-center shadow-xl",
                  "border-border hover:border-primary/50 transition-colors",
                  !isFlipped ? "z-10" : "z-0"
                )}
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                }}
              >
                <div className="text-center space-y-6 w-full max-w-3xl">
                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    <div className="w-2 h-2 rounded-full bg-primary/40"></div>
                    Front
                  </div>
                  <div className="text-3xl md:text-4xl font-bold break-words leading-tight text-foreground">
                    {currentCard.front}
                  </div>
                  <div className="mt-12 pt-6 border-t border-border/50">
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <FlipHorizontal className="h-3 w-3" />
                      Click or press Space to reveal answer
                    </div>
                  </div>
                </div>
              </div>

              {/* Back of Card */}
              <div
                className={cn(
                  "absolute inset-0 backface-hidden rounded-xl border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/20 p-10 flex flex-col items-center justify-center shadow-xl",
                  "border-primary/30 hover:border-primary/50 transition-colors",
                  isFlipped ? "z-10" : "z-0"
                )}
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="text-center space-y-6 w-full max-w-3xl">
                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-primary/70 uppercase tracking-wider mb-2">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    Answer
                  </div>
                  <div className="text-3xl md:text-4xl font-bold break-words leading-tight text-foreground">
                    {currentCard.back}
                  </div>
                  <div className="mt-12 pt-6 border-t border-primary/20">
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <FlipHorizontal className="h-3 w-3" />
                      Click or press Space to flip back
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation and Actions */}
      <div className="space-y-6">
        {/* Navigation Buttons */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 min-w-[120px] disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </Button>

          <Button
            variant="default"
            size="lg"
            onClick={handleFlip}
            className="flex items-center gap-2 min-w-[140px] bg-primary hover:bg-primary/90"
          >
            <FlipHorizontal className="h-4 w-4" />
            Flip Card
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleNext}
            disabled={currentIndex === cards.length - 1}
            className="flex items-center gap-2 min-w-[120px] disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Marking Buttons */}
        <div className="flex items-center justify-center gap-3">
          {currentStatus === 'known' ? (
            <Button
              variant="outline"
              size="lg"
              onClick={handleUnmark}
              className="flex items-center gap-2 border-2 border-green-500 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
            >
              <CheckCircle2 className="h-5 w-5" />
              Marked as Known
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              onClick={handleMarkKnown}
              className="flex items-center gap-2 hover:border-green-500 hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400 transition-all"
            >
              <CheckCircle2 className="h-5 w-5" />
              Mark as Known
            </Button>
          )}

          {currentStatus === 'review' ? (
            <Button
              variant="outline"
              size="lg"
              onClick={handleUnmark}
              className="flex items-center gap-2 border-2 border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20"
            >
              <AlertCircle className="h-5 w-5" />
              Marked for Review
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              onClick={handleMarkReview}
              className="flex items-center gap-2 hover:border-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-600 dark:hover:text-yellow-400 transition-all"
            >
              <AlertCircle className="h-5 w-5" />
              Need Review
            </Button>
          )}
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-lg border border-border/50">
            <span className="text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">←</kbd> <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">→</kbd> Navigate
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">Space</kbd> Flip
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">K</kbd> Known
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">R</kbd> Review
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">S</kbd> Shuffle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

