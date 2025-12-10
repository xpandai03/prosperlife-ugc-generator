/**
 * AdminCreditsPage - Admin dashboard for managing credit pricing and Stripe settings
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Home,
  Coins,
  Loader2,
  Save,
  RefreshCw,
  CreditCard,
  Key,
  Pencil,
  X,
  Check,
  Palette,
} from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CreditPricing {
  id: string;
  featureKey: string;
  featureName: string;
  baseCostUsd: string;
  creditCost: number;
  isActive: boolean;
}

interface GlobalSettings {
  markupFactor: string;
  pricePerCreditUsd: string;
}

interface StripeSettings {
  id?: string;
  publishableKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
  // Credit package price IDs (Updated Dec 2025 - 5 tiers)
  priceIdStarter: string | null;   // 500 credits - $9.99
  priceIdBasic: string | null;     // 1,500 credits - $24.99
  priceIdPro: string | null;       // 5,000 credits - $69.99
  priceIdAgency: string | null;    // 12,000 credits - $149.99
  priceIdEnterprise: string | null; // 30,000 credits - $349.99
  priceIdBusiness: string | null;  // Legacy
}

export default function AdminCreditsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { appName: currentAppName, refetch: refetchBrand } = useBrand();
  const [editingFeature, setEditingFeature] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [brandAppName, setBrandAppName] = useState<string>('');

  // Stripe settings form state
  const [stripeForm, setStripeForm] = useState<StripeSettings>({
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    priceIdStarter: '',
    priceIdBasic: '',
    priceIdPro: '',
    priceIdAgency: '',
    priceIdEnterprise: '',
    priceIdBusiness: '',
  });

  // Fetch pricing data
  const { data: pricingData, isLoading: pricingLoading } = useQuery<{ pricing: CreditPricing[] }>({
    queryKey: ["/api/admin/credits/pricing"],
  });

  // Fetch global settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery<{ settings: GlobalSettings }>({
    queryKey: ["/api/admin/credits/settings"],
  });

  // Update pricing mutation
  const updatePricingMutation = useMutation({
    mutationFn: async ({ featureKey, creditCost }: { featureKey: string; creditCost: number }) => {
      const response = await apiRequest("PUT", `/api/admin/credits/pricing/${featureKey}`, { creditCost });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credits/pricing"] });
      toast({ title: "Pricing updated", description: "Credit cost saved successfully." });
      setEditingFeature(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pricing",
        variant: "destructive",
      });
    },
  });

  // Fetch Stripe settings
  const { data: stripeData, isLoading: stripeLoading } = useQuery<{ settings: StripeSettings | null }>({
    queryKey: ["/api/admin/stripe"],
  });

  // Fetch brand settings
  const { data: brandData, isLoading: brandLoading } = useQuery<{ appName: string }>({
    queryKey: ["/api/admin/brand"],
  });

  // Update brand settings mutation
  const updateBrandMutation = useMutation({
    mutationFn: async (appName: string) => {
      const response = await apiRequest("PUT", "/api/admin/brand", { appName });
      return response.json();
    },
    onSuccess: async (data) => {
      console.log('[Admin] Brand update success:', data);
      // Invalidate queries first
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/brand"] });
      // Then refetch global brand context (this updates navbar)
      await refetchBrand();
      console.log('[Admin] Brand context refetched, new appName should be:', data.appName);
      toast({ title: "Brand updated", description: `App name changed to "${data.appName}"` });
    },
    onError: (error: any) => {
      console.error('[Admin] Brand update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update brand settings",
        variant: "destructive",
      });
    },
  });

  // Update Stripe settings mutation
  const updateStripeMutation = useMutation({
    mutationFn: async (settings: StripeSettings) => {
      const response = await apiRequest("PUT", "/api/admin/stripe", settings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe"] });
      toast({ title: "Stripe settings saved", description: "Your Stripe configuration has been updated." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save Stripe settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = (featureKey: string) => {
    updatePricingMutation.mutate({ featureKey, creditCost: editValue });
  };

  const startEditing = (feature: CreditPricing) => {
    setEditingFeature(feature.featureKey);
    setEditValue(feature.creditCost);
  };

  const cancelEditing = () => {
    setEditingFeature(null);
    setEditValue(0);
  };

  const handleStripeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateStripeMutation.mutate(stripeForm);
  };

  // Populate stripe form when data loads
  const stripeSettings = stripeData?.settings;
  useEffect(() => {
    if (stripeSettings && !stripeLoading) {
      setStripeForm({
        publishableKey: stripeSettings.publishableKey || '',
        secretKey: stripeSettings.secretKey || '',
        webhookSecret: stripeSettings.webhookSecret || '',
        priceIdStarter: stripeSettings.priceIdStarter || '',
        priceIdBasic: stripeSettings.priceIdBasic || '',
        priceIdPro: stripeSettings.priceIdPro || '',
        priceIdAgency: stripeSettings.priceIdAgency || '',
        priceIdEnterprise: stripeSettings.priceIdEnterprise || '',
        priceIdBusiness: stripeSettings.priceIdBusiness || '',
      });
    }
  }, [stripeSettings, stripeLoading]);

  // Populate brand form when data loads
  useEffect(() => {
    if (brandData && !brandLoading) {
      setBrandAppName(brandData.appName || 'Streamline');
    }
  }, [brandData, brandLoading]);

  const handleBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBrandMutation.mutate(brandAppName);
  };

  const pricing = pricingData?.pricing || [];
  const settings = settingsData?.settings;

  return (
    <div className="min-h-screen bg-black pt-24 pb-8 px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-amber-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-400 mt-1">
                Manage credit pricing and Stripe settings
              </p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <Home className="h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>

        {/* Tabs for Credit Pricing and Stripe Settings */}
        <Tabs defaultValue="pricing" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 rounded-lg p-1">
            <TabsTrigger
              value="pricing"
              className="text-white data-[state=active]:bg-white/15 data-[state=active]:text-yellow-400 data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-white/10 rounded-md px-4 py-2 transition-all"
            >
              <Coins className="h-4 w-4 mr-2" />
              Credit Pricing
            </TabsTrigger>
            <TabsTrigger
              value="stripe"
              className="text-white data-[state=active]:bg-white/15 data-[state=active]:text-yellow-400 data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-white/10 rounded-md px-4 py-2 transition-all"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Stripe Settings
            </TabsTrigger>
            <TabsTrigger
              value="branding"
              className="text-white data-[state=active]:bg-white/15 data-[state=active]:text-yellow-400 data-[state=inactive]:text-white/70 data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-white/10 rounded-md px-4 py-2 transition-all"
            >
              <Palette className="h-4 w-4 mr-2" />
              Branding
            </TabsTrigger>
          </TabsList>

          {/* Credit Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6 mt-6">
            {/* Global Settings */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Coins className="h-5 w-5 text-yellow-500" />
                  Global Settings
                </CardTitle>
                <CardDescription className="text-gray-400">
                  System-wide credit configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                {settingsLoading ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading settings...
                  </div>
                ) : settings ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-sm text-gray-400">Markup Factor</p>
                      <p className="text-xl font-semibold text-white">{settings.markupFactor}x</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-sm text-gray-400">Price per Credit</p>
                      <p className="text-xl font-semibold text-white">${settings.pricePerCreditUsd}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">No settings found</p>
                )}
              </CardContent>
            </Card>

            {/* Feature Pricing Table */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Feature Pricing</CardTitle>
                    <CardDescription className="text-gray-400">
                      Click Edit to modify credit costs for each feature
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/credits/pricing"] })}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pricingLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading pricing...
                  </div>
                ) : pricing.length === 0 ? (
                  <p className="text-gray-400 py-8 text-center">No pricing data found</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-4 py-2 px-4 text-sm font-medium text-gray-400 border-b border-white/10">
                      <div>Feature</div>
                      <div>Base Cost (USD)</div>
                      <div>Credits</div>
                      <div>Actions</div>
                    </div>
                    {pricing.map((feature) => {
                      const isEditing = editingFeature === feature.featureKey;
                      return (
                        <div
                          key={feature.featureKey}
                          className={`grid grid-cols-4 gap-4 py-3 px-4 rounded-lg items-center transition-all ${
                            isEditing
                              ? 'bg-white/10 border border-yellow-500/40'
                              : 'bg-white/5 hover:bg-white/8'
                          }`}
                        >
                          <div>
                            <p className="text-white font-medium">{feature.featureName}</p>
                            <p className="text-xs text-white/50">{feature.featureKey}</p>
                          </div>
                          <div className="text-white">${feature.baseCostUsd}</div>
                          <div>
                            {isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                value={editValue}
                                onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                className="w-24 bg-white/10 border-yellow-500/50 text-white focus:border-yellow-400"
                                autoFocus
                              />
                            ) : (
                              <span className="text-yellow-400 font-semibold text-lg">{feature.creditCost}</span>
                            )}
                          </div>
                          <div>
                            {isEditing ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleSave(feature.featureKey)}
                                  disabled={updatePricingMutation.isPending}
                                >
                                  {updatePricingMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="h-4 w-4 mr-1" />
                                      Save
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  disabled={updatePricingMutation.isPending}
                                  className="border-red-500/50 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditing(feature)}
                                className="border-yellow-500/50 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                              >
                                <Pencil className="h-4 w-4 mr-1 text-yellow-400" />
                                Edit
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stripe Settings Tab */}
          <TabsContent value="stripe" className="space-y-6 mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Key className="h-5 w-5 text-purple-500" />
                  Stripe API Keys
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Configure your Stripe account credentials. Leave empty to use environment variables.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stripeLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading Stripe settings...
                  </div>
                ) : (
                  <form onSubmit={handleStripeSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="publishableKey" className="text-gray-300">
                          Publishable Key
                        </Label>
                        <Input
                          id="publishableKey"
                          type="text"
                          placeholder="pk_live_..."
                          value={stripeForm.publishableKey || ''}
                          onChange={(e) => setStripeForm({ ...stripeForm, publishableKey: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secretKey" className="text-gray-300">
                          Secret Key
                        </Label>
                        <Input
                          id="secretKey"
                          type="password"
                          placeholder="sk_live_..."
                          value={stripeForm.secretKey || ''}
                          onChange={(e) => setStripeForm({ ...stripeForm, secretKey: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="webhookSecret" className="text-gray-300">
                        Webhook Secret
                      </Label>
                      <Input
                        id="webhookSecret"
                        type="password"
                        placeholder="whsec_..."
                        value={stripeForm.webhookSecret || ''}
                        onChange={(e) => setStripeForm({ ...stripeForm, webhookSecret: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="border-t border-white/10 pt-6">
                      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Credit Package Price IDs (5 Tiers - Dec 2025)
                      </h4>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="priceIdStarter" className="text-gray-300">
                            Starter (500 credits - $9.99)
                          </Label>
                          <Input
                            id="priceIdStarter"
                            type="text"
                            placeholder="price_..."
                            value={stripeForm.priceIdStarter || ''}
                            onChange={(e) => setStripeForm({ ...stripeForm, priceIdStarter: e.target.value })}
                            className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priceIdBasic" className="text-gray-300">
                            Basic (1,500 credits - $24.99)
                          </Label>
                          <Input
                            id="priceIdBasic"
                            type="text"
                            placeholder="price_..."
                            value={stripeForm.priceIdBasic || ''}
                            onChange={(e) => setStripeForm({ ...stripeForm, priceIdBasic: e.target.value })}
                            className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priceIdPro" className="text-gray-300">
                            Pro (5,000 credits - $69.99)
                          </Label>
                          <Input
                            id="priceIdPro"
                            type="text"
                            placeholder="price_..."
                            value={stripeForm.priceIdPro || ''}
                            onChange={(e) => setStripeForm({ ...stripeForm, priceIdPro: e.target.value })}
                            className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priceIdAgency" className="text-gray-300">
                            Agency (12,000 credits - $149.99)
                            <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Best Value</span>
                          </Label>
                          <Input
                            id="priceIdAgency"
                            type="text"
                            placeholder="price_..."
                            value={stripeForm.priceIdAgency || ''}
                            onChange={(e) => setStripeForm({ ...stripeForm, priceIdAgency: e.target.value })}
                            className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priceIdEnterprise" className="text-gray-300">
                            Enterprise (30,000 credits - $349.99)
                            <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">High Volume</span>
                          </Label>
                          <Input
                            id="priceIdEnterprise"
                            type="text"
                            placeholder="price_..."
                            value={stripeForm.priceIdEnterprise || ''}
                            onChange={(e) => setStripeForm({ ...stripeForm, priceIdEnterprise: e.target.value })}
                            className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priceIdBusiness" className="text-gray-300 text-gray-500">
                            Business (Legacy)
                          </Label>
                          <Input
                            id="priceIdBusiness"
                            type="text"
                            placeholder="price_..."
                            value={stripeForm.priceIdBusiness || ''}
                            onChange={(e) => setStripeForm({ ...stripeForm, priceIdBusiness: e.target.value })}
                            className="bg-white/5 border-white/20 text-white/50 placeholder:text-gray-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button
                        type="submit"
                        disabled={updateStripeMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {updateStripeMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Stripe Settings
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 mt-4">
                      <p className="text-sm text-blue-300">
                        <strong>Note:</strong> If these fields are left empty, the system will use the environment variables
                        (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, etc.) as fallback.
                      </p>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6 mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Palette className="h-5 w-5 text-pink-500" />
                  App Branding
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Customize the app name that appears throughout the application.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {brandLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading brand settings...
                  </div>
                ) : (
                  <form onSubmit={handleBrandSubmit} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="appName" className="text-gray-300">
                          App Name
                        </Label>
                        <Input
                          id="appName"
                          type="text"
                          placeholder="Streamline"
                          value={brandAppName}
                          onChange={(e) => setBrandAppName(e.target.value)}
                          maxLength={50}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 max-w-md"
                        />
                        <p className="text-xs text-gray-500">
                          This name will appear in the navbar and throughout the app. Max 50 characters.
                        </p>
                      </div>

                      <div className="p-4 bg-white/5 rounded-lg max-w-md">
                        <p className="text-sm text-gray-400 mb-2">Current app name:</p>
                        <p className="text-xl font-semibold text-white">{currentAppName}</p>
                      </div>
                    </div>

                    <div className="flex justify-start pt-4">
                      <Button
                        type="submit"
                        disabled={updateBrandMutation.isPending || brandAppName.trim() === '' || brandAppName === currentAppName}
                        className="bg-pink-600 hover:bg-pink-700"
                      >
                        {updateBrandMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save App Name
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="rounded-lg bg-pink-500/10 border border-pink-500/20 p-4 mt-4">
                      <p className="text-sm text-pink-300">
                        <strong>White-label:</strong> Changes take effect immediately across the entire application
                        without requiring a rebuild or restart.
                      </p>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
