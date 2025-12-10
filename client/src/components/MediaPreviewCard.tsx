/**
 * Media Preview Card Component - Phase 4.4 (Updated Dec 2025)
 *
 * Gallery card for displaying AI-generated media assets
 * - Shows image or video preview
 * - Status badges (processing/ready/error)
 * - Action buttons (Post, Download)
 * - Rating (1-5 stars)
 * - Delete button with confirmation
 * - Integrates with caption generation and scheduling
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RatingStars } from "@/components/ui/RatingStars";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/queryClient";

// TypeScript interface
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
  rating?: number | null;
  deletedAt?: string | null;
}

interface MediaPreviewCardProps {
  asset: MediaAsset;
  onClick?: () => void;
}

export function MediaPreviewCard({ asset, onClick }: MediaPreviewCardProps) {
  const [showPostModal, setShowPostModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // For fade-out animation
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Delete mutation with optimistic fade-out
  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/ai/media/${assetId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }

      return await response.json();
    },
    onMutate: () => {
      // Start fade-out animation immediately (optimistic)
      setIsDeleting(true);
    },
    onSuccess: () => {
      // After fade animation completes, refresh the gallery
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/ai/media'] });
      }, 300); // Match animation duration
      toast({
        title: 'Deleted',
        description: 'UGC ad removed from your gallery',
      });
    },
    onError: (error: Error) => {
      // Revert fade-out if delete failed
      setIsDeleting(false);
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Rating mutation
  const ratingMutation = useMutation({
    mutationFn: async ({ assetId, rating }: { assetId: string; rating: number }) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/ai/media/${assetId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rate');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      // Optimistic update - invalidate to refresh
      queryClient.invalidateQueries({ queryKey: ['/api/ai/media'] });
      toast({
        title: 'Rated',
        description: `You rated this ad ${data.asset.rating} star${data.asset.rating !== 1 ? 's' : ''}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Rating failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(asset.id);
    setShowDeleteConfirm(false);
  };

  const handleRatingChange = (rating: number) => {
    ratingMutation.mutate({ assetId: asset.id, rating });
  };

  // Robust URL extraction with ALL possible paths (Drizzle + API variations)
  const getMediaUrl = (): string | null => {
    // Try all possible field name variations
    const url = (
      asset.resultUrl ||                                  // Drizzle camelCase
      (asset as any).result_url ||                        // Drizzle snake_case fallback
      asset.resultUrls?.[0] ||                            // Array format (camelCase)
      (asset as any).result_urls?.[0] ||                  // Array format (snake_case)
      asset.metadata?.response?.resultUrls?.[0] ||        // KIE nested path
      asset.metadata?.resultJson?.resultUrls?.[0] ||      // Sora/NanoBanana path
      asset.metadata?.resultUrls?.[0] ||                  // Metadata array
      asset.metadata?.resultUrl ||                        // Metadata single
      asset.metadata?.result_url ||                       // Metadata snake_case
      asset.metadata?.outputs?.[0]?.url ||                // Outputs array
      asset.apiResponse?.data?.resultUrl ||               // API response camelCase
      (asset.apiResponse as any)?.data?.result_url ||     // API response snake_case
      null
    );

    // Clean URL (remove null/undefined/empty)
    return url && typeof url === 'string' && url.trim() !== '' ? url : null;
  };

  const mediaUrl = getMediaUrl();

  // 🔍 DEBUG: Log exact asset structure for videos
  if (asset.type === 'video' && asset.status === 'ready') {
    console.log('[MediaPreviewCard] Video asset:', {
      id: asset.id,
      status: asset.status,
      type: asset.type,
      resultUrl: asset.resultUrl,
      result_url: (asset as any).result_url,
      resultUrls: asset.resultUrls,
      extractedUrl: mediaUrl,
      allKeys: Object.keys(asset).slice(0, 15), // First 15 keys for debugging
    });
  }

  // Format provider name for display
  const formatProviderName = (provider: string) => {
    const providerNames: Record<string, string> = {
      'kie-veo3': 'KIE Veo3',
      'kie-4o-image': 'KIE 4O Image',
      'kie-flux-kontext': 'KIE Flux Kontext',
      'gemini-flash': 'Gemini Flash',
    };
    return providerNames[provider] || provider;
  };

  // Get status badge variant
  const getStatusVariant = () => {
    switch (asset.status) {
      case 'ready':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Don't render if fully deleted (after animation)
  if (isDeleting && deleteMutation.isSuccess) {
    return null;
  }

  return (
    <Card
      className={`bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden hover:bg-white/10 cursor-pointer transition-all duration-300 ${
        isDeleting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      onClick={onClick}
    >
      {/* Media Preview Section */}
      <div className="relative aspect-video bg-black/20">
        {/* Processing State */}
        {asset.status === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 text-white animate-spin mb-3" />
            <p className="text-sm text-white/70 font-medium">Creating Ad...</p>
            <p className="text-xs text-white/50 mt-1">
              Usually takes 1–2 minutes
            </p>
          </div>
        )}

        {/* Ready State - Image */}
        {asset.status === 'ready' && asset.type === 'image' && mediaUrl && (
          <>
            {!imageError ? (
              <img
                src={mediaUrl}
                alt={asset.prompt}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <ImageIcon className="h-8 w-8 text-white/50 mb-2" />
                <p className="text-sm text-white/70">Image unavailable</p>
              </div>
            )}
          </>
        )}

        {/* Ready State - Video */}
        {asset.status === 'ready' && asset.type === 'video' && mediaUrl && (
          <video
            src={mediaUrl}
            controls
            className="w-full h-full object-cover"
            preload="auto"
            playsInline
            crossOrigin="anonymous"
          >
            Your browser does not support the video tag.
          </video>
        )}

        {/* Ready Video BUT No URL (Debug Case) */}
        {asset.status === 'ready' && asset.type === 'video' && !mediaUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-500/10">
            <VideoIcon className="h-8 w-8 text-yellow-400 mb-3" />
            <p className="text-sm text-yellow-300 font-medium mb-1">Video Ready - URL Missing</p>
            <p className="text-xs text-yellow-300/80 px-4 text-center">
              Generation complete but preview URL not found. Check console logs.
            </p>
          </div>
        )}

        {/* Error State */}
        {asset.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10">
            <XCircle className="h-8 w-8 text-red-400 mb-3" />
            <p className="text-sm text-red-300 font-medium mb-1">Ad Generation Failed</p>
            <p className="text-xs text-red-300/80 px-4 text-center">
              {asset.errorMessage || 'Something went wrong. Try again with a different prompt.'}
            </p>
            {asset.retryCount > 0 && (
              <p className="text-xs text-red-300/60 mt-2">
                Retried {asset.retryCount} {asset.retryCount === 1 ? 'time' : 'times'}
              </p>
            )}
          </div>
        )}

        {/* Status Badge (Top Right) */}
        <div className="absolute top-3 right-3 z-10">
          <Badge
            variant={getStatusVariant()}
            className="bg-black/60 backdrop-blur-sm border-0 shadow-lg"
          >
            {asset.status === 'processing' && (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Creating Ad...
              </>
            )}
            {asset.status === 'ready' && (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready to Review
              </>
            )}
            {asset.status === 'error' && (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Generation Failed
              </>
            )}
          </Badge>
        </div>

        {/* Type Badge (Top Left) - Icon Only */}
        <div className="absolute top-3 left-3 z-10">
          <Badge
            variant="outline"
            className="bg-black/60 backdrop-blur-sm border-white/20 px-2"
          >
            {asset.type === 'image' ? (
              <span className="text-base">📸</span>
            ) : (
              <span className="text-base">🎥</span>
            )}
          </Badge>
        </div>

        {/* Delete Button (Bottom Right) */}
        <div className="absolute bottom-3 right-3 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-black/60 backdrop-blur-sm hover:bg-red-500/80 text-white/70 hover:text-white transition-all"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Card Content */}
      <CardContent className="p-4 space-y-3">
        {/* Prompt */}
        <p className="text-sm text-white/90 line-clamp-2 leading-relaxed">
          {asset.prompt}
        </p>

        {/* Rating (only for ready assets) */}
        {asset.status === 'ready' && (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()} // Prevent card click when rating
          >
            <RatingStars
              rating={asset.rating}
              onChange={handleRatingChange}
              size="sm"
            />
            {ratingMutation.isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-white/50" />
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="font-medium">{formatProviderName(asset.provider)}</span>
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true })}
          </span>
        </div>
      </CardContent>

      {/* Click hint for ready assets */}
      {asset.status === 'ready' && mediaUrl && (
        <div className="px-4 pb-4 pt-2">
          <p className="text-xs text-white/40 text-center hover:text-white/60 transition-colors">
            Click to view, post, or download
          </p>
        </div>
      )}

      {/* Retry hint for failed assets */}
      {asset.status === 'error' && asset.retryCount < 3 && (
        <div className="px-4 pb-4 pt-2">
          <p className="text-xs text-red-300/60 text-center hover:text-red-300/80 transition-colors">
            Click to retry ({3 - asset.retryCount} {3 - asset.retryCount === 1 ? 'attempt' : 'attempts'} remaining)
          </p>
        </div>
      )}

      {/* Max retries reached */}
      {asset.status === 'error' && asset.retryCount >= 3 && (
        <div className="px-4 pb-4 pt-2">
          <p className="text-xs text-red-300/40 text-center">
            Max retry attempts reached
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[#1a1a1a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete this UGC ad?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This will remove the ad from your gallery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
