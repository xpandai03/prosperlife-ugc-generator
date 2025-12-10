/**
 * Analytics & Schedule Dashboard - Phase 7.4
 *
 * Combined view with two modes:
 * - Analytics: View post performance metrics from Late.dev
 * - Schedule: View and manage scheduled Instagram posts
 *
 * Toggle between modes using tabs at the top of the page.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Loader2,
  RefreshCw,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'wouter';
import { format, formatDistanceToNow } from 'date-fns';

// ============================================
// TYPES
// ============================================

interface ScheduledPost {
  id: number;
  platform: string;
  caption: string | null;
  scheduledFor: string | null;
  isScheduled: string;
  status: string;
  platformPostUrl: string | null;
  errorMessage: string | null;
  captionSource: string | null;
  publishedAt: string | null;
  createdAt: string;
  projectId: string | null;
  taskId: string | null;
  mediaAssetId: string | null;
}

interface ScheduledPostsResponse {
  posts: ScheduledPost[];
  count: number;
}

interface PostMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  clicks: number;
}

interface AnalyticsPost {
  id: string;
  thumbnailUrl: string | null;
  caption: string;
  createdAt: string;
  platformPostUrl: string | null;
  platform: string;
  metrics: PostMetrics;
}

interface AnalyticsSummary {
  views: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
}

interface AnalyticsResponse {
  summary: AnalyticsSummary;
  posts: AnalyticsPost[];
}

// ============================================
// HELPER COMPONENTS
// ============================================

// Status badge for scheduled posts
const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    scheduled: { icon: Clock, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    posting: { icon: RefreshCw, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 animate-pulse' },
    published: { icon: CheckCircle2, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
    failed: { icon: XCircle, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    draft: { icon: AlertCircle, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
  };

  const { icon: Icon, color } = config[status as keyof typeof config] || config.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Format large numbers with K/M suffix
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// ============================================
// ANALYTICS VIEW COMPONENT
// ============================================

function AnalyticsView() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery<AnalyticsResponse>({
    queryKey: ['/api/analytics/posts'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 mb-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-medium text-white mb-2">Failed to load analytics</h2>
          <p className="text-gray-400 mb-6">
            {(error as Error).message || 'Unable to fetch analytics data. Please try again.'}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const summary = data?.summary || { views: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0 };
  const posts = data?.posts || [];

  // Summary metric cards config
  const summaryMetrics = [
    { label: 'Views', value: summary.views, icon: Eye, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { label: 'Impressions', value: summary.impressions, icon: TrendingUp, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    { label: 'Reach', value: summary.reach, icon: Users, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    { label: 'Likes', value: summary.likes, icon: Heart, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    { label: 'Comments', value: summary.comments, icon: MessageCircle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    { label: 'Shares', value: summary.shares, icon: Share2, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-purple-400" />
            Post Performance
          </h2>
          <p className="text-gray-400 mt-1">
            Track engagement metrics across your published posts
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isRefetching}
          variant="outline"
          size="sm"
          className="border-white/20 text-white hover:bg-white/10"
        >
          {isRefetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryMetrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 hover:bg-white/8 transition-colors"
          >
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${metric.bgColor} mb-3`}>
              <metric.icon className={`h-5 w-5 ${metric.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(metric.value)}</p>
            <p className="text-sm text-gray-400">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Posts Performance */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Post Details</h3>

        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No posts yet</h3>
            <p className="text-gray-400">
              Your published posts and their metrics will appear here
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 hover:bg-white/8 transition-colors"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden">
                    {post.thumbnailUrl ? (
                      <img
                        src={post.thumbnailUrl}
                        alt="Post thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        video
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white line-clamp-2 mb-2">
                      {post.caption || <span className="text-gray-500 italic">No caption</span>}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{format(new Date(post.createdAt), 'MMM d, yyyy')}</span>
                      <span className="capitalize">{post.platform}</span>
                      {post.platformPostUrl && (
                        <a
                          href={post.platformPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/10">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-400">
                      <Eye className="h-3 w-3" />
                      <span className="text-sm font-medium">{formatNumber(post.metrics.views)}</span>
                    </div>
                    <p className="text-xs text-gray-500">Views</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-red-400">
                      <Heart className="h-3 w-3" />
                      <span className="text-sm font-medium">{formatNumber(post.metrics.likes)}</span>
                    </div>
                    <p className="text-xs text-gray-500">Likes</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-yellow-400">
                      <MessageCircle className="h-3 w-3" />
                      <span className="text-sm font-medium">{formatNumber(post.metrics.comments)}</span>
                    </div>
                    <p className="text-xs text-gray-500">Comments</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-purple-400">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-sm font-medium">{formatNumber(post.metrics.impressions)}</span>
                    </div>
                    <p className="text-xs text-gray-500">Impr.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SCHEDULE VIEW COMPONENT
// ============================================

function ScheduleView() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch scheduled posts with auto-refresh every 30 seconds
  const { data, isLoading, refetch, isRefetching } = useQuery<ScheduledPostsResponse>({
    queryKey: ['/api/social/scheduled', statusFilter],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const posts = data?.posts || [];

  // Filter counts
  const counts = {
    all: posts.length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    posting: posts.filter(p => p.status === 'posting').length,
    published: posts.filter(p => p.status === 'published').length,
    failed: posts.filter(p => p.status === 'failed').length,
  };

  // Filter posts based on selected status
  const filteredPosts = statusFilter === 'all'
    ? posts
    : posts.filter(p => p.status === statusFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading scheduled posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Calendar className="h-7 w-7 text-blue-400" />
            Scheduled Posts
          </h2>
          <p className="text-gray-400 mt-1">
            View and manage your scheduled Instagram posts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => refetch()}
            disabled={isRefetching}
            variant="outline"
            size="sm"
            className="border-white/20 text-white hover:bg-white/10"
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button asChild>
            <Link href="/ai-studio">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule New Post
            </Link>
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'All Posts' },
          { value: 'scheduled', label: 'Scheduled' },
          { value: 'posting', label: 'Posting' },
          { value: 'published', label: 'Published' },
          { value: 'failed', label: 'Failed' },
        ].map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${statusFilter === filter.value
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }
            `}
          >
            {filter.label}
            <span className="ml-2 text-xs opacity-75">
              ({counts[filter.value as keyof typeof counts]})
            </span>
          </button>
        ))}
      </div>

      {/* Posts Table */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-16 bg-white/5 rounded-xl border border-white/10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 mb-6">
            <Calendar className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-medium text-white mb-2">
            No {statusFilter !== 'all' ? statusFilter : ''} posts
          </h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            {statusFilter === 'all'
              ? 'Schedule your first post from the AI Studio'
              : `No posts with "${statusFilter}" status`}
          </p>
          <Button asChild>
            <Link href="/ai-studio">
              <Calendar className="h-5 w-5 mr-2" />
              Schedule Post
            </Link>
          </Button>
        </div>
      ) : (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Post
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Scheduled For
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-white/5 transition-colors">
                    {/* Post Caption */}
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <p className="text-sm text-white line-clamp-2">
                          {post.caption || <span className="text-white/40 italic">No caption</span>}
                        </p>
                        {post.captionSource && (
                          <p className="text-xs text-white/40 mt-1">
                            {post.captionSource === 'ai_auto' && '🤖 Auto-generated'}
                            {post.captionSource === 'ai_manual' && '🤖 AI-assisted'}
                            {post.captionSource === 'manual' && '✍️ Manual'}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Scheduled Time */}
                    <td className="px-6 py-4">
                      {post.scheduledFor ? (
                        <div>
                          <p className="text-sm text-white font-medium">
                            {format(new Date(post.scheduledFor), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-white/60">
                            {format(new Date(post.scheduledFor), 'h:mm a')}
                          </p>
                          <p className="text-xs text-white/40 mt-1">
                            {formatDistanceToNow(new Date(post.scheduledFor), { addSuffix: true })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-white/40">Not scheduled</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={post.status} />
                      {post.publishedAt && (
                        <p className="text-xs text-white/40 mt-1">
                          Published {formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })}
                        </p>
                      )}
                      {post.errorMessage && (
                        <p className="text-xs text-red-400 mt-1 line-clamp-1" title={post.errorMessage}>
                          {post.errorMessage}
                        </p>
                      )}
                    </td>

                    {/* Platform */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-white/80">
                        {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {post.platformPostUrl && (
                          <a
                            href={post.platformPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-4 bg-white/5 border-t border-white/10">
            <p className="text-sm text-white/60">
              Showing {filteredPosts.length} of {posts.length} total posts
              {statusFilter !== 'all' && ` · Filtered by: ${statusFilter}`}
            </p>
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center">
        <p className="text-xs text-white/40 flex items-center justify-center gap-2">
          <RefreshCw className="h-3 w-3" />
          Auto-refreshing every 30 seconds
        </p>
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function ScheduleDashboard() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'schedule'>('analytics');

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-24 pb-8">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`
                px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                ${activeTab === 'analytics'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`
                px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                ${activeTab === 'schedule'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </button>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'analytics' ? <AnalyticsView /> : <ScheduleView />}
      </div>
    </div>
  );
}
