/**
 * Stock Footage Service - Pexels Integration (Jan 2026)
 * 
 * Fetches stock video footage from Pexels API for Content Engine.
 * Used by Remotion renderer to get background visuals for scenes.
 * 
 * Features:
 * - Search videos by keyword/query
 * - Return direct video URLs (no download needed)
 * - Caching to reduce API calls
 * - Fallback to placeholder content
 */

import axios from 'axios';

// ==================== CONFIGURATION ====================

const PEXELS_API_URL = 'https://api.pexels.com/videos';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// Video quality preference (from Pexels video files)
// Options: sd (540p), hd (720p), full_hd (1080p), 4k
const PREFERRED_QUALITY = 'hd'; // 720p is good balance for web

// Default search parameters
const DEFAULT_PER_PAGE = 5;
const DEFAULT_ORIENTATION = 'portrait'; // For vertical video (9:16)

// Fallback videos when search fails or API unavailable
const FALLBACK_VIDEOS = [
  'https://player.vimeo.com/external/370467553.sd.mp4?s=fallback1',
  'https://player.vimeo.com/external/370467554.sd.mp4?s=fallback2',
];

// ==================== TYPES ====================

export interface VideoResult {
  id: number;
  url: string;          // Direct video file URL
  width: number;
  height: number;
  duration: number;     // In seconds
  thumbnail: string;    // Thumbnail image URL
  photographer: string;
  pexelsUrl: string;    // Link to Pexels page (for attribution)
}

export interface SearchResult {
  success: boolean;
  videos: VideoResult[];
  total: number;
  error?: string;
  cached?: boolean;
}

// Simple in-memory cache
// Key: search query, Value: { videos, timestamp }
const searchCache = new Map<string, { videos: VideoResult[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ==================== SERVICE ====================

/**
 * Search for stock videos by query
 * 
 * @param query - Search query (e.g., "calm forest", "city timelapse")
 * @param count - Number of videos to return (default: 5)
 * @param orientation - Video orientation: landscape, portrait, square
 * @returns Promise with video URLs or error
 */
export async function searchVideos(
  query: string,
  count: number = DEFAULT_PER_PAGE,
  orientation: 'landscape' | 'portrait' | 'square' = DEFAULT_ORIENTATION
): Promise<SearchResult> {
  if (!PEXELS_API_KEY) {
    console.warn('[StockFootage] Pexels API key not configured, using fallbacks');
    return {
      success: true,
      videos: getFallbackVideos(count),
      total: FALLBACK_VIDEOS.length,
      error: 'Pexels API key not configured',
    };
  }

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      videos: [],
      total: 0,
      error: 'Search query cannot be empty',
    };
  }

  // Check cache
  const cacheKey = `${query.toLowerCase().trim()}-${orientation}-${count}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[StockFootage] Cache hit for query:', query);
    return {
      success: true,
      videos: cached.videos.slice(0, count),
      total: cached.videos.length,
      cached: true,
    };
  }

  try {
    console.log('[StockFootage] Searching Pexels for:', query);
    
    const response = await axios.get(`${PEXELS_API_URL}/search`, {
      headers: {
        'Authorization': PEXELS_API_KEY,
      },
      params: {
        query: query.trim(),
        per_page: Math.min(count * 2, 20), // Fetch extra in case some don't have preferred quality
        orientation,
      },
      timeout: 10000, // 10 second timeout
    });

    const videos: VideoResult[] = [];
    
    for (const video of response.data.videos || []) {
      // Find the best quality video file
      const videoFile = findBestVideoFile(video.video_files);
      
      if (videoFile) {
        videos.push({
          id: video.id,
          url: videoFile.link,
          width: videoFile.width,
          height: videoFile.height,
          duration: video.duration,
          thumbnail: video.image,
          photographer: video.user?.name || 'Pexels',
          pexelsUrl: video.url,
        });
      }

      if (videos.length >= count) break;
    }

    // Cache the results
    searchCache.set(cacheKey, { videos, timestamp: Date.now() });

    console.log(`[StockFootage] Found ${videos.length} videos for: ${query}`);

    return {
      success: true,
      videos,
      total: response.data.total_results || videos.length,
      cached: false,
    };

  } catch (error: any) {
    console.error('[StockFootage] Error searching Pexels:', error.response?.data || error.message);
    
    // Return fallback videos on error
    return {
      success: false,
      videos: getFallbackVideos(count),
      total: FALLBACK_VIDEOS.length,
      error: error.response?.status === 429 
        ? 'Pexels rate limit exceeded' 
        : error.message || 'Failed to search stock footage',
    };
  }
}

/**
 * Search for videos matching visual intent from a scene
 * Extracts keywords and searches Pexels
 */
export async function searchByVisualIntent(
  visualIntent: string,
  count: number = 3
): Promise<SearchResult> {
  // Extract key terms from visual intent
  const keywords = extractKeywords(visualIntent);
  const query = keywords.join(' ');
  
  console.log(`[StockFootage] Visual intent: "${visualIntent}" -> Query: "${query}"`);
  
  return searchVideos(query, count);
}

/**
 * Get video URLs for multiple scenes
 * Returns array of video URLs in same order as input
 */
export async function getFootageForScenes(
  visualIntents: string[],
  videosPerScene: number = 1
): Promise<{ success: boolean; videoUrls: string[][]; errors: string[] }> {
  const videoUrls: string[][] = [];
  const errors: string[] = [];

  for (let i = 0; i < visualIntents.length; i++) {
    const intent = visualIntents[i];
    console.log(`[StockFootage] Fetching footage for scene ${i + 1}/${visualIntents.length}`);
    
    const result = await searchByVisualIntent(intent, videosPerScene);
    
    if (result.success && result.videos.length > 0) {
      videoUrls.push(result.videos.map(v => v.url));
    } else {
      videoUrls.push(getFallbackVideos(videosPerScene).map(v => v.url));
      if (result.error) {
        errors.push(`Scene ${i + 1}: ${result.error}`);
      }
    }

    // Small delay between requests to respect rate limits
    if (i < visualIntents.length - 1) {
      await sleep(200);
    }
  }

  return {
    success: errors.length === 0,
    videoUrls,
    errors,
  };
}

/**
 * Get popular/trending videos (no search query)
 */
export async function getPopularVideos(count: number = 5): Promise<SearchResult> {
  if (!PEXELS_API_KEY) {
    return {
      success: true,
      videos: getFallbackVideos(count),
      total: FALLBACK_VIDEOS.length,
    };
  }

  try {
    const response = await axios.get(`${PEXELS_API_URL}/popular`, {
      headers: {
        'Authorization': PEXELS_API_KEY,
      },
      params: {
        per_page: count,
      },
      timeout: 10000,
    });

    const videos: VideoResult[] = [];
    
    for (const video of response.data.videos || []) {
      const videoFile = findBestVideoFile(video.video_files);
      if (videoFile) {
        videos.push({
          id: video.id,
          url: videoFile.link,
          width: videoFile.width,
          height: videoFile.height,
          duration: video.duration,
          thumbnail: video.image,
          photographer: video.user?.name || 'Pexels',
          pexelsUrl: video.url,
        });
      }
    }

    return { success: true, videos, total: response.data.total_results || videos.length };

  } catch (error: any) {
    return {
      success: false,
      videos: getFallbackVideos(count),
      total: FALLBACK_VIDEOS.length,
      error: error.message,
    };
  }
}

// ==================== UTILITIES ====================

/**
 * Find the best video file from Pexels video_files array
 * Prefers HD quality, falls back to SD
 */
function findBestVideoFile(videoFiles: any[]): { link: string; width: number; height: number } | null {
  if (!videoFiles || videoFiles.length === 0) return null;

  // Sort by quality preference
  const qualityOrder = ['hd', 'sd', 'full_hd', '4k'];
  const qualityIndex = qualityOrder.indexOf(PREFERRED_QUALITY);
  
  // Try preferred quality first, then alternatives
  for (const quality of [...qualityOrder.slice(qualityIndex), ...qualityOrder.slice(0, qualityIndex)]) {
    const file = videoFiles.find((f: any) => f.quality === quality);
    if (file) {
      return { link: file.link, width: file.width, height: file.height };
    }
  }

  // Fallback to first available
  const first = videoFiles[0];
  return { link: first.link, width: first.width, height: first.height };
}

/**
 * Extract keywords from visual intent description
 */
function extractKeywords(visualIntent: string): string[] {
  // Remove common filler words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'that', 'this', 'these', 'those', 'it', 'its', 'show', 'showing',
    'display', 'displays', 'featuring', 'features', 'scene', 'shot',
  ]);

  // Extract words, filter stop words, take top keywords
  const words = visualIntent
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Return unique keywords, max 5
  return [...new Set(words)].slice(0, 5);
}

/**
 * Get fallback videos when API is unavailable
 */
function getFallbackVideos(count: number): VideoResult[] {
  // Generic nature/abstract footage as fallback
  const fallbacks: VideoResult[] = [
    {
      id: 1,
      url: 'https://videos.pexels.com/video-files/3571264/3571264-sd_640_360_30fps.mp4',
      width: 640,
      height: 360,
      duration: 10,
      thumbnail: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg',
      photographer: 'Pexels',
      pexelsUrl: 'https://www.pexels.com/video/3571264/',
    },
    {
      id: 2,
      url: 'https://videos.pexels.com/video-files/857195/857195-sd_640_360_25fps.mp4',
      width: 640,
      height: 360,
      duration: 15,
      thumbnail: 'https://images.pexels.com/videos/857195/free-video-857195.jpg',
      photographer: 'Pexels',
      pexelsUrl: 'https://www.pexels.com/video/857195/',
    },
  ];

  // Repeat fallbacks if needed
  const result: VideoResult[] = [];
  for (let i = 0; i < count; i++) {
    result.push(fallbacks[i % fallbacks.length]);
  }
  return result;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== EXPORTS ====================

export const stockFootageService = {
  searchVideos,
  searchByVisualIntent,
  getFootageForScenes,
  getPopularVideos,
};

export default stockFootageService;
