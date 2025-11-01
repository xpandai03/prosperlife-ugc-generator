import { useState } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ensureSessionReady } from "@/lib/supabase";

interface UserData {
  id: string;
  email: string;
  subscriptionStatus: string;
  stripeCustomerId?: string;
  subscriptionEndsAt?: string;
}

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Fetch user data to check subscription status
  const { data: userData, isLoading: userLoading } = useQuery<UserData>({
    queryKey: ["/api/user"],
    enabled: !!user,
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

      // Mobile Fix: Ensure session is fully synced before making API call
      if (isMobile) {
        console.log('[Mobile Debug] Pre-checkout session verification', {
          timestamp: new Date().toISOString(),
        });

        const session = await ensureSessionReady(3, 300);
        if (!session) {
          throw new Error('Session not ready. Please wait a moment and try again.');
        }

        console.log('[Mobile Debug] Session verified, proceeding to checkout', {
          userId: session.user.id,
          timestamp: new Date().toISOString(),
        });
      }

      const response = await apiRequest("POST", "/api/stripe/create-checkout-session");
      return await response.json();
    },
    onSuccess: (data: { success: boolean; url: string; sessionId: string }) => {
      if (data.success && data.url) {
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
          console.log('[Mobile Debug] Checkout session created, redirecting to Stripe', {
            sessionId: data.sessionId,
            timestamp: new Date().toISOString(),
          });
        }
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile) {
        console.error('[Mobile Debug] Checkout error', {
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
      setIsUpgrading(false);
    },
  });

  const handleUpgrade = () => {
    if (!user) {
      setLocation("/login");
      return;
    }

    if (userData?.subscriptionStatus === "pro") {
      toast({
        title: "Already Subscribed",
        description: "You already have an active Pro subscription.",
      });
      return;
    }

    setIsUpgrading(true);
    upgradeMutation.mutate();
  };

  const isPro = userData?.subscriptionStatus === "pro";
  const loading = authLoading || userLoading;

  return (
    <div className="min-h-screen bg-black pt-24 pb-12 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 mb-4">
            <Sparkles className="h-8 w-8 text-blue-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Start for free, upgrade anytime. Get unlimited video processing and social media posting with Pro.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Free Tier */}
          <Card className="relative bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Free</CardTitle>
              <CardDescription className="text-gray-400">Perfect for trying out the platform</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-gray-400 ml-2">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-white">3 video conversions per month</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-white">3 social media posts per month</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-white">AI-powered clip selection</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-white">Virality score ranking</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400">Unlimited processing</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400">Priority support</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full mt-6"
                disabled={!isPro && !!user}
              >
                {!user ? "Sign Up Free" : isPro ? "Current Plan" : "Current Plan"}
              </Button>
            </CardContent>
          </Card>

          {/* Pro Tier */}
          <Card className="relative border-blue-500 shadow-lg bg-white/5">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
              Most Popular
            </div>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2 text-white">
                Pro
                <Zap className="h-5 w-5 text-blue-500" />
              </CardTitle>
              <CardDescription className="text-gray-400">For power users and content creators</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">$29</span>
                <span className="text-gray-400 ml-2">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="font-medium text-white">Unlimited video conversions</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="font-medium text-white">Unlimited social media posts</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-white">AI-powered clip selection</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-white">Virality score ranking</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-white">Auto-export to Instagram, TikTok & YouTube</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-white">Priority support</span>
                </div>
              </div>
              <Button
                className="w-full mt-6"
                onClick={handleUpgrade}
                disabled={loading || isUpgrading || isPro}
              >
                {loading ? (
                  "Loading..."
                ) : isPro ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Active Subscription
                  </>
                ) : isUpgrading ? (
                  "Redirecting to checkout..."
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Upgrade to Pro
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-white">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-white">Can I cancel anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  Yes! You can cancel your Pro subscription at any time from your billing settings.
                  You'll continue to have Pro access until the end of your billing period.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-white">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  We accept all major credit cards (Visa, Mastercard, American Express) through our secure
                  payment processor, Stripe.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-white">How do monthly limits work?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  Free tier limits reset on the 1st of each month. Your usage counter shows how many videos
                  and posts you've created in the current month. Pro users have unlimited access with no monthly limits.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-white">What happens if I downgrade from Pro?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  If you cancel your Pro subscription, you'll be moved to the Free tier at the end of your billing period.
                  Your existing videos and posts will remain accessible, but you'll be subject to the 3 videos/3 posts
                  per month limit going forward.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
