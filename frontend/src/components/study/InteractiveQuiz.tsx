import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestion, QuizResults, QuizAnswer } from "@/lib/types/api";

interface InteractiveQuizProps {
  questions: QuizQuestion[];
  onComplete?: (results: QuizResults) => void;
}

export default function InteractiveQuiz({ questions, onComplete }: InteractiveQuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  useEffect(() => {
    // Reset state when questions change
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setSelectedAnswer("");
    setIsSubmitted(false);
    setShowResults(false);
    setQuizResults(null);
  }, [questions]);

  useEffect(() => {
    // Load previously selected answer if user navigated back
    const previousAnswer = userAnswers[currentQuestionIndex];
    if (previousAnswer) {
      setSelectedAnswer(previousAnswer);
      setIsSubmitted(true);
    } else {
      setSelectedAnswer("");
      setIsSubmitted(false);
    }
  }, [currentQuestionIndex, userAnswers]);

  const handleAnswerSelect = (answer: string) => {
    if (!isSubmitted) {
      setSelectedAnswer(answer);
    }
  };

  const handleSubmit = () => {
    if (!selectedAnswer.trim()) {
      return;
    }

    // Save answer
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: selectedAnswer,
    }));

    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Calculate results
      const answers: QuizAnswer[] = questions.map((q, idx) => {
        const userAnswer = userAnswers[idx] || "";
        const isCorrect = userAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
        return {
          questionIndex: idx,
          userAnswer,
          isCorrect,
          correctAnswer: q.correct_answer,
          explanation: q.explanation,
        };
      });

      const correctCount = answers.filter((a) => a.isCorrect).length;
      const results: QuizResults = {
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        percentage: Math.round((correctCount / questions.length) * 100),
        answers,
      };

      setQuizResults(results);
      setShowResults(true);
      onComplete?.(results);
    } else {
      // Move to next question
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer("");
      setIsSubmitted(false);
    }
  };

  const handleRetake = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setSelectedAnswer("");
    setIsSubmitted(false);
    setShowResults(false);
    setQuizResults(null);
  };

  const isCorrect = isSubmitted && selectedAnswer.toLowerCase().trim() === currentQuestion.correct_answer.toLowerCase().trim();

  if (showResults && quizResults) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
          <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
          <div className="text-4xl font-bold text-primary mb-2">
            {quizResults.correctAnswers}/{quizResults.totalQuestions}
          </div>
          <p className="text-xl text-muted-foreground">
            {quizResults.percentage}% Correct
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Review Your Answers</h3>
          {quizResults.answers.map((answer, idx) => {
            const question = questions[idx];
            return (
              <div
                key={idx}
                className={cn(
                  "p-6 border rounded-lg",
                  answer.isCorrect
                    ? "bg-green-500/10 border-green-500/20"
                    : "bg-red-500/10 border-red-500/20"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="font-semibold text-lg">
                    {idx + 1}. {question.question}
                  </p>
                  {answer.isCorrect ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500 shrink-0" />
                  )}
                </div>

                {question.type === "multiple_choice" && question.options && (
                  <div className="space-y-2 mb-4">
                    {question.options.map((opt, optIdx) => {
                      const isUserAnswer = opt === answer.userAnswer;
                      const isCorrect = opt === answer.correctAnswer;
                      return (
                        <div
                          key={optIdx}
                          className={cn(
                            "p-3 rounded border",
                            isCorrect && "bg-green-500/20 border-green-500",
                            isUserAnswer && !isCorrect && "bg-red-500/20 border-red-500",
                            !isCorrect && !isUserAnswer && "bg-secondary border-border"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {isUserAnswer && !isCorrect && <XCircle className="h-4 w-4 text-red-500" />}
                            <span className={cn(
                              isCorrect && "font-semibold text-green-700 dark:text-green-400",
                              isUserAnswer && !isCorrect && "font-semibold text-red-700 dark:text-red-400"
                            )}>
                              {opt}
                            </span>
                            {isCorrect && <span className="text-xs text-muted-foreground ml-auto">Correct</span>}
                            {isUserAnswer && !isCorrect && <span className="text-xs text-muted-foreground ml-auto">Your Answer</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {question.type !== "multiple_choice" && (
                  <div className="space-y-2 mb-4">
                    <div className="p-3 rounded border bg-secondary">
                      <span className="text-sm text-muted-foreground">Your Answer: </span>
                      <span className={cn(
                        "font-medium",
                        answer.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                      )}>
                        {answer.userAnswer || "No answer provided"}
                      </span>
                    </div>
                    {!answer.isCorrect && (
                      <div className="p-3 rounded border bg-green-500/20 border-green-500">
                        <span className="text-sm text-muted-foreground">Correct Answer: </span>
                        <span className="font-medium text-green-700 dark:text-green-400">
                          {answer.correctAnswer}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {answer.explanation && (
                  <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                      Explanation:
                    </p>
                    <p className="text-sm text-muted-foreground">{answer.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-4">
          <Button onClick={handleRetake} size="lg">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake Quiz
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="p-6 border border-border rounded-lg bg-card">
        <h3 className="text-xl font-semibold mb-6">
          {currentQuestion.question}
        </h3>

        {/* Answer Options */}
        {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOption = option === currentQuestion.correct_answer;
              const showFeedback = isSubmitted;

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={isSubmitted}
                  className={cn(
                    "w-full p-4 text-left border-2 rounded-lg transition-all",
                    "hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary",
                    isSelected && !showFeedback && "border-primary bg-primary/10",
                    showFeedback && isCorrectOption && "border-green-500 bg-green-500/10",
                    showFeedback && isSelected && !isCorrectOption && "border-red-500 bg-red-500/10",
                    isSubmitted && !isSelected && !isCorrectOption && "opacity-50 cursor-not-allowed",
                    !isSubmitted && "cursor-pointer"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected && !showFeedback && "border-primary bg-primary",
                        showFeedback && isCorrectOption && "border-green-500 bg-green-500",
                        showFeedback && isSelected && !isCorrectOption && "border-red-500 bg-red-500",
                        !isSelected && !showFeedback && "border-border"
                      )}
                    >
                      {isSelected && (
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          showFeedback && isCorrectOption && "bg-white",
                          showFeedback && !isCorrectOption && "bg-white",
                          !showFeedback && "bg-primary-foreground"
                        )} />
                      )}
                    </div>
                    <span className="flex-1">{option}</span>
                    {showFeedback && isCorrectOption && (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    )}
                    {showFeedback && isSelected && !isCorrectOption && (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === "short_answer" && (
          <div className="space-y-4">
            <textarea
              value={selectedAnswer}
              onChange={(e) => handleAnswerSelect(e.target.value)}
              disabled={isSubmitted}
              placeholder="Type your answer here..."
              className={cn(
                "w-full p-4 border-2 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary",
                isSubmitted && isCorrect && "border-green-500 bg-green-500/10",
                isSubmitted && !isCorrect && "border-red-500 bg-red-500/10",
                !isSubmitted && "border-border",
                isSubmitted && "cursor-not-allowed"
              )}
              rows={4}
            />
          </div>
        )}

        {currentQuestion.type === "true_false" && (
          <div className="space-y-3">
            {["True", "False"].map((option) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOption = option === currentQuestion.correct_answer;
              const showFeedback = isSubmitted;

              return (
                <button
                  key={option}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={isSubmitted}
                  className={cn(
                    "w-full p-4 text-left border-2 rounded-lg transition-all",
                    "hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary",
                    isSelected && !showFeedback && "border-primary bg-primary/10",
                    showFeedback && isCorrectOption && "border-green-500 bg-green-500/10",
                    showFeedback && isSelected && !isCorrectOption && "border-red-500 bg-red-500/10",
                    isSubmitted && !isSelected && !isCorrectOption && "opacity-50 cursor-not-allowed",
                    !isSubmitted && "cursor-pointer"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected && !showFeedback && "border-primary bg-primary",
                        showFeedback && isCorrectOption && "border-green-500 bg-green-500",
                        showFeedback && isSelected && !isCorrectOption && "border-red-500 bg-red-500",
                        !isSelected && !showFeedback && "border-border"
                      )}
                    >
                      {isSelected && (
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          showFeedback && isCorrectOption && "bg-white",
                          showFeedback && !isCorrectOption && "bg-white",
                          !showFeedback && "bg-primary-foreground"
                        )} />
                      )}
                    </div>
                    <span className="flex-1 font-medium">{option}</span>
                    {showFeedback && isCorrectOption && (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    )}
                    {showFeedback && isSelected && !isCorrectOption && (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Feedback */}
        {isSubmitted && (
          <div
            className={cn(
              "mt-4 p-4 rounded-lg border",
              isCorrect
                ? "bg-green-500/10 border-green-500/20"
                : "bg-red-500/10 border-red-500/20"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    Correct!
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    Incorrect
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Correct answer: <span className="font-medium">{currentQuestion.correct_answer}</span>
            </p>
            {currentQuestion.explanation && (
              <p className="text-sm text-muted-foreground mt-2">
                {currentQuestion.explanation}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>

          {!isSubmitted ? (
            <Button
              onClick={handleSubmit}
              disabled={!selectedAnswer.trim()}
              size="lg"
            >
              Submit Answer
            </Button>
          ) : (
            <Button onClick={handleNext} size="lg">
              {isLastQuestion ? "View Results" : "Next Question"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

