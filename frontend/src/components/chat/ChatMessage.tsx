import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { ChatMessage as ChatMessageType } from "@/lib/types/api";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex gap-4 max-w-3xl", isUser && "flex-row-reverse")}>
        <div className="flex-shrink-0">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              isUser ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </div>
        </div>
        <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
          <div
            className={cn(
              "rounded-lg px-4 py-3",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none 
                prose-headings:font-semibold prose-headings:text-foreground
                prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
                prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2
                prose-p:leading-relaxed prose-p:my-3
                prose-ul:my-3 prose-ul:space-y-1.5
                prose-ol:my-3 prose-ol:space-y-1.5
                prose-li:my-1 prose-li:leading-relaxed
                prose-strong:text-foreground prose-strong:font-semibold
                prose-code:text-sm prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono
                prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:overflow-x-auto
                prose-hr:my-6 prose-hr:border-border
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:bg-secondary/50 prose-blockquote:py-2 prose-blockquote:my-4
                prose-table:w-full prose-table:my-4 prose-table:border-collapse
                prose-thead:bg-secondary prose-thead:border-b prose-thead:border-border
                prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:border prose-th:border-border
                prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-border
                prose-tr:hover:bg-secondary/50 prose-tr:transition-colors
                prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.citations.map((citation, idx) => (
                <div
                  key={idx}
                  className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded"
                >
                  Source {idx + 1}
                  {citation.page && ` (Page ${citation.page})`}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

