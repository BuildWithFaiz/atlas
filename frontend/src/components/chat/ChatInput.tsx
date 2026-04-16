import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Globe, Send } from "lucide-react";
import UploadDialog from "@/components/documents/UploadDialog";
import ScrapeDialog from "@/components/documents/ScrapeDialog";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export default function ChatInput({ onSend, isLoading = false }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isScrapeDialogOpen, setIsScrapeDialogOpen] = useState(false);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput("");
    }
  };

  return (
    <>
      <div className="relative">
        <Input
          placeholder="Summarize the latest"
          className="h-14 pr-36 text-base pl-4 border-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isLoading}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <div className="flex items-center gap-0.5 text-xs text-muted-foreground mr-2 px-2 py-1">
            <span>{input.length}</span>
            <span>/</span>
            <span>3,000</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-secondary rounded-lg"
            title="Upload"
            onClick={() => setIsUploadDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-secondary rounded-lg"
            title="Web Scrape"
            onClick={() => setIsScrapeDialogOpen(true)}
          >
            <Globe className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-9 w-9 rounded-full bg-foreground text-background hover:bg-foreground/90 shrink-0 ml-1"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            title="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Atlas may generate inaccurate information about people, places, or facts. Model Atlas AI v1.0
      </p>

      <UploadDialog
        open={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
      />
      <ScrapeDialog
        open={isScrapeDialogOpen}
        onClose={() => setIsScrapeDialogOpen(false)}
      />
    </>
  );
}

