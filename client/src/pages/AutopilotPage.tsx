/**
 * Autopilot Page (Jan 2026)
 *
 * Supports two ingestion modes:
 * 1. Generic URL (Demo Mode) - Any product page via direct crawl
 * 2. Shopify Store - Full store integration
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WaveBackground } from "@/components/ui/wave-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Zap,
  Store,
  Globe,
  Loader2,
  Plus,
  CheckCircle,
  ExternalLink,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  Video,
  ArrowRight,
  Package,
  Palette,
  Upload,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ==================== TYPES ====================

interface GenericProduct {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  images: string[];
  price: string | null;
  originalPrice: string | null;
  benefits: string[];
  brand: string | null;
  category: string | null;
  sourceUrl: string;
  dataQuality: string | null;
  qualityFlags: string[];
  isActive: boolean;
  createdAt: string;
}

interface AutopilotStore {
  id: string;
  userId: string;
  shopifyDomain: string;
  storeName?: string;
  logoUrl?: string;
  productCount: number;
  status: string;
  lastScrapedAt?: string;
  createdAt: string;
}

// ==================== WORKFLOW PIPELINE ====================

function WorkflowPipeline({ currentStep }: { currentStep: number }) {
  const steps = [
    { icon: Package, label: "Import Product", description: "Add product URL" },
    { icon: Palette, label: "Choose Style", description: "Select video tone" },
    { icon: Video, label: "Generate Video", description: "AI creates demo" },
    { icon: Upload, label: "Publish", description: "Post to socials" },
  ];

  return (
    <div className="mb-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center text-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isComplete
                      ? "bg-green-600 text-white"
                      : isActive
                      ? "bg-yellow-500 text-black ring-4 ring-yellow-500/30"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive ? "text-yellow-400" : isComplete ? "text-green-400" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-xs text-slate-500 mt-1">{step.description}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-shrink-0 px-2">
                  <ArrowRight
                    className={`w-5 h-5 ${
                      index < currentStep ? "text-green-500" : "text-slate-600"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function AutopilotPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mode selection
  const [mode, setMode] = useState<"generic" | "shopify">("generic");

  // Generic URL input
  const [genericUrl, setGenericUrl] = useState("");

  // Shopify URL input
  const [shopifyUrl, setShopifyUrl] = useState("");

  // ==================== QUERIES ====================

  // Fetch user's generic products
  const { data: genericProductsData, isLoading: genericLoading } = useQuery<{
    products: GenericProduct[];
    count: number;
  }>({
    queryKey: ["/api/autopilot/products/generic"],
  });

  // Fetch user's Shopify stores
  const { data: storesData, isLoading: storesLoading } = useQuery<{ stores: AutopilotStore[] }>({
    queryKey: ["/api/autopilot/stores"],
  });

  // ==================== MUTATIONS ====================

  // Generic URL ingestion (Demo Mode)
  const genericIngestMutation = useMutation({
    mutationFn: async (url: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/autopilot/ingest/generic", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to ingest product");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/products/generic"] });
      setGenericUrl("");
      toast({
        title: "Product imported!",
        description: `"${data.product.title}" is ready for video generation.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  // Delete generic product
  const deleteGenericMutation = useMutation({
    mutationFn: async (productId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/autopilot/products/generic/${productId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/products/generic"] });
      toast({ title: "Product deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  // Generate video for generic product
  const generateVideoMutation = useMutation({
    mutationFn: async (productId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/autopilot/products/generic/${productId}/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to generate video");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Video generation started!",
        description: `Your video for "${data.productTitle}" is being created. Check your videos page for status.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Shopify store scrape
  const shopifyScrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/autopilot/stores/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ shopifyUrl: url }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to scrape store");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/stores"] });
      setShopifyUrl("");
      toast({
        title: "Store connected!",
        description: `Found ${data.productCount} products.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Scrape failed", description: error.message, variant: "destructive" });
    },
  });

  // ==================== RENDER ====================

  const genericProducts = genericProductsData?.products || [];
  const stores = storesData?.stores || [];

  // Calculate current workflow step
  const getCurrentStep = () => {
    if (genericProducts.length === 0) return 0; // Need to import
    // For now, once we have products, we're on step 1 (choose style)
    // TODO: Track video generation status
    return 1;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <WaveBackground />

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl pt-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-400" />
            Autopilot
          </h1>
          <p className="text-slate-400">
            Import products from any URL and generate AI-powered demo videos.
          </p>
        </div>

        {/* Workflow Pipeline */}
        <WorkflowPipeline currentStep={getCurrentStep()} />

        {/* Mode Selection Tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "generic" | "shopify")} className="space-y-6">
          <TabsList className="bg-slate-800/50 p-1">
            <TabsTrigger
              value="generic"
              className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              Any URL (Demo)
            </TabsTrigger>
            <TabsTrigger
              value="shopify"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <Store className="w-4 h-4" />
              Shopify Store
            </TabsTrigger>
          </TabsList>

          {/* ==================== GENERIC URL MODE ==================== */}
          <TabsContent value="generic" className="space-y-6">
            {/* Import Card */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-yellow-400" />
                  Import Product from URL
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Paste any product page URL. Works with WordPress, WooCommerce, Squarespace, and more.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={genericUrl}
                    onChange={(e) => setGenericUrl(e.target.value)}
                    placeholder="https://example.com/product/your-product"
                    className="bg-slate-900 border-slate-600 text-white flex-1"
                    disabled={genericIngestMutation.isPending}
                  />
                  <Button
                    onClick={() => genericIngestMutation.mutate(genericUrl)}
                    disabled={genericIngestMutation.isPending || !genericUrl}
                    className="bg-yellow-600 hover:bg-yellow-700 min-w-[120px]"
                  >
                    {genericIngestMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
                {genericIngestMutation.isPending && (
                  <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-3 text-slate-300">
                      <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                      <div>
                        <p className="font-medium">Crawling page...</p>
                        <p className="text-sm text-slate-500">Extracting product data (5-15 seconds)</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Imported Products */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  Imported Products
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {genericProducts.length} product{genericProducts.length !== 1 ? "s" : ""} ready for video generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {genericLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                  </div>
                ) : genericProducts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">No products imported yet</p>
                    <p className="text-sm">Paste a product URL above to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {genericProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                      >
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          {product.images[0] ? (
                            <img
                              src={product.images[0]}
                              alt=""
                              className="w-28 h-28 rounded-lg object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-28 h-28 rounded-lg bg-slate-700 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-slate-500" />
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-white font-medium">{product.title}</h3>
                              <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                                {product.description || "No description available"}
                              </p>
                            </div>
                          </div>

                          {/* Meta info */}
                          <div className="flex items-center gap-4 mt-3 text-sm">
                            {product.price && (
                              <span className="text-green-400 font-semibold text-base">{product.price}</span>
                            )}
                            <span className="text-slate-500">
                              {product.images.length} image{product.images.length !== 1 ? "s" : ""}
                            </span>
                            <span className="text-slate-500">
                              {product.benefits?.length || 0} benefit{(product.benefits?.length || 0) !== 1 ? "s" : ""}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                product.dataQuality === "high"
                                  ? "border-green-600 text-green-400"
                                  : product.dataQuality === "medium"
                                  ? "border-yellow-600 text-yellow-400"
                                  : "border-slate-600 text-slate-400"
                              }
                            >
                              {product.dataQuality || "unknown"}
                            </Badge>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-4">
                            <Button
                              size="sm"
                              className="bg-yellow-600 hover:bg-yellow-700 text-white"
                              disabled={product.images.length < 2 || generateVideoMutation.isPending}
                              onClick={() => generateVideoMutation.mutate(product.id)}
                            >
                              {generateVideoMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Video className="w-4 h-4 mr-2" />
                              )}
                              Generate Video
                            </Button>
                            {product.images.length < 2 && (
                              <span className="text-xs text-red-400">
                                Needs at least 2 images
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(product.sourceUrl, "_blank")}
                              className="border-slate-600 text-slate-300"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Source
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteGenericMutation.mutate(product.id)}
                              disabled={deleteGenericMutation.isPending}
                              className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Quality flags */}
                          {product.qualityFlags && product.qualityFlags.length > 0 && (
                            <div className="flex items-center gap-2 mt-3">
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                              <span className="text-xs text-amber-500">
                                {product.qualityFlags.join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next Steps Card - Show when products exist */}
            {genericProducts.length > 0 && (
              <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-700/50">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-600/20 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium">Ready to create your first video?</h3>
                      <p className="text-slate-400 text-sm mt-1">
                        Click "Generate Video" on any product above to create a 60-second AI demo video.
                      </p>
                    </div>
                    <Button
                      className="bg-yellow-600 hover:bg-yellow-700"
                      disabled={!genericProducts.some(p => p.images.length >= 2) || generateVideoMutation.isPending}
                      onClick={() => {
                        // Find first product with enough images
                        const eligibleProduct = genericProducts.find(p => p.images.length >= 2);
                        if (eligibleProduct) {
                          generateVideoMutation.mutate(eligibleProduct.id);
                        }
                      }}
                    >
                      {generateVideoMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Video className="w-4 h-4 mr-2" />
                      )}
                      Generate First Video
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== SHOPIFY MODE ==================== */}
          <TabsContent value="shopify" className="space-y-6">
            {/* Connect Shopify Card */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-purple-400" />
                  Connect Shopify Store
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Import all products from your Shopify store for automated video generation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={shopifyUrl}
                    onChange={(e) => setShopifyUrl(e.target.value)}
                    placeholder="https://your-store.myshopify.com"
                    className="bg-slate-900 border-slate-600 text-white flex-1"
                    disabled={shopifyScrapeMutation.isPending}
                  />
                  <Button
                    onClick={() => shopifyScrapeMutation.mutate(shopifyUrl)}
                    disabled={shopifyScrapeMutation.isPending || !shopifyUrl}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {shopifyScrapeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Connected Stores */}
            {stores.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Connected Stores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stores.map((store) => (
                      <div
                        key={store.id}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          {store.logoUrl ? (
                            <img src={store.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                              <Store className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-white font-medium">{store.storeName || store.shopifyDomain}</h3>
                            <p className="text-slate-400 text-sm">{store.productCount} products</p>
                          </div>
                        </div>
                        <Badge variant={store.status === "active" ? "default" : "secondary"}>
                          {store.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {stores.length === 0 && !storesLoading && (
              <Card className="bg-slate-800/30 border-slate-700 border-dashed">
                <CardContent className="py-12 text-center">
                  <Store className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <p className="text-slate-400 text-lg mb-2">No Shopify stores connected</p>
                  <p className="text-slate-500 text-sm">Enter your Shopify store URL above to get started</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
