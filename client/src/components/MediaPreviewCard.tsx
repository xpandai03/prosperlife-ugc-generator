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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Video as VideoIcon,
  Calendar,
  Download,
  ExternalLink,
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
}

export function MediaPreviewCard({ asset }: MediaPreviewCardProps) {
  const [showPostModal, setShowPostModal] = useState(false);
  const [imageError, setImageError] = useState(false);

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
    <Card className="bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden hover:bg-white/10 transition-all">
      {/* Media Preview Section */}
      <div className="relative aspect-video bg-black/20">
        {/* Processing State */}
        {asset.status === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 text-white animate-spin mb-3" />
            <p className="text-sm text-white/70 font-medium">Generating...</p>
            <p className="text-xs text-white/50 mt-1">
              This may take a few minutes
            </p>
          </div>
        )}

        {/* Ready State - Image */}
        {asset.status === 'ready' && asset.type === 'image' && asset.resultUrl && (
          <>
            {!imageError ? (
              <img
                src={asset.resultUrl}
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
        {asset.status === 'ready' && asset.type === 'video' && asset.resultUrl && (
          <video
            src={asset.resultUrl}
            controls
            className="w-full h-full object-cover"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        )}

        {/* Error State */}
        {asset.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10">
            <XCircle className="h-8 w-8 text-red-400 mb-3" />
            <p className="text-sm text-red-300 font-medium mb-1">Generation Failed</p>
            <p className="text-xs text-red-300/80 px-4 text-center">
              {asset.errorMessage || 'An error occurred during generation'}
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
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            {asset.status === 'ready' && (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            )}
            {asset.status === 'error' && (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
          </Badge>
        </div>

        {/* Type Badge (Top Left) */}
        <div className="absolute top-3 left-3 z-10">
          <Badge
            variant="outline"
            className="bg-black/60 backdrop-blur-sm border-white/20"
          >
            {asset.type === 'image' ? (
              <>
                <ImageIcon className="h-3 w-3 mr-1" />
                Image
              </>
            ) : (
              <>
                <VideoIcon className="h-3 w-3 mr-1" />
                Video
              </>
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

      {/* Actions (only show for ready state) */}
      {asset.status === 'ready' && asset.resultUrl && (
        <CardFooter className="p-4 pt-0 flex flex-wrap gap-2">
          {/* Download Button */}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
            asChild
          >
            <a
              href={asset.resultUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </a>
          </Button>

          {/* Open in New Tab Button */}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10"
            asChild
          >
            <a
              href={asset.resultUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </a>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
