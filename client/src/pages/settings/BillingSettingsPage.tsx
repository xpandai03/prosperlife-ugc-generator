/**
 * BillingSettingsPage (Phase 9: XPAND Credits)
 *
 * Manages credit balance, purchase packages, and transaction history
 */

import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  CreditCard,
  History,
  ExternalLink,
  Loader2,
  Check,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CreditBalanceData {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  perCredit: number;
}

interface CreditTransaction {
  id: string;
  amount: number;
  balanceAfter: number;
  featureKey: string | null;
  description: string;
  createdAt: string;
}

export default function BillingSettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  // Fetch credit balance
  const { data: creditData, isLoading: creditsLoading } = useQuery<CreditBalanceData>({
    queryKey: ["/api/credits"],
    enabled: !!user,
  });

  // Fetch available packages
  const { data: packagesData } = useQuery<{ packages: CreditPackage[] }>({
    queryKey: ["/api/credits/packages"],
    enabled: !!user,
  });

  // Fetch transaction history
  const { data: historyData, isLoading: historyLoading } = useQuery<{ transactions: CreditTransaction[] }>({
    queryKey: ["/api/credits/history"],
    enabled: !!user,
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await apiRequest("POST", "/api/credits/purchase", { packageId });
      return await response.json();
    },
    onSuccess: (data: { success: boolean; url: string }) => {
      if (data.success && data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
      setSelectedPackage(null);
    },
  });

  const handlePurchase = (packageId: string) => {
    setSelectedPackage(packageId);
    purchaseMutation.mutate(packageId);
  };

  const packages = packagesData?.packages || [];
  const transactions = historyData?.transactions || [];
  const balance = creditData?.balance ?? 0;

  // Highlight best value package
  const bestValuePackage = "pro"; // 1500 credits

  return (
    <div className="min-h-screen bg-black pt-24 pb-8 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Credits & Billing</h1>
            <p className="text-gray-400 mt-1">
              Purchase credits to use Streamline AI features
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>

        {/* Credit Balance Card */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Coins className="h-6 w-6 text-yellow-500" />
                  Your Credit Balance
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Use credits for AI video generation, social posting, and more
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {creditsLoading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading balance...</span>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <div className="text-4xl font-bold text-yellow-500">
                    {balance.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Available Credits</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-semibold text-green-500">
                    {creditData?.lifetimePurchased?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Total Purchased</div>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <div className="text-2xl font-semibold text-blue-500">
                    {creditData?.lifetimeUsed?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Total Used</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Packages */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CreditCard className="h-5 w-5" />
              Buy Credit Packs
            </CardTitle>
            <CardDescription className="text-gray-400">
              Choose a pack that fits your needs. Credits never expire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative rounded-xl p-5 border transition-all ${
                    pkg.id === bestValuePackage
                      ? "bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/50"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  {pkg.id === bestValuePackage && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Best Value
                    </Badge>
                  )}
                  <div className="text-center space-y-3">
                    <h3 className="font-semibold text-white text-lg">{pkg.name}</h3>
                    <div>
                      <span className="text-3xl font-bold text-white">{pkg.credits.toLocaleString()}</span>
                      <span className="text-gray-400 text-sm ml-1">credits</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      ${pkg.priceUsd.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      ${pkg.perCredit.toFixed(3)}/credit
                    </div>
                    <Button
                      className={`w-full ${
                        pkg.id === bestValuePackage
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                          : ""
                      }`}
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending && selectedPackage === pkg.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Buy Now
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              Secure payment powered by Stripe. Credits are added instantly after purchase.
            </p>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <History className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription className="text-gray-400">
              Your recent credit transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center gap-2 text-gray-400 py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading history...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm mt-1">Purchase credits to get started</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {transactions.slice(0, 20).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 px-4 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          tx.amount > 0
                            ? "bg-green-500/20 text-green-500"
                            : "bg-red-500/20 text-red-500"
                        }`}
                      >
                        {tx.amount > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <Coins className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{tx.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          tx.amount > 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        Balance: {tx.balanceAfter.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature Pricing Info */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">What Can You Do With Credits?</CardTitle>
            <CardDescription className="text-gray-400">
              Credit costs for different features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">UGC Ad (Premium Quality)</span>
                  <span className="font-medium text-white">70 credits</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">UGC Ad (Fast)</span>
                  <span className="font-medium text-white">35 credits</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">UGC Ad (Sora2)</span>
                  <span className="font-medium text-white">18 credits</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">Video to Shorts (Full)</span>
                  <span className="font-medium text-white">100 credits</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">Video Processing</span>
                  <span className="font-medium text-white">31 credits</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">Social Media Post</span>
                  <span className="font-medium text-white">11 credits</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">AI Image Generation</span>
                  <span className="font-medium text-white">3-6 credits</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">AI Caption</span>
                  <span className="font-medium text-white">1 credit</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
