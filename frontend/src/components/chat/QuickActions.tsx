import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  onActionClick?: (action: QuickAction) => void;
}

export default function QuickActions({ actions, onActionClick }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-4xl mx-auto">
      {actions.map((action, idx) => {
        const Icon = action.icon;
        return (
          <button
            key={idx}
            onClick={() => onActionClick?.(action)}
            className={cn(
              "flex flex-col items-center justify-center gap-4 p-8 rounded-2xl transition-all group relative overflow-hidden cursor-pointer",
              action.color,
              "hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98]"
            )}
          >
            <div className="p-3.5 rounded-xl bg-white shadow-lg">
              <Icon className="h-6 w-6 text-gray-800" />
            </div>
            <span className="text-base font-semibold text-white">{action.label}</span>
            <div className="absolute top-4 right-4 opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="p-1.5 rounded-md bg-white/30 backdrop-blur-sm">
                <Plus className="h-4 w-4 text-white" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

