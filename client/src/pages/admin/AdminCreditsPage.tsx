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
} from "lucide-react";
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
  priceIdStarter: string | null;
  priceIdBasic: string | null;
  priceIdPro: string | null;
  priceIdBusiness: string | null;
}

export default function AdminCreditsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingFeature, setEditingFeature] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  // Stripe settings form state
  const [stripeForm, setStripeForm] = useState<StripeSettings>({
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    priceIdStarter: '',
    priceIdBasic: '',
    priceIdPro: '',
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
        priceIdBusiness: stripeSettings.priceIdBusiness || '',
      });
    }
  }, [stripeSettings, stripeLoading]);

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
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="pricing" className="data-[state=active]:bg-white/10">
              <Coins className="h-4 w-4 mr-2" />
              Credit Pricing
            </TabsTrigger>
            <TabsTrigger value="stripe" className="data-[state=active]:bg-white/10">
              <CreditCard className="h-4 w-4 mr-2" />
              Stripe Settings
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
                              ? 'bg-amber-500/10 border border-amber-500/30'
                              : 'bg-white/5 hover:bg-white/8'
                          }`}
                        >
                          <div>
                            <p className="text-white font-medium">{feature.featureName}</p>
                            <p className="text-xs text-gray-500">{feature.featureKey}</p>
                          </div>
                          <div className="text-gray-300">${feature.baseCostUsd}</div>
                          <div>
                            {isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                value={editValue}
                                onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                className="w-24 bg-white/10 border-amber-500/50 text-white focus:border-amber-400"
                                autoFocus
                              />
                            ) : (
                              <span className="text-yellow-500 font-semibold text-lg">{feature.creditCost}</span>
                            )}
                          </div>
                          <div>
                            {isEditing ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
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
                                className="hover:bg-white/10"
                              >
                                <Pencil className="h-4 w-4 mr-1" />
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
                        Credit Package Price IDs
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="priceIdStarter" className="text-gray-300">
                            Starter (100 credits - $2.99)
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
                            Basic (500 credits - $12.99)
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
                            Pro (1,500 credits - $34.99)
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
                          <Label htmlFor="priceIdBusiness" className="text-gray-300">
                            Business (5,000 credits - $99.99)
                          </Label>
                          <Input
                            id="priceIdBusiness"
                            type="text"
                            placeholder="price_..."
                            value={stripeForm.priceIdBusiness || ''}
                            onChange={(e) => setStripeForm({ ...stripeForm, priceIdBusiness: e.target.value })}
                            className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
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
        </Tabs>
      </div>
    </div>
  );
}
