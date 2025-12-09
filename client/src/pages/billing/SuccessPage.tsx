/**
 * SuccessPage (Phase 9: XPAND Credits)
 *
 * Shown after successful credit purchase via Stripe
 */

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, Settings, Coins, Loader2 } from "lucide-react";

interface CreditBalanceData {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
}

export default function SuccessPage() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(8);
  const queryClient = useQueryClient();

  // Fetch updated credit balance
  const { data: creditData, isLoading } = useQuery<CreditBalanceData>({
    queryKey: ["/api/credits"],
    refetchInterval: 2000, // Poll every 2 seconds to catch webhook update
  });

  // Invalidate and refetch credits on mount
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
    queryClient.invalidateQueries({ queryKey: ["/api/credits/history"] });
  }, [queryClient]);

  useEffect(() => {
    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Card className="border-green-500/20">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-3xl mb-2">Payment Successful!</CardTitle>
            <CardDescription className="text-lg">
              Your credits have been added to your account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Credit Balance Display */}
            <div className="rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 p-6">
              <div className="flex items-center justify-center gap-3">
                <Coins className="h-8 w-8 text-yellow-500" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Your New Balance</p>
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : (
                    <p className="text-4xl font-bold text-yellow-500">
                      {creditData?.balance?.toLocaleString() ?? "..."} credits
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* What's Next */}
            <div className="rounded-lg bg-muted p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                What Can You Do Now?
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Generate AI-powered UGC ads for your products
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Convert long videos into viral shorts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Post directly to Instagram, TikTok & YouTube
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Generate AI images and captions
                </li>
              </ul>
            </div>

            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Redirecting to home in <span className="font-semibold text-foreground">{countdown}</span> seconds...
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                className="flex-1"
              >
                <Link href="/">
                  <Home className="h-4 w-4 mr-2" />
                  Start Creating
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="flex-1"
              >
                <Link href="/settings/billing">
                  <Settings className="h-4 w-4 mr-2" />
                  View Billing
                </Link>
              </Button>
            </div>

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <p className="text-sm text-center">
                <strong className="text-blue-600 dark:text-blue-400">Pro tip:</strong>{" "}
                <span className="text-muted-foreground">
                  Credits never expire! Use them at your own pace to create amazing content.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
