import { useState, useEffect, useRef } from "react";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Upload,
  MessageSquare,
  Search,
  BookOpen,
  FileText,
  CheckCircle2,
  ArrowRight,
  Brain,
  Layers,
  Menu,
  X,
} from "lucide-react";

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      
      // Detect active section for navigation highlighting
      const sections = ["features", "how-it-works", "benefits"];
      const scrollPosition = window.scrollY + 100;
      
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    // Intersection Observer for fade-in animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" }
    );

    const sections = ["features", "how-it-works", "benefits"];
    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (element) observer.observe(element);
    });

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial call

    return () => {
      window.removeEventListener("scroll", handleScroll);
      sections.forEach((sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) observer.unobserve(element);
      });
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setIsMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { label: "Features", id: "features" },
    { label: "How It Works", id: "how-it-works" },
    { label: "Benefits", id: "benefits" },
  ];
  const features = [
    {
      icon: Upload,
      title: "Upload & Process PDFs",
      description:
        "Upload your PDF documents and let AI automatically extract, chunk, and process the content. Track processing status in real-time.",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: MessageSquare,
      title: "AI-Powered Chat",
      description:
        "Ask questions about your documents and get structured, educational responses with key points, detailed explanations, and examples.",
      color: "text-green-600 dark:text-green-400",
    },
    {
      icon: Search,
      title: "Hybrid Search",
      description:
        "Find information using semantic search, keyword matching, and TF-IDF scoring. Search across all your documents instantly.",
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      icon: BookOpen,
      title: "Study Materials",
      description:
        "Generate interactive study materials including quizzes, flashcards, and structured notes from your documents.",
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      icon: Brain,
      title: "Structured AI Responses",
      description:
        "Get well-organized answers with summaries, key points, step-by-step explanations, and practical examples.",
      color: "text-pink-600 dark:text-pink-400",
    },
    {
      icon: Layers,
      title: "Document Management",
      description:
        "Organize, view, and manage all your documents. Track processing status, view summaries, and access your knowledge base.",
      color: "text-indigo-600 dark:text-indigo-400",
    },
  ];

  const benefits = [
    "Transform PDFs into searchable knowledge bases",
    "Get instant, accurate answers from your documents",
    "Create study materials automatically",
    "Organize conversations and chat history",
    "Access your documents from anywhere",
    "Privacy-focused with user-specific document storage",
  ];

  const howItWorks = [
    {
      step: "1",
      title: "Upload Documents",
      description: "Upload your PDF files. Our AI automatically extracts and processes the content.",
    },
    {
      step: "2",
      title: "AI Processing",
      description: "Documents are chunked, embedded, and indexed for fast retrieval and search.",
    },
    {
      step: "3",
      title: "Ask Questions",
      description: "Chat with your documents using natural language. Get structured, educational responses.",
    },
    {
      step: "4",
      title: "Study & Learn",
      description: "Generate quizzes, flashcards, and notes to enhance your learning experience.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/10">
      {/* Creative Navbar */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled
            ? "bg-background/80 backdrop-blur-md border-b border-border shadow-lg"
            : "bg-transparent"
        )}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2 group"
            >
              <div className="grid grid-cols-3 gap-1 w-8 h-8 md:w-10 md:h-10 transition-transform group-hover:scale-110">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-primary transition-all group-hover:bg-primary/80"
                  />
                ))}
              </div>
              <span className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Atlas
              </span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative group",
                    activeSection === link.id
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                  <span
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-all duration-300",
                      activeSection === link.id
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100"
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Auth Buttons - Desktop */}
            <div className="hidden md:flex items-center gap-3">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm" className="relative overflow-hidden group">
                  <span className="relative z-10">Get Started</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                </Button>
              </SignUpButton>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          <div
            className={cn(
              "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
              isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="py-4 space-y-2 border-t border-border mt-2">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    activeSection === link.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-4 space-y-2 border-t border-border">
                <SignInButton mode="modal">
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button className="w-full justify-start" size="sm">
                    Get Started
                  </Button>
                </SignUpButton>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div id="hero" className="container mx-auto px-4 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Side - Text Content */}
          <div className="space-y-8 text-center lg:text-left animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-6">
              <div className="flex flex-col items-center lg:items-start gap-4 mb-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium text-primary">AI-Powered Document Intelligence</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-3 gap-1 w-10 h-10">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary" />
                    ))}
                  </div>
                  <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Atlas
                  </h1>
                </div>
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Your AI-Powered{" "}
                <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                  Document Assistant
                </span>
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed font-light">
                Transform your documents into an intelligent knowledge base. Ask questions, get structured answers, and create study materials with AI-powered insights.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-6">
              <SignUpButton mode="modal">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 py-6 h-auto font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 py-6 h-auto font-semibold border-2 hover:bg-accent/50 transition-all duration-300">
                  Sign In
                </Button>
              </SignInButton>
            </div>
          </div>

          {/* Right Side - Screenshot */}
          <div className="relative lg:order-2 animate-in fade-in slide-in-from-right-4 duration-700 delay-150">
            <div className="relative rounded-3xl overflow-hidden border border-border/50 shadow-2xl bg-card/50 backdrop-blur-sm group hover:shadow-3xl transition-all duration-500">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
              {/* Decorative glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />
              {/* Image with subtle hover effect */}
              <div className="relative overflow-hidden rounded-3xl">
                <img
                  src="/Screenshot 2025-12-22 160642.png"
                  alt="Atlas AI Workspace - Chat Interface showing AI-powered document assistant in action"
                  className="w-full h-auto object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="container mx-auto px-4 py-24 md:py-32 scroll-mt-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Powerful Features
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to work with your documents intelligently
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isVisible = visibleSections.has("features");
            return (
              <div
                key={index}
                className={cn(
                  "group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:bg-card hover:shadow-xl transition-all duration-300 overflow-hidden",
                  isVisible ? "animate-in fade-in slide-in-from-bottom-4" : "opacity-0",
                )}
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
              >
                {/* Background gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className={`${feature.color} mb-5 inline-flex p-3 rounded-xl bg-primary/5 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="container mx-auto px-4 py-24 md:py-32 scroll-mt-20">
        <div className="relative bg-gradient-to-br from-secondary/40 via-secondary/20 to-background rounded-3xl p-12 md:p-16 border border-border/50">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Simple steps to unlock the power of your documents
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {howItWorks.map((item, index) => {
              const isVisible = visibleSections.has("how-it-works");
              return (
              <div
                key={index}
                className={cn(
                  "group text-center space-y-5 relative",
                  isVisible ? "animate-in fade-in slide-in-from-bottom-4" : "opacity-0",
                )}
                style={{ animationDelay: `${index * 150}ms`, animationFillMode: "forwards" }}
              >
                {/* Connecting line for desktop */}
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary/30 via-primary/20 to-transparent -translate-x-1/2 translate-y-1/2" />
                )}
                <div className="relative inline-flex">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-3xl font-bold mx-auto shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                    {item.step}
                  </div>
                  <div className="absolute -inset-1 bg-primary/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h3 className="text-xl font-bold mt-6 group-hover:text-primary transition-colors duration-300">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {item.description}
                </p>
              </div>
            );
            })}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div id="benefits" className="container mx-auto px-4 py-24 md:py-32 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Why Choose Atlas?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the future of document interaction
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => {
              const isVisible = visibleSections.has("benefits");
              return (
                <div
                  key={index}
                  className={cn(
                    "group flex items-start gap-4 p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:bg-card hover:shadow-lg transition-all duration-300",
                    isVisible ? "animate-in fade-in slide-in-from-left-4" : "opacity-0",
                  )}
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-base font-medium leading-relaxed pt-1.5">{benefit}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="container mx-auto px-4 py-12 md:py-16 border-t border-border/50 mt-24">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="grid grid-cols-3 gap-1 w-8 h-8">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary/60"
                />
              ))}
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Atlas
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Atlas AI Assistant. Built with AI-powered document intelligence.
          </p>
        </div>
      </div>
    </div>
  );
}
