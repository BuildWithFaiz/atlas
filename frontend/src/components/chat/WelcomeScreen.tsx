import QuickActions from "./QuickActions";
import { FileText, Sparkles, User, Code } from "lucide-react";



export default function WelcomeScreen() {
  return (
    <div className="text-center py-20">
      <h2 className="text-6xl font-bold mb-5 tracking-tight">Welcome to Atlas</h2>
      <p className="text-lg text-muted-foreground mb-14 max-w-2xl mx-auto leading-relaxed">
        Get started by asking a question and Chat can do the rest. Not sure where to start?
      </p>
     
    </div>
  );
}

