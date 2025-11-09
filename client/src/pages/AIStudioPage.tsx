/**
 * AI Studio Page - Phase 4 (Redesigned)
 *
 * Simplified UGC Ad Studio with preset prompt templates
 * - 5-field product brief form (product, features, ICP, scene, mode)
 * - Preset-based prompt generation (no manual prompts)
 * - Gallery view of all user's generated media assets
 * - Real-time status updates via polling
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WaveBackground } from "@/components/ui/wave-background";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
  Upload,
  Info,
  Settings,
} from "lucide-react";
import { MediaPreviewCard } from "@/components/MediaPreviewCard";
import { LimitReachedDialog } from "@/components/LimitReachedDialog";
import { UGCAdPreviewModal } from "@/components/UGCAdPreviewModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { CaptionSettingsModal } from "@/components/CaptionSettingsModal";
import { formatDistanceToNow } from "date-fns";
import {
  ICP_OPTIONS,
  SCENE_OPTIONS,
  MODE_OPTIONS,
  formatICPForPrompt,
  formatSceneForPrompt,
} from "@/constants/ugc-form-options";

// TypeScript interfaces
interface MediaAsset {
  id: string;
  userId: string;
  provider: string;
  type: 'image' | 'video';
  prompt: string;
  referenceImageUrl?: string;
  status: 'processing' | 'ready' | 'error';
  taskId?: string;
  resultUrl?: string;
  resultUrls?: string[];
  errorMessage?: string;
  retryCount: number;
  metadata?: any;
  apiResponse?: any;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface GetMediaGalleryResponse {
  success: boolean;
  assets: MediaAsset[];
  total: number;
}

interface GenerateMediaResponse {
  success: boolean;
  assetId: string;
  status: 'processing' | 'ready';
}

export default function AIStudioPage() {
  // Form state - Phase 4 Simplified (5 fields)
  const [productImage, setProductImage] = useState(""); // Preview URL (for display)
  const [productImageFile, setProductImageFile] = useState<File | null>(null); // Actual file object
  const [productName, setProductName] = useState("");
  const [productFeatures, setProductFeatures] = useState("");
  const [customerPersona, setCustomerPersona] = useState(ICP_OPTIONS[0].value);
  const [videoSetting, setVideoSetting] = useState(SCENE_OPTIONS[0].value);
  const [generationMode, setGenerationMode] = useState(MODE_OPTIONS[0].value);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [captionSettingsOpen, setCaptionSettingsOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch gallery with polling
  const { data: gallery, isLoading } = useQuery<GetMediaGalleryResponse>({
    queryKey: ['/api/ai/media'],
    refetchInterval: (data) => {
      // Poll every 10s if there are processing assets, otherwise don't poll
      const hasProcessing = data?.assets?.some(a => a.status === 'processing');

      // 🔍 DEBUG: Log polling decision
      if (hasProcessing) {
        console.log('[AIStudio] Polling active - processing assets found:',
          data?.assets?.filter(a => a.status === 'processing').map(a => ({ id: a.id, type: a.type }))
        );
      }

      return hasProcessing ? 10000 : false;
    },
    refetchIntervalInBackground: false, // Don't poll when tab is inactive
    // 🆕 Force at least ONE refetch after processing completes
    refetchOnMount: true,
    staleTime: 5000, // Override global Infinity to allow refetch (5 seconds)
  });

  // Generate media mutation - Phase 4 (uses preset templates)
  const generateMutation = useMutation({
    mutationFn: async (params: {
      productName: string;
      productFeatures: string;
      customerPersona: string;
      videoSetting: string;
      generationMode: string;
      productImageFile?: File | null;
      productImageUrl?: string;
    }) => {
      // Use FormData to send file + other fields
      const formData = new FormData();
      formData.append('productName', params.productName);
      formData.append('productFeatures', params.productFeatures);
      formData.append('customerPersona', params.customerPersona);
      formData.append('videoSetting', params.videoSetting);
      formData.append('generationMode', params.generationMode);

      // Add file if provided (drag-and-drop upload)
      if (params.productImageFile) {
        formData.append('productImage', params.productImageFile);
      }
      // Or add URL if provided (manual URL paste)
      else if (params.productImageUrl) {
        formData.append('productImageUrl', params.productImageUrl);
      }

      // Get auth headers from Supabase session
      const authHeaders = await getAuthHeaders();

      // Send as multipart/form-data
      // Note: Don't set Content-Type - browser sets it automatically with boundary
      const response = await fetch('/api/ai/generate-ugc-preset', {
        method: 'POST',
        headers: {
          ...authHeaders, // ✅ Include Authorization: Bearer <token>
        },
        credentials: 'include', // ✅ Include cookies for session-based auth
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Generation failed');
      }

      return await response.json() as GenerateMediaResponse;
    },
    onSuccess: () => {
      // Clear form
      setProductName("");
      setProductFeatures("");
      setProductImage("");
      setProductImageFile(null); // Clear file object
      // Reset to defaults (don't clear dropdowns - keep user's last selection)

      queryClient.invalidateQueries({ queryKey: ['/api/ai/media'] });

      const modeInfo = MODE_OPTIONS.find(m => m.value === generationMode);
      toast({
        title: 'UGC Ad generation started! 🎬',
        description: `${modeInfo?.label || 'Your ad'} will be ready in ${modeInfo?.estimatedTime || '1-2 minutes'}`,
      });
    },
    onError: (error: any) => {
      console.error('Generation error:', error);

      // Check for usage limits
      if (error.message.includes('limit') || error.message.includes('free tier')) {
        setShowLimitDialog(true);
        return;
      }

      toast({
        title: 'Generation failed',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission - Phase 4 (preset-based)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!productName.trim()) {
      toast({
        title: 'Product name required',
        description: 'Please enter your product name',
        variant: 'destructive',
      });
      return;
    }

    if (productName.length > 100) {
      toast({
        title: 'Product name too long',
        description: 'Product name must be 100 characters or less',
        variant: 'destructive',
      });
      return;
    }

    if (!productFeatures.trim()) {
      toast({
        title: 'Product features required',
        description: 'Please describe your product features',
        variant: 'destructive',
      });
      return;
    }

    if (productFeatures.length < 10 || productFeatures.length > 2000) {
      toast({
        title: 'Invalid features description',
        description: 'Features must be between 10 and 2000 characters',
        variant: 'destructive',
      });
      return;
    }

    // Generate with preset templates
    generateMutation.mutate({
      productName: productName.trim(),
      productFeatures: productFeatures.trim(),
      customerPersona,
      videoSetting,
      generationMode,
      productImageFile: productImageFile, // Send actual file object
      productImageUrl: productImageFile ? undefined : (productImage.trim() || undefined), // Only send URL if no file
    });
  };

  // Sort assets by creation date (newest first)
  const sortedAssets = gallery?.assets
    ? [...gallery.assets].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  return (
    <div className="min-h-screen w-full bg-black overflow-hidden relative">
      {/* Background animation */}
      <WaveBackground />

      {/* Content overlay */}
      <div className="relative z-50 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              UGC Ad Studio
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCaptionSettingsOpen(true)}
              className="border-white/20 text-white hover:bg-white/10 hover:text-white flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Caption Settings</span>
            </Button>
          </div>
          <p className="text-white/70 mb-3">
            Generate influencer-style videos and images for your products with AI
          </p>
          <a
            href="#"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
          >
            <span>New? Watch the 1-minute demo on how to create your first UGC ad</span>
            <span>→</span>
          </a>
        </div>

        {/* Generation Form Card - Phase 4 Redesign */}
        <Card className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl mb-12">
          <CardContent className="p-6 md:p-8">
            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Form Header */}
              <div className="pb-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white mb-1">
                  Product Brief
                </h2>
                <p className="text-sm text-white/60">
                  Fill in the details below — AI will create an authentic UGC-style ad video
                </p>
              </div>

              {/* 1. Product Image - Drag & Drop + URL */}
              <ImageUploadField
                value={productImage}
                onChange={setProductImage}
                onFileChange={setProductImageFile}
                label="Product Image"
                required={false}
                description="Upload an image or paste a URL for visual reference"
                maxSizeMB={10}
              />

              {/* 2. Product Name */}
              <div className="space-y-2">
                <Label htmlFor="product-name" className="text-white text-sm font-medium flex items-center gap-2">
                  Product Name
                  <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="product-name"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., ProFit Protein Powder"
                  maxLength={100}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  required
                />
                <p className="text-xs text-white/50">
                  {productName.length} / 100 characters
                </p>
              </div>

              {/* 3. Product Features */}
              <div className="space-y-2">
                <Label htmlFor="product-features" className="text-white text-sm font-medium flex items-center gap-2">
                  Key Features
                  <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  id="product-features"
                  value={productFeatures}
                  onChange={(e) => setProductFeatures(e.target.value)}
                  placeholder="e.g., 30g protein per serving, chocolate flavor, keto-friendly, zero sugar"
                  rows={3}
                  maxLength={2000}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none"
                  required
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-white/50">
                    Highlight what makes your product special
                  </p>
                  <p className="text-xs text-white/50">
                    {productFeatures.length} / 2000
                  </p>
                </div>
                {productFeatures.length > 0 && productFeatures.length < 10 && (
                  <p className="text-xs text-red-400">
                    Minimum 10 characters required
                  </p>
                )}
              </div>

              {/* 4. Customer Persona (ICP) */}
              <div className="space-y-2">
                <Label htmlFor="customer-persona" className="text-white text-sm font-medium flex items-center gap-2">
                  Who's Your Customer?
                  <span className="text-red-400">*</span>
                </Label>
                <Select value={customerPersona} onValueChange={setCustomerPersona}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/20">
                    {ICP_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-white hover:bg-white/10">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/50">
                  {ICP_OPTIONS.find(opt => opt.value === customerPersona)?.description}
                </p>
              </div>

              {/* 5. Video Setting (Scene) */}
              <div className="space-y-2">
                <Label htmlFor="video-setting" className="text-white text-sm font-medium flex items-center gap-2">
                  Where's the Ad Filmed?
                  <span className="text-red-400">*</span>
                </Label>
                <Select value={videoSetting} onValueChange={setVideoSetting}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/20">
                    {SCENE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-white hover:bg-white/10">
                        <span className="flex items-center gap-2">
                          <span>{option.emoji}</span>
                          <span>{option.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/50">
                  {SCENE_OPTIONS.find(opt => opt.value === videoSetting)?.description}
                </p>
              </div>

              {/* 6. Generation Mode */}
              <div className="space-y-3">
                <Label className="text-white text-sm font-medium flex items-center gap-2">
                  Quality Mode
                  <button
                    type="button"
                    className="text-white/50 hover:text-white/70 transition-colors"
                    title="Choose between quality, speed, or cost"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </Label>
                <div className="space-y-2">
                  {MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setGenerationMode(mode.value)}
                      className={`
                        w-full text-left p-4 rounded-lg border transition-all
                        ${generationMode === mode.value
                          ? 'bg-blue-600/20 border-blue-500 shadow-lg'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">{mode.label}</span>
                            <span className={`
                              text-xs px-2 py-0.5 rounded-full font-medium
                              ${mode.badge === 'RECOMMENDED' ? 'bg-green-500/20 text-green-400' : ''}
                              ${mode.badge === 'FASTER' ? 'bg-blue-500/20 text-blue-400' : ''}
                              ${mode.badge === 'CHEAPER' ? 'bg-purple-500/20 text-purple-400' : ''}
                            `}>
                              {mode.badge}
                            </span>
                          </div>
                          <p className="text-sm text-white/60">{mode.description}</p>
                        </div>
                        <span className="text-xs text-white/50 ml-4">{mode.estimatedTime}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <div className="space-y-2 pt-4">
                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  disabled={generateMutation.isPending || !productName.trim() || !productFeatures.trim() || productFeatures.length < 10}
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating Your UGC Ad...
                    </>
                  ) : (
                    <>
                      <VideoIcon className="h-5 w-5 mr-2" />
                      Generate UGC Ad Video
                    </>
                  )}
                </Button>
                <p className="text-xs text-white/60 text-center">
                  Your ad will appear in the gallery below once ready
                </p>
                <button
                  type="button"
                  onClick={() => setCaptionSettingsOpen(true)}
                  className="text-xs text-white/50 hover:text-blue-400 transition-colors text-center w-full mt-2 flex items-center justify-center gap-1"
                >
                  <Settings className="h-3 w-3" />
                  <span>Captions will be auto-generated when posting</span>
                  <span className="text-blue-400">→ Customize AI caption style</span>
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="border-t border-white/10 mb-12"></div>

        {/* Gallery Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white mb-2">
              Your UGC Ads
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-white/60 text-sm">
                Preview and manage your generated UGC content. Click to caption, schedule, or post.
              </p>
              {gallery?.total !== undefined && (
                <span className="text-white/60 text-sm font-medium">
                  {gallery.total} {gallery.total === 1 ? 'ad' : 'ads'}
                </span>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!sortedAssets || sortedAssets.length === 0) && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 mb-6">
                <Sparkles className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                No UGC ads yet
              </h3>
              <p className="text-gray-400 mb-6">
                Create your first influencer-style ad using the form above
              </p>
            </div>
          )}

          {/* Gallery Grid */}
          {!isLoading && sortedAssets && sortedAssets.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedAssets.map((asset) => (
                <MediaPreviewCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => {
                    console.log('[AIStudio] Card clicked, setting selectedAsset:', asset.id);
                    setSelectedAsset(asset);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* UGC Ad Preview Modal */}
      <UGCAdPreviewModal
        asset={selectedAsset}
        onClose={() => {
          console.log('[AIStudio] Closing modal');
          setSelectedAsset(null);
        }}
      />

      {/* Usage Limit Dialog */}
      <LimitReachedDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        limitType="media"
        limit={10}
      />

      {/* Caption Settings Modal */}
      <CaptionSettingsModal
        open={captionSettingsOpen}
        onOpenChange={setCaptionSettingsOpen}
      />
    </div>
  );
}
