/**
 * Content Engine Video Viewer Page (Jan 2026)
 * 
 * Dedicated viewer for Content Engine long-form videos.
 * Displays the rendered video with metadata and download option.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Clock, Calendar, FileVideo, Loader2, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAuthHeaders } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

// ==================== TYPES ====================

interface MediaAsset {
  id: string;
  userId: string;
  provider: string;
  type: string;
  prompt: string;
  status: string;
  resultUrl?: string;
  metadata?: {
    sceneSpecId?: string;
    targetDuration?: number;
    fps?: number;
    width?: number;
    height?: number;
    sceneCount?: number;
  };
  createdAt: string;
  completedAt?: string;
}

interface SceneSpec {
  id: string;
  title: string;
  description?: string;
  targetDuration: number;
  status: string;
  scenes?: any[];
  tags?: string[];
}

// ==================== COMPONENT ====================

export default function ContentEngineVideoPage() {
  const { id } = useParams<{ id: string }>();
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch media asset
  const { data: assetData, isLoading: assetLoading, error: assetError } = useQuery({
    queryKey: ['/api/ai/media', id],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/ai/media/${id}`, {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to fetch video');
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch scene spec if we have the ID
  const sceneSpecId = assetData?.asset?.metadata?.sceneSpecId || assetData?.asset?.sceneSpecId;
  const { data: specData } = useQuery({
    queryKey: ['/api/content-engine/specs', sceneSpecId],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/content-engine/specs/${sceneSpecId}`, {
        headers: authHeaders,
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!sceneSpecId,
  });

  const asset: MediaAsset | null = assetData?.asset || null;
  const spec: SceneSpec | null = specData?.spec || null;

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle download
  const handleDownload = () => {
    if (asset?.resultUrl) {
      const a = document.createElement('a');
      a.href = asset.resultUrl;
      a.download = `${spec?.title || 'content-engine-video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // ==================== LOADING STATE ====================
  if (assetLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading video...</p>
        </div>
      </div>
    );
  }

  // ==================== ERROR STATE ====================
  if (assetError || !asset) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Video Not Found</h2>
            <p className="text-slate-400 mb-6">
              The video you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link href="/content-engine">
              <Button variant="outline" className="border-slate-600 text-slate-300">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Content Engine
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== PROCESSING STATE ====================
  if (asset.status === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Rendering in Progress</h2>
            <p className="text-slate-400 mb-6">
              Your video is being rendered. This may take several minutes for long-form content.
            </p>
            <Link href="/content-engine">
              <Button variant="outline" className="border-slate-600 text-slate-300">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Content Engine
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== FAILED STATE ====================
  if (asset.status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Render Failed</h2>
            <p className="text-slate-400 mb-6">
              There was an error rendering this video. Please try again or contact support.
            </p>
            <Link href="/content-engine">
              <Button variant="outline" className="border-slate-600 text-slate-300">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Content Engine
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== MAIN VIEW ====================
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/content-engine">
            <Button variant="ghost" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Content Engine
            </Button>
          </Link>
          {asset.resultUrl && (
            <Button
              onClick={handleDownload}
              variant="outline"
              className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </div>

        {/* Video Player */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-0">
            {asset.resultUrl ? (
              <div className="relative aspect-[9/16] max-h-[70vh] mx-auto bg-black rounded-lg overflow-hidden">
                <video
                  src={asset.resultUrl}
                  controls
                  autoPlay={false}
                  className="w-full h-full object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="aspect-[9/16] max-h-[70vh] mx-auto bg-slate-900 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <FileVideo className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">Video not available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video Info */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-white text-xl mb-2">
                  {spec?.title || 'Content Engine Video'}
                </CardTitle>
                {spec?.description && (
                  <p className="text-slate-400 text-sm">{spec.description}</p>
                )}
              </div>
              <Badge
                variant="secondary"
                className={
                  asset.status === 'ready'
                    ? 'bg-green-600/20 text-green-400'
                    : 'bg-slate-600/20 text-slate-400'
                }
              >
                {asset.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Duration */}
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  {asset.metadata?.targetDuration
                    ? formatDuration(asset.metadata.targetDuration)
                    : spec?.targetDuration
                    ? formatDuration(spec.targetDuration)
                    : 'Unknown'}
                </span>
              </div>

              {/* Created */}
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">
                  {formatDistanceToNow(new Date(asset.createdAt))} ago
                </span>
              </div>

              {/* Resolution */}
              {asset.metadata?.width && asset.metadata?.height && (
                <div className="flex items-center gap-2 text-slate-400">
                  <FileVideo className="w-4 h-4" />
                  <span className="text-sm">
                    {asset.metadata.width}x{asset.metadata.height}
                  </span>
                </div>
              )}

              {/* Scenes */}
              {(asset.metadata?.sceneCount || spec?.scenes?.length) && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Play className="w-4 h-4" />
                  <span className="text-sm">
                    {asset.metadata?.sceneCount || spec?.scenes?.length} scenes
                  </span>
                </div>
              )}
            </div>

            {/* Tags */}
            {spec?.tags && spec.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex flex-wrap gap-2">
                  {spec.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs border-slate-600 text-slate-400">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Direct URL */}
            {asset.resultUrl && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2">Direct URL:</p>
                <a
                  href={asset.resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:underline break-all"
                >
                  {asset.resultUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
