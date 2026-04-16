import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { CLERK_PUBLISHABLE_KEY } from "./lib/constants";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn("Missing Clerk Publishable Key. Authentication will not work.");
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ClerkProvider>
);
