import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, SignUp } from "@clerk/clerk-react";
import LandingPage from "./pages/LandingPage";
import ChatPage from "./pages/ChatPage";
import StudyMaterialsPage from "./pages/StudyMaterialsPage";
import StudyMaterialsListPage from "./pages/StudyMaterialsListPage";
import DocumentsPreviewPage from "./pages/DocumentsPreviewPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <SignedOut>
                <LandingPage />
              </SignedOut>
              <SignedIn>
                <Navigate to="/chat" replace />
              </SignedIn>
            </>
          }
        />
        <Route
          path="/sign-in/*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-background">
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                afterSignInUrl="/chat"
              />
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-background">
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                afterSignUpUrl="/chat"
              />
            </div>
          }
        />
        <Route
          path="/chat"
          element={
            <SignedIn>
              <ChatPage />
            </SignedIn>
          }
        />
        <Route
          path="/study"
          element={
            <SignedIn>
              <StudyMaterialsListPage />
            </SignedIn>
          }
        />
        <Route
          path="/study/:documentId"
          element={
            <SignedIn>
              <StudyMaterialsPage />
            </SignedIn>
          }
        />
        <Route
          path="/documents"
          element={
            <SignedIn>
              <DocumentsPreviewPage />
            </SignedIn>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
