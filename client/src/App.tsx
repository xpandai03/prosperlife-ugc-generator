import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navbar } from "@/components/ui/mini-navbar";
import HomePage from "@/pages/HomePage";
import VideoListPage from "@/pages/VideoListPage";
import VideoDetailPage from "@/pages/VideoDetailPage";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import SocialAccountsPage from "@/pages/settings/SocialAccountsPage";
import BillingSettingsPage from "@/pages/settings/BillingSettingsPage";
import CaptionSettingsPage from "@/pages/settings/CaptionSettingsPage";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
// import PricingPage from "@/pages/PricingPage"; // Hidden - credits system replaces subscription pricing
import AIStudioPage from "@/pages/AIStudioPage";
import ContentEnginePage from "@/pages/ContentEnginePage";
import ContentEngineVideoPage from "@/pages/ContentEngineVideoPage";
import ScheduleDashboard from "@/pages/ScheduleDashboard";
import BillingSuccessPage from "@/pages/billing/SuccessPage";
import BillingCancelPage from "@/pages/billing/CancelPage";
import PreLoginPage from "@/pages/PreLoginPage";
import AdminCreditsPage from "@/pages/admin/AdminCreditsPage";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  // Show navbar on all pages except public landing/auth pages
  const showNavbar = !["/welcome", "/auth/login", "/auth/signup"].includes(location);

  return (
    <>
      {showNavbar && <Navbar />}
      <Switch>
        {/* Welcome/Landing page - public */}
        <Route path="/welcome" component={PreLoginPage} />

        {/* Auth routes - public */}
        <Route path="/auth/login" component={LoginPage} />
        <Route path="/auth/signup" component={SignupPage} />

        {/* OAuth callback - public */}
        <Route path="/oauth-callback" component={OAuthCallbackPage} />

        {/* Pricing & Billing routes */}
        {/* Pricing page hidden - redirects to billing settings (credits system) */}
        <Route path="/pricing">
          <Redirect to="/settings/billing" />
        </Route>
        <Route path="/billing/success" component={BillingSuccessPage} />
        <Route path="/billing/cancel" component={BillingCancelPage} />

        {/* Protected routes - require authentication */}
        <Route path="/">
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        </Route>
        <Route path="/videos">
          <ProtectedRoute>
            <VideoListPage />
          </ProtectedRoute>
        </Route>
        <Route path="/ai-studio">
          <ProtectedRoute>
            <AIStudioPage />
          </ProtectedRoute>
        </Route>
        <Route path="/content-engine">
          <ProtectedRoute>
            <ContentEnginePage />
          </ProtectedRoute>
        </Route>
        <Route path="/content-engine/video/:id">
          <ProtectedRoute>
            <ContentEngineVideoPage />
          </ProtectedRoute>
        </Route>
        <Route path="/schedule">
          <ProtectedRoute>
            <ScheduleDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/details/:id">
          <ProtectedRoute>
            <VideoDetailPage />
          </ProtectedRoute>
        </Route>
        <Route path="/socials">
          <ProtectedRoute>
            <SocialAccountsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/settings/social-accounts">
          <ProtectedRoute>
            <SocialAccountsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/settings/billing">
          <ProtectedRoute>
            <BillingSettingsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/settings/caption-assistant">
          <ProtectedRoute>
            <CaptionSettingsPage />
          </ProtectedRoute>
        </Route>

        {/* Admin routes - protected, backend enforces admin check */}
        <Route path="/admin/credits">
          <ProtectedRoute>
            <AdminCreditsPage />
          </ProtectedRoute>
        </Route>

        {/* 404 */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </BrandProvider>
    </QueryClientProvider>
  );
}

export default App;
