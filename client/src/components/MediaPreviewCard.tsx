/**
 * Media Preview Card Component - Phase 4.4
 *
 * Gallery card for displaying AI-generated media assets
 * - Shows image or video preview
 * - Status badges (processing/ready/error)
 * - Action buttons (Post, Download)
 * - Integrates with caption generation and scheduling
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
}

interface MediaPreviewCardProps {
  asset: MediaAsset;
  onClick?: () => void;
}

export function MediaPreviewCard({ asset, onClick }: MediaPreviewCardProps) {
  const [showPostModal, setShowPostModal] = useState(false);
  const [imageError, setImageError] = useState(false);

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

  return (
    <Card
      className="bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden hover:bg-white/10 transition-all cursor-pointer"
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
      </div>

      {/* Card Content */}
      <CardContent className="p-4 space-y-2">
        {/* Prompt */}
        <p className="text-sm text-white/90 line-clamp-2 leading-relaxed">
          {asset.prompt}
        </p>

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
    </Card>
  );
}
