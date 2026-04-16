import { useState } from "react";
import { Settings, BookOpen, Search, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Mode = "study" | "research" | "explore";

const modes: { mode: Mode; label: string; icon: React.ElementType }[] = [
  { mode: "study", label: "Study Mode", icon: BookOpen },
  { mode: "research", label: "Research Mode", icon: Search },
  { mode: "explore", label: "Explore Mode", icon: Compass },
];

export default function ModeSelector() {
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [open, setOpen] = useState(false);

  const handleModeSelect = (mode: Mode) => {
    setSelectedMode(mode);
    setOpen(false);
    // TODO: Apply mode logic here
    console.log("Selected mode:", mode);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-md border border-border hover:bg-secondary"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          {modes.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => handleModeSelect(mode)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                selectedMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

