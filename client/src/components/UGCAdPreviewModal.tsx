/**
 * UGC Ad Preview Modal - Phase 4.6.5 (Hook Order Fixed)
 *
 * Proper overlay modal for viewing and acting on AI-generated UGC ads
 * - Fixed: React hook order - all hooks called before conditionals
 * - Fixed: Early returns moved after all hook calls
 * - Displays image or video preview with fallback
 * - Actions: Use for Video, Post, Schedule, Download
 */

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription } from './ui/alert';
import {
  Calendar,
  Download,
  Video as VideoIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

interface UGCAdPreviewModalProps {
  asset: MediaAsset | null;
  onClose: () => void;
}

export function UGCAdPreviewModal({ asset, onClose }: UGCAdPreviewModalProps) {
  // ========================================
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONALS
  // ========================================

  // State hooks
  const [caption, setCaption] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [showPostFlow, setShowPostFlow] = useState(false);
  const [error, setError] = useState(false);

  // Context hooks
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Memoized URL extraction with crash protection
  const mediaUrl = useMemo(() => {
    if (!asset) return '';

    try {
      // Try all possible field name variations (Drizzle + API variations)
      const url = (
        asset?.resultUrl ||                                  // Drizzle camelCase
        (asset as any)?.result_url ||                        // Drizzle snake_case fallback
        asset?.resultUrls?.[0] ||                            // Array format (camelCase)
        (asset as any)?.result_urls?.[0] ||                  // Array format (snake_case)
        asset?.metadata?.response?.resultUrls?.[0] ||        // KIE nested path
        asset?.metadata?.resultJson?.resultUrls?.[0] ||      // Sora/NanoBanana path
        asset?.metadata?.resultUrls?.[0] ||                  // Metadata array
        asset?.metadata?.resultUrl ||                        // Metadata single
        asset?.metadata?.result_url ||                       // Metadata snake_case
        asset?.metadata?.outputs?.[0]?.url ||                // Outputs array
        asset?.metadata?.resources?.[0]?.url ||              // Resources array
        asset?.apiResponse?.data?.resultUrl ||               // API response camelCase
        (asset?.apiResponse as any)?.data?.result_url ||     // API response snake_case
        ''
      );

      // Clean URL (remove null/undefined/empty)
      const cleanUrl = url && typeof url === 'string' && url.trim() !== '' ? url : '';

      // 🔍 DEBUG: Log exact asset structure for videos
      if (asset.type === 'video' && asset.status === 'ready') {
        console.log('[UGC Modal] Video asset:', {
          id: asset.id,
          status: asset.status,
          type: asset.type,
          resultUrl: asset.resultUrl,
          result_url: (asset as any).result_url,
          resultUrls: asset.resultUrls,
          extractedUrl: cleanUrl,
          allKeys: Object.keys(asset).slice(0, 15), // First 15 keys for debugging
        });
      }

      return cleanUrl;
    } catch (error) {
      console.error('[UGC Modal] Error extracting media URL:', error);
      setError(true);
      return '';
    }
  }, [asset]);

  // Memoized provider name formatting
  const providerName = useMemo(() => {
    if (!asset?.provider) return 'Unknown Provider';
    const providerNames: Record<string, string> = {
      'kie-veo3': 'KIE Veo3',
      'kie-4o-image': 'KIE 4O Image',
      'kie-flux-kontext': 'KIE Flux Kontext',
      'gemini-flash': 'Gemini Flash',
    };
    return providerNames[asset.provider] || asset.provider;
  }, [asset?.provider]);

  // Use for Video mutation (image → video)
  const useForVideoMutation = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error('No asset selected');
      const response = await apiRequest('POST', '/api/ai/media/use-for-video', {
        sourceAssetId: asset.id,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/media'] });
      toast({
        title: 'Video generation started! 🎬',
        description: 'Check the gallery for your new video (usually 1-2 minutes).',
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to start video generation',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Post mutation (reuses existing social posting)
  const postMutation = useMutation({
    mutationFn: async () => {
      let scheduledForUTC: string | undefined = undefined;

      if (isScheduled && scheduledDateTime) {
        const localDate = new Date(scheduledDateTime);
        scheduledForUTC = localDate.toISOString();
      }

      const response = await apiRequest('POST', '/api/social/post', {
        videoUrl: mediaUrl,
        platform: 'instagram',
        caption,
        ...(scheduledForUTC && { scheduledFor: scheduledForUTC }),
      });

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast({
        title: isScheduled ? 'Post scheduled! 🗓️' : 'Posted successfully! 🎉',
        description: isScheduled
          ? 'Your UGC ad will be posted at the scheduled time.'
          : 'Your UGC ad is now live on Instagram!',
      });
      setShowPostFlow(false);
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to post',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // ========================================
  // EVENT HANDLERS
  // ========================================

  const handleUseForVideo = () => {
    useForVideoMutation.mutate();
  };

  const handleShowPostFlow = () => {
    setShowPostFlow(true);
  };

  const handlePost = () => {
    postMutation.mutate();
  };

  const handleClose = () => {
    if (!postMutation.isPending && !useForVideoMutation.isPending) {
      setCaption('');
      setIsScheduled(false);
      setScheduledDateTime('');
      setShowPostFlow(false);
      setError(false);
      postMutation.reset();
      useForVideoMutation.reset();
      onClose();
    }
  };

  const handleMediaError = (type: 'image' | 'video') => {
    console.error(`[UGC Modal] ${type} load error for asset:`, asset?.id);
    setError(true);
  };

  const handlePostToInstagram = async () => {
    if (!mediaUrl || !asset) return;

    try {
      console.log('[UGC Modal] Posting asset to Instagram:', asset.id);
      const response = await apiRequest('POST', '/api/social/post', {
        videoUrl: mediaUrl,
        mediaAssetId: asset.id, // ✅ Send UGC video asset ID for database reference
        platform: 'instagram',
        caption: '',
      });

      const data = await response.json();

      toast({
        title: 'Posted successfully! 🎉',
        description: 'Your ad was sent to Instagram via Late.dev.',
      });

      handleClose();
    } catch (err: any) {
      console.error('[UGC Modal] Failed to post:', err);
      toast({
        title: 'Failed to post',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    }
  };

  // ========================================
  // CONDITIONAL RENDERING (AFTER ALL HOOKS)
  // ========================================

  console.log('[UGC Modal] Rendered with asset:', asset ? asset.id : 'null', 'mediaUrl:', mediaUrl);

  // Early return AFTER all hooks have been called
  if (!asset) return null;

  console.log('[UGC Modal] Rendering Dialog with open:', !!asset, 'error:', error);

  return (
    <Dialog open={!!asset} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0B0B0B] border-white/20 text-white z-[9999]"
        aria-describedby="ugc-ad-preview-description"
      >
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="text-xl font-semibold">
            {asset.type === 'image' ? '📸 UGC Ad Image' : '🎬 UGC Ad Video'}
          </DialogTitle>
          <DialogDescription id="ugc-ad-preview-description" className="text-white/70">
            <div className="flex items-center gap-2 text-sm mt-2">
              <span>{providerName}</span>
              <span>•</span>
              <span>
                {asset.createdAt
                  ? formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true })
                  : 'Recently created'}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Preview Section */}
        <div className="space-y-4">
          {/* Media Preview with crash protection */}
          <div className="flex justify-center items-center bg-black/40 rounded-lg p-6 min-h-[300px]">
            {error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <XCircle className="h-12 w-12 text-red-400/50 mb-3" />
                <p className="text-sm text-red-300/70 text-center max-w-md">
                  Failed to load media preview. The file may be unavailable or corrupted.
                </p>
              </div>
            ) : mediaUrl ? (
              asset.type === 'video' ? (
                <video
                  src={mediaUrl}
                  controls
                  className="max-h-[500px] rounded-lg shadow-xl"
                  preload="auto"
                  playsInline
                  crossOrigin="anonymous"
                  onError={() => handleMediaError('video')}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <img
                  src={mediaUrl}
                  alt={asset.prompt || 'UGC Ad'}
                  className="max-h-[500px] rounded-lg shadow-xl object-contain"
                  onError={() => handleMediaError('image')}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <ImageIcon className="h-12 w-12 text-white/30 mb-3" />
                <p className="text-sm text-white/50 text-center max-w-md">
                  {asset.status === 'processing'
                    ? 'This ad is still being generated. Preview will be available once complete.'
                    : asset.status === 'error'
                    ? 'Generation failed. No preview available.'
                    : 'No preview available for this generation.'}
                </p>
              </div>
            )}
          </div>

          {/* Prompt */}
          {asset.prompt && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white/90">Original Prompt</Label>
              <p className="text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg p-3">
                {asset.prompt}
              </p>
            </div>
          )}

          {/* Actions - Only show for ready status with valid URL */}
          {asset.status === 'ready' && !showPostFlow && mediaUrl && !error && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              {/* Primary Actions Row */}
              <div className="flex flex-wrap gap-2">
                {/* Use for Video (only for images) */}
                {asset.type === 'image' && (
                  <Button
                    onClick={handleUseForVideo}
                    disabled={useForVideoMutation.isPending}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {useForVideoMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <VideoIcon className="h-4 w-4 mr-2" />
                        Use for Video
                      </>
                    )}
                  </Button>
                )}

                {/* Post to Instagram */}
                <Button
                  onClick={handlePostToInstagram}
                  disabled={!mediaUrl}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Post to Instagram
                </Button>

                {/* Download */}
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  <a href={mediaUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Post Flow (caption + schedule) */}
          {showPostFlow && (
            <div className="space-y-4 border-t border-white/10 pt-4">
              {postMutation.isIdle && (
                <>
                  {/* Caption */}
                  <div className="space-y-2">
                    <Label htmlFor="caption" className="text-sm font-medium">
                      Caption (optional)
                    </Label>
                    <Textarea
                      id="caption"
                      placeholder="Add a caption for your post..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      maxLength={2200}
                      rows={4}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none"
                      disabled={postMutation.isPending}
                    />
                    <p className="text-xs text-white/50">
                      {caption.length} / 2200 characters
                    </p>
                  </div>

                  {/* Schedule Toggle */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="schedule-post"
                        checked={isScheduled}
                        onCheckedChange={(checked) => setIsScheduled(checked === true)}
                        disabled={postMutation.isPending}
                      />
                      <Label
                        htmlFor="schedule-post"
                        className="text-sm font-medium cursor-pointer flex items-center gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        Schedule post for later
                      </Label>
                    </div>

                    {isScheduled && (
                      <div className="space-y-2 pl-6">
                        <Label htmlFor="scheduled-datetime" className="text-sm">
                          Select date and time
                        </Label>
                        <Input
                          id="scheduled-datetime"
                          type="datetime-local"
                          value={scheduledDateTime}
                          onChange={(e) => setScheduledDateTime(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                          disabled={postMutation.isPending}
                          className="w-full bg-white/10 border-white/20 text-white"
                        />
                        <p className="text-xs text-white/50">
                          Your post will be published at this time (converts to UTC automatically)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowPostFlow(false)}
                      variant="outline"
                      disabled={postMutation.isPending}
                      className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handlePost}
                      disabled={postMutation.isPending || (isScheduled && !scheduledDateTime)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {postMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isScheduled ? 'Scheduling...' : 'Posting...'}
                        </>
                      ) : (
                        <>
                          {isScheduled && <Calendar className="mr-2 h-4 w-4" />}
                          {isScheduled ? 'Schedule Post' : 'Post Now'}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {postMutation.isSuccess && (
                <Alert className="border-green-500 bg-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <AlertDescription>
                    <p className="font-medium text-white">
                      {isScheduled ? 'Post scheduled successfully!' : 'Posted successfully!'}
                    </p>
                    <p className="text-sm text-white/70 mt-1">
                      {isScheduled
                        ? 'Your UGC ad will be posted at the scheduled time.'
                        : 'Your UGC ad is now live on Instagram!'}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {postMutation.isError && (
                <Alert className="border-red-500 bg-red-500/20">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription>
                    <p className="font-medium text-white">Failed to post</p>
                    <p className="text-sm text-white/70 mt-1">
                      {(postMutation.error as any)?.message || 'Please try again'}
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
