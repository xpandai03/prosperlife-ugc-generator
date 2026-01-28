/**
 * Autopilot Page (Jan 2026)
 *
 * Full autopilot setup and dashboard:
 * - Step 1: Connect Shopify store
 * - Step 2: Review product pool
 * - Step 3: Configure video style
 * - Step 4: Preview & approve first video
 * - Step 5: Dashboard with autopilot status
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WaveBackground } from "@/components/ui/wave-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Zap,
  Store,
  Package,
  Settings,
  Play,
  Pause,
  CheckCircle,
  Loader2,
  Plus,
  RefreshCw,
  ExternalLink,
  Video,
  Clock,
  BarChart3,
  Image as ImageIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ==================== TYPES ====================

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

interface AutopilotProduct {
  id: string;
  storeId: string;
  externalId: string;
  title: string;
  description?: string;
  images: string[];
  price?: string;
  tags?: string[];
  isActive: boolean;
  useCount: number;
  lastUsedAt?: string;
}

interface AutopilotConfig {
  id: string;
  storeId: string;
  userId: string;
  tone: string;
  voiceId?: string;
  includeAvatar: boolean;
  videosPerWeek: number;
  platforms: string[];
  isApproved: boolean;
  isActive: boolean;
  firstVideoAssetId?: string;
  videosGenerated: number;
  poolCycles: number;
  nextScheduledAt?: string;
  lastGeneratedAt?: string;
}

interface AutopilotHistory {
  id: string;
  configId: string;
  productId: string;
  mediaAssetId?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

// ==================== MAIN COMPONENT ====================

export default function AutopilotPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Setup states
  const [shopifyUrl, setShopifyUrl] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Config form state
  const [newConfig, setNewConfig] = useState({
    tone: "casual",
    videosPerWeek: 3,
    platforms: ["tiktok", "instagram"],
  });

  // ==================== QUERIES ====================

  // Fetch user's stores
  const { data: storesData, isLoading: storesLoading } = useQuery<{ stores: AutopilotStore[] }>({
    queryKey: ["/api/autopilot/stores"],
  });

  // Fetch products for selected store
  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: AutopilotProduct[] }>({
    queryKey: ["/api/autopilot/stores", selectedStoreId, "products"],
    enabled: !!selectedStoreId,
  });

  // Fetch config for selected store
  const { data: configData, isLoading: configLoading } = useQuery<{ config: AutopilotConfig | null }>({
    queryKey: ["/api/autopilot/stores", selectedStoreId, "config"],
    enabled: !!selectedStoreId,
  });

  // Fetch history for selected store
  const { data: historyData } = useQuery<{ history: AutopilotHistory[] }>({
    queryKey: ["/api/autopilot/stores", selectedStoreId, "history"],
    enabled: !!selectedStoreId && !!configData?.config?.id,
  });

  // ==================== MUTATIONS ====================

  // Scrape Shopify store
  const scrapeMutation = useMutation({
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
      setSelectedStoreId(data.storeId);
      setShopifyUrl("");
      toast({
        title: "Store connected!",
        description: `Found ${data.productCount} products from ${data.storeName || "store"}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Scrape failed", description: error.message, variant: "destructive" });
    },
  });

  // Create autopilot config
  const createConfigMutation = useMutation({
    mutationFn: async (config: typeof newConfig & { storeId: string }) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/autopilot/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create config");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/stores", selectedStoreId, "config"] });
      setConfigDialogOpen(false);
      toast({ title: "Config created", description: "Now generate a preview video to activate autopilot." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Generate preview video
  const previewMutation = useMutation({
    mutationFn: async (configId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/autopilot/configs/${configId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate preview");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/stores", selectedStoreId, "config"] });
      setPreviewDialogOpen(true);
      toast({ title: "Preview generating", description: "Your preview video is being generated..." });
    },
    onError: (error: Error) => {
      toast({ title: "Preview failed", description: error.message, variant: "destructive" });
    },
  });

  // Approve and activate autopilot
  const approveMutation = useMutation({
    mutationFn: async (configId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/autopilot/configs/${configId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/stores", selectedStoreId, "config"] });
      setPreviewDialogOpen(false);
      toast({ title: "Autopilot activated!", description: "Your videos will be generated automatically." });
    },
    onError: (error: Error) => {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    },
  });

  // Pause/resume autopilot
  const toggleAutopilotMutation = useMutation({
    mutationFn: async ({ configId, action }: { configId: string; action: "pause" | "resume" }) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/autopilot/configs/${configId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action}`);
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/stores", selectedStoreId, "config"] });
      toast({
        title: variables.action === "pause" ? "Autopilot paused" : "Autopilot resumed",
        description: variables.action === "pause"
          ? "Video generation has been paused."
          : "Video generation has resumed.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Toggle product active status
  const toggleProductMutation = useMutation({
    mutationFn: async ({ productId, isActive }: { productId: string; isActive: boolean }) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/autopilot/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/stores", selectedStoreId, "products"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // ==================== DERIVED STATE ====================

  const stores = storesData?.stores || [];
  const products = productsData?.products || [];
  const config = configData?.config;
  const history = historyData?.history || [];
  const activeProducts = products.filter(p => p.isActive);

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  // Determine current step
  const getCurrentStep = () => {
    if (!selectedStore) return 1; // Connect store
    if (products.length === 0) return 2; // Products loading/empty
    if (!config) return 3; // Create config
    if (!config.isApproved) return 4; // Preview & approve
    return 5; // Dashboard
  };

  const currentStep = getCurrentStep();

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <WaveBackground />

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl pt-24">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="w-8 h-8 text-yellow-400" />
            Autopilot
          </h1>
          <p className="text-slate-400">
            Connect your Shopify store and let AI generate product videos automatically.
          </p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { num: 1, label: "Connect Store", icon: Store },
            { num: 2, label: "Product Pool", icon: Package },
            { num: 3, label: "Configure Style", icon: Settings },
            { num: 4, label: "Preview & Approve", icon: Play },
            { num: 5, label: "Dashboard", icon: BarChart3 },
          ].map((step, index) => (
            <div key={step.num} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                  currentStep >= step.num
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                    : "bg-slate-800/50 text-slate-500 border border-slate-700"
                }`}
              >
                <step.icon className="w-4 h-4" />
                <span className="text-sm font-medium whitespace-nowrap">{step.label}</span>
              </div>
              {index < 4 && (
                <div className={`w-8 h-0.5 mx-1 ${currentStep > step.num ? "bg-yellow-500/50" : "bg-slate-700"}`} />
              )}
            </div>
          ))}
        </div>

        <Tabs defaultValue={currentStep <= 2 ? "setup" : currentStep <= 4 ? "configure" : "dashboard"} className="space-y-6">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="setup" className="data-[state=active]:bg-yellow-600">
              <Store className="w-4 h-4 mr-2" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="configure" className="data-[state=active]:bg-yellow-600" disabled={!selectedStore}>
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-yellow-600" disabled={!config?.isApproved}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          {/* ==================== SETUP TAB ==================== */}
          <TabsContent value="setup" className="space-y-6">
            {/* Connect Store Card */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-yellow-400" />
                  Connect Shopify Store
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Enter your Shopify store URL to import your products.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={shopifyUrl}
                    onChange={(e) => setShopifyUrl(e.target.value)}
                    placeholder="https://your-store.myshopify.com"
                    className="bg-slate-900 border-slate-600 text-white flex-1"
                  />
                  <Button
                    onClick={() => scrapeMutation.mutate(shopifyUrl)}
                    disabled={scrapeMutation.isPending || !shopifyUrl}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    {scrapeMutation.isPending ? (
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
                  <CardTitle className="text-white">Your Stores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stores.map((store) => (
                      <div
                        key={store.id}
                        onClick={() => setSelectedStoreId(store.id)}
                        className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                          selectedStoreId === store.id
                            ? "bg-yellow-500/20 border border-yellow-500/50"
                            : "bg-slate-900/50 border border-slate-700 hover:border-slate-600"
                        }`}
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
                        <div className="flex items-center gap-3">
                          <Badge variant={store.status === "active" ? "default" : "secondary"}>
                            {store.status}
                          </Badge>
                          {selectedStoreId === store.id && (
                            <CheckCircle className="w-5 h-5 text-yellow-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Pool */}
            {selectedStoreId && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Package className="w-5 h-5 text-yellow-400" />
                        Product Pool
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {activeProducts.length} of {products.length} products enabled for video generation.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/autopilot/stores", selectedStoreId, "products"] })}
                      className="border-slate-600 text-slate-300"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {productsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No products found. Try re-scraping the store.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            product.isActive
                              ? "bg-slate-900/50 border-slate-700"
                              : "bg-slate-900/30 border-slate-800 opacity-60"
                          }`}
                        >
                          {product.images[0] ? (
                            <img
                              src={product.images[0]}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-slate-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white text-sm font-medium truncate">{product.title}</h4>
                            <p className="text-slate-400 text-xs">{product.price || "No price"}</p>
                          </div>
                          <Switch
                            checked={product.isActive}
                            onCheckedChange={(checked) =>
                              toggleProductMutation.mutate({ productId: product.id, isActive: checked })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== CONFIGURE TAB ==================== */}
          <TabsContent value="configure" className="space-y-6">
            {!config ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-yellow-400" />
                    Configure Video Style
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Set your preferences for automated video generation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <Label className="text-slate-300">Video Tone</Label>
                      <Select
                        value={newConfig.tone}
                        onValueChange={(v) => setNewConfig({ ...newConfig, tone: v })}
                      >
                        <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="casual">Casual & Friendly</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="energetic">Energetic & Exciting</SelectItem>
                          <SelectItem value="luxury">Luxury & Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-slate-300">Videos Per Week</Label>
                      <Select
                        value={String(newConfig.videosPerWeek)}
                        onValueChange={(v) => setNewConfig({ ...newConfig, videosPerWeek: parseInt(v) })}
                      >
                        <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="1">1 video/week</SelectItem>
                          <SelectItem value="3">3 videos/week</SelectItem>
                          <SelectItem value="5">5 videos/week</SelectItem>
                          <SelectItem value="7">Daily (7/week)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300 mb-3 block">Target Platforms</Label>
                    <div className="flex flex-wrap gap-3">
                      {["tiktok", "instagram", "youtube", "facebook"].map((platform) => (
                        <Button
                          key={platform}
                          variant={newConfig.platforms.includes(platform) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const platforms = newConfig.platforms.includes(platform)
                              ? newConfig.platforms.filter(p => p !== platform)
                              : [...newConfig.platforms, platform];
                            setNewConfig({ ...newConfig, platforms });
                          }}
                          className={newConfig.platforms.includes(platform)
                            ? "bg-yellow-600 hover:bg-yellow-700"
                            : "border-slate-600 text-slate-300"
                          }
                        >
                          {platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={() => createConfigMutation.mutate({ ...newConfig, storeId: selectedStoreId })}
                    disabled={createConfigMutation.isPending || !selectedStoreId}
                    className="bg-yellow-600 hover:bg-yellow-700 w-full"
                  >
                    {createConfigMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>
                </CardContent>
              </Card>
            ) : !config.isApproved ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Play className="w-5 h-5 text-yellow-400" />
                    Preview & Approve
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Generate a preview video to see how your autopilot videos will look.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Current Settings</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="text-slate-400">Tone:</div>
                      <div className="text-white capitalize">{config.tone}</div>
                      <div className="text-slate-400">Cadence:</div>
                      <div className="text-white">{config.videosPerWeek} videos/week</div>
                      <div className="text-slate-400">Platforms:</div>
                      <div className="text-white">{config.platforms?.join(", ") || "None"}</div>
                    </div>
                  </div>

                  {config.firstVideoAssetId ? (
                    <div className="space-y-4">
                      <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-4">
                        <p className="text-green-300 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          Preview video generated! Review and approve to activate autopilot.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => window.open(`/details/${config.firstVideoAssetId}`, "_blank")}
                          className="border-slate-600 text-slate-300"
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Watch Preview
                        </Button>
                        <Button
                          onClick={() => approveMutation.mutate(config.id)}
                          disabled={approveMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 flex-1"
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Approve & Activate Autopilot
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => previewMutation.mutate(config.id)}
                      disabled={previewMutation.isPending}
                      className="bg-yellow-600 hover:bg-yellow-700 w-full"
                    >
                      {previewMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Generate Preview Video
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-green-900/30 border-green-600/50">
                <CardContent className="py-8 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
                  <h3 className="text-white text-xl font-semibold mb-2">Autopilot is Active!</h3>
                  <p className="text-slate-400 mb-4">
                    Go to the Dashboard tab to monitor your video generation.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== DASHBOARD TAB ==================== */}
          <TabsContent value="dashboard" className="space-y-6">
            {config?.isApproved && (
              <>
                {/* Status Card */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Zap className={`w-5 h-5 ${config.isActive ? "text-yellow-400" : "text-slate-500"}`} />
                          Autopilot Status
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          {config.isActive ? "Actively generating videos" : "Paused"}
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() =>
                          toggleAutopilotMutation.mutate({
                            configId: config.id,
                            action: config.isActive ? "pause" : "resume",
                          })
                        }
                        disabled={toggleAutopilotMutation.isPending}
                        variant={config.isActive ? "outline" : "default"}
                        className={config.isActive ? "border-slate-600 text-slate-300" : "bg-yellow-600 hover:bg-yellow-700"}
                      >
                        {toggleAutopilotMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : config.isActive ? (
                          <Pause className="w-4 h-4 mr-2" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {config.isActive ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                        <Video className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                        <div className="text-2xl font-bold text-white">{config.videosGenerated}</div>
                        <div className="text-slate-400 text-sm">Videos Generated</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                        <Package className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                        <div className="text-2xl font-bold text-white">{activeProducts.length}</div>
                        <div className="text-slate-400 text-sm">Active Products</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                        <RefreshCw className="w-6 h-6 mx-auto mb-2 text-green-400" />
                        <div className="text-2xl font-bold text-white">{config.poolCycles}</div>
                        <div className="text-slate-400 text-sm">Pool Cycles</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                        <Clock className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                        <div className="text-lg font-bold text-white">
                          {config.nextScheduledAt
                            ? formatDistanceToNow(new Date(config.nextScheduledAt), { addSuffix: true })
                            : "N/A"}
                        </div>
                        <div className="text-slate-400 text-sm">Next Video</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent History */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Recent Videos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {history.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No videos generated yet. First video coming soon!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {history.slice(0, 10).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  item.status === "ready"
                                    ? "bg-green-400"
                                    : item.status === "failed"
                                    ? "bg-red-400"
                                    : "bg-yellow-400 animate-pulse"
                                }`}
                              />
                              <div>
                                <p className="text-white text-sm">Video #{item.id.slice(-6)}</p>
                                <p className="text-slate-400 text-xs">
                                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  item.status === "ready"
                                    ? "default"
                                    : item.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {item.status}
                              </Badge>
                              {item.mediaAssetId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(`/details/${item.mediaAssetId}`, "_blank")}
                                  className="border-slate-600 text-slate-300"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
