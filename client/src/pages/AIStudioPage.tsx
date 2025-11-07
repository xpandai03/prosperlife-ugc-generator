/**
 * AI Studio Page - Phase 4.4
 *
 * Main page for AI image and video generation
 * - Generation form with prompt input and provider selection
 * - Gallery view of all user's generated media assets
 * - Real-time status updates via polling
 * - Integration with caption generation and scheduling
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";
import { MediaPreviewCard } from "@/components/MediaPreviewCard";
import { LimitReachedDialog } from "@/components/LimitReachedDialog";
import { formatDistanceToNow } from "date-fns";

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
  // Form state
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<string>("kie-4o-image");
  const [type, setType] = useState<'image' | 'video'>('image');
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch gallery with polling
  const { data: gallery, isLoading } = useQuery<GetMediaGalleryResponse>({
    queryKey: ['/api/ai/media'],
    refetchInterval: (data) => {
      // Poll every 10s if there are processing assets, otherwise don't poll
      const hasProcessing = data?.assets?.some(a => a.status === 'processing');
      return hasProcessing ? 10000 : false;
    },
    refetchIntervalInBackground: false, // Don't poll when tab is inactive
  });

  // Generate media mutation
  const generateMutation = useMutation({
    mutationFn: async (params: {
      prompt: string;
      provider: string;
      type: 'image' | 'video';
      referenceImageUrl?: string;
    }) => {
      const response = await apiRequest('POST', '/api/ai/generate-media', params);
      return await response.json() as GenerateMediaResponse;
    },
    onSuccess: () => {
      setPrompt(""); // Clear form
      setReferenceImageUrl("");
      queryClient.invalidateQueries({ queryKey: ['/api/ai/media'] });
      toast({
        title: 'Generation started! ✨',
        description: 'Check the gallery below for progress.',
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

  // Handle type change (auto-switch provider)
  const handleTypeChange = (newType: 'image' | 'video') => {
    setType(newType);
    if (newType === 'video') {
      setProvider('kie-veo3'); // Only video provider
    } else {
      setProvider('kie-4o-image'); // Default image provider
    }
  };

  // Handle form submission
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (prompt.length < 10 || prompt.length > 1000) {
      toast({
        title: 'Invalid prompt',
        description: 'Prompt must be between 10 and 1000 characters',
        variant: 'destructive',
      });
      return;
    }

    // Generate
    generateMutation.mutate({
      prompt,
      provider,
      type,
      referenceImageUrl: referenceImageUrl || undefined,
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
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            AI Studio
          </h1>
          <p className="text-white/70">
            Generate stunning images and videos with AI
          </p>
        </div>

        {/* Generation Form Card */}
        <Card className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl mb-12">
          <CardContent className="p-6 md:p-8">
            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Type Selector (Image/Video) */}
              <div className="space-y-2">
                <Label className="text-white text-sm font-medium">Media Type</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={type === 'image' ? 'default' : 'outline'}
                    onClick={() => handleTypeChange('image')}
                    className={type === 'image' ? 'flex-1' : 'flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10'}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Image
                  </Button>
                  <Button
                    type="button"
                    variant={type === 'video' ? 'default' : 'outline'}
                    onClick={() => handleTypeChange('video')}
                    className={type === 'video' ? 'flex-1' : 'flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10'}
                  >
                    <VideoIcon className="h-4 w-4 mr-2" />
                    Video
                  </Button>
                </div>
              </div>

              {/* Provider Selector */}
              <div className="space-y-2">
                <Label htmlFor="provider" className="text-white text-sm font-medium">
                  AI Provider
                </Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger
                    id="provider"
                    className="bg-white/10 border-white/20 text-white"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {type === 'image' && (
                      <>
                        <SelectItem value="kie-4o-image">
                          KIE 4O Image (Fast)
                        </SelectItem>
                        <SelectItem value="kie-flux-kontext">
                          KIE Flux Kontext (HD Quality)
                        </SelectItem>
                        <SelectItem value="gemini-flash">
                          Gemini 2.5 Flash
                        </SelectItem>
                      </>
                    )}
                    {type === 'video' && (
                      <SelectItem value="kie-veo3">
                        KIE Veo3 (8 seconds, 16:9)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Prompt Input */}
              <div className="space-y-2">
                <Label htmlFor="prompt" className="text-white text-sm font-medium">
                  Prompt
                </Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your vision in detail... (10-1000 characters)"
                  rows={4}
                  maxLength={1000}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-white/50">
                    {prompt.length} / 1000 characters
                  </p>
                  {prompt.length < 10 && prompt.length > 0 && (
                    <p className="text-xs text-red-400">
                      Minimum 10 characters required
                    </p>
                  )}
                </div>
              </div>

              {/* Reference Image URL (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="referenceUrl" className="text-white text-sm font-medium">
                  Reference Image URL (Optional)
                </Label>
                <Input
                  id="referenceUrl"
                  type="url"
                  value={referenceImageUrl}
                  onChange={(e) => setReferenceImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                <p className="text-xs text-white/50">
                  Provide a reference image to guide the AI generation (optional)
                </p>
              </div>

              {/* Generate Button */}
              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={generateMutation.isPending || prompt.length < 10}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate {type === 'image' ? 'Image' : 'Video'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Gallery Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">
              Your Generations
            </h2>
            {gallery?.total !== undefined && (
              <span className="text-white/60 text-sm">
                {gallery.total} {gallery.total === 1 ? 'item' : 'items'}
              </span>
            )}
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
                No generations yet
              </h3>
              <p className="text-gray-400 mb-6">
                Create your first AI-generated media using the form above
              </p>
            </div>
          )}

          {/* Gallery Grid */}
          {!isLoading && sortedAssets && sortedAssets.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedAssets.map((asset) => (
                <MediaPreviewCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Usage Limit Dialog */}
      <LimitReachedDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        limitType="media"
        limit={10}
      />
    </div>
  );
}
