/**
 * Apify Crawler Service (Jan 2026)
 *
 * Triggers Apify Website Content Crawler for generic product page ingestion.
 * Returns raw crawl output for normalization.
 */

import axios from 'axios';

// ==================== TYPES ====================

export interface ApifyCrawlResult {
  url: string;
  loadedUrl?: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    keywords?: string;
    languageCode?: string;
    openGraph?: Array<{ property: string; content: string }>;
    twitter?: Array<{ property: string; content: string }>;
    jsonLd?: any[];
    headers?: Record<string, string>;
  };
  text?: string;
  markdown?: string;
  html?: string;
  screenshotUrl?: string;
  crawl?: {
    loadedAt: string;
    uniqueKey: string;
    httpStatusCode: number;
  };
}

export interface ApifyCrawlResponse {
  success: boolean;
  data?: ApifyCrawlResult;
  error?: string;
  runId?: string;
  duration?: number;
}

// ==================== CONFIG ====================

const APIFY_API_TOKEN = process.env.APIFY_API_KEY || process.env.APIFY_API_TOKEN;
const APIFY_BASE_URL = 'https://api.apify.com/v2';

// Website Content Crawler actor ID (use tilde format for Apify API)
const WEBSITE_CONTENT_CRAWLER_ACTOR_ID = 'apify~website-content-crawler';

// Polling configuration
const POLL_INTERVAL_MS = 3000; // 3 seconds
const MAX_POLL_ATTEMPTS = 40; // 2 minutes max wait

// ==================== SERVICE ====================

/**
 * Crawl a single product page URL using Apify Website Content Crawler
 */
export async function crawlProductPage(url: string): Promise<ApifyCrawlResponse> {
  const startTime = Date.now();

  if (!APIFY_API_TOKEN) {
    console.error('[Apify Crawler] APIFY_API_KEY not configured');
    return {
      success: false,
      error: 'Apify API key not configured. Please set APIFY_API_KEY environment variable.',
    };
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return {
      success: false,
      error: 'Invalid URL provided',
    };
  }

  console.log(`[Apify Crawler] Starting crawl for: ${url}`);

  try {
    // Step 1: Start the actor run
    const runResponse = await axios.post(
      `${APIFY_BASE_URL}/acts/${WEBSITE_CONTENT_CRAWLER_ACTOR_ID}/runs`,
      {
        startUrls: [{ url }],
        maxCrawlDepth: 0, // Single page only
        maxCrawlPages: 1,
        crawlerType: 'playwright:chrome', // Browser mode for JS rendering
        includeUrlGlobs: [], // No additional URLs
        excludeUrlGlobs: [],
        maxRequestRetries: 2,
        maxRequestsPerMinute: 60,
        proxyConfiguration: {
          useApifyProxy: true,
        },
        // Content extraction settings
        saveHtml: false, // Don't need raw HTML
        saveMarkdown: true,
        saveFiles: false,
        saveScreenshots: false,
        // Metadata extraction
        readableTextCharThreshold: 100,
        removeCookieWarnings: true,
        clickElementsCssSelector: '', // Don't click anything
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${APIFY_API_TOKEN}`,
        },
        params: {
          waitForFinish: 0, // Don't wait, we'll poll
        },
      }
    );

    const runId = runResponse.data?.data?.id;
    if (!runId) {
      console.error('[Apify Crawler] No run ID returned:', runResponse.data);
      return {
        success: false,
        error: 'Failed to start Apify crawl - no run ID returned',
      };
    }

    console.log(`[Apify Crawler] Run started: ${runId}`);

    // Step 2: Poll for completion
    let runStatus = 'RUNNING';
    let pollAttempts = 0;

    while (runStatus === 'RUNNING' || runStatus === 'READY') {
      if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        console.error(`[Apify Crawler] Timeout waiting for run ${runId}`);
        return {
          success: false,
          error: 'Crawl timed out after 2 minutes',
          runId,
        };
      }

      await sleep(POLL_INTERVAL_MS);
      pollAttempts++;

      const statusResponse = await axios.get(
        `${APIFY_BASE_URL}/actor-runs/${runId}`,
        {
          headers: {
            Authorization: `Bearer ${APIFY_API_TOKEN}`,
          },
        }
      );

      runStatus = statusResponse.data?.data?.status;
      console.log(`[Apify Crawler] Poll ${pollAttempts}: status=${runStatus}`);
    }

    if (runStatus !== 'SUCCEEDED') {
      console.error(`[Apify Crawler] Run failed with status: ${runStatus}`);
      return {
        success: false,
        error: `Crawl failed with status: ${runStatus}`,
        runId,
      };
    }

    // Step 3: Retrieve results from dataset
    const datasetResponse = await axios.get(
      `${APIFY_BASE_URL}/actor-runs/${runId}/dataset/items`,
      {
        headers: {
          Authorization: `Bearer ${APIFY_API_TOKEN}`,
        },
        params: {
          format: 'json',
        },
      }
    );

    const items = datasetResponse.data;
    if (!items || items.length === 0) {
      console.error('[Apify Crawler] No items in dataset');
      return {
        success: false,
        error: 'Crawl completed but returned no data',
        runId,
      };
    }

    const crawlResult = items[0] as ApifyCrawlResult;
    const duration = Date.now() - startTime;

    console.log(`[Apify Crawler] Crawl complete in ${duration}ms`);
    console.log(`[Apify Crawler] Title: ${crawlResult.metadata?.title}`);
    console.log(`[Apify Crawler] Text length: ${crawlResult.text?.length || 0}`);

    return {
      success: true,
      data: crawlResult,
      runId,
      duration,
    };
  } catch (error: any) {
    console.error('[Apify Crawler] Error:', error.response?.data || error.message);

    // Handle specific API errors
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Invalid Apify API key',
      };
    }

    if (error.response?.status === 402) {
      return {
        success: false,
        error: 'Apify account has insufficient credits',
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown error during crawl',
    };
  }
}

/**
 * Extract OpenGraph data as a key-value map
 */
export function extractOpenGraph(
  metadata: ApifyCrawlResult['metadata']
): Record<string, string> {
  const og: Record<string, string> = {};

  if (!metadata?.openGraph) return og;

  for (const item of metadata.openGraph) {
    if (item.property && item.content) {
      // Remove 'og:' prefix for cleaner access
      const key = item.property.replace(/^og:/, '');
      og[key] = item.content;
    }
  }

  return og;
}

/**
 * Extract JSON-LD Product data if present
 */
export function extractJsonLdProduct(
  metadata: ApifyCrawlResult['metadata']
): any | null {
  if (!metadata?.jsonLd || !Array.isArray(metadata.jsonLd)) return null;

  // Look for Product type in JSON-LD
  for (const item of metadata.jsonLd) {
    if (item['@type'] === 'Product') {
      return item;
    }
    // Handle @graph structure
    if (item['@graph'] && Array.isArray(item['@graph'])) {
      for (const graphItem of item['@graph']) {
        if (graphItem['@type'] === 'Product') {
          return graphItem;
        }
      }
    }
  }

  return null;
}

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== EXPORTS ====================

export const apifyCrawlerService = {
  crawlProductPage,
  extractOpenGraph,
  extractJsonLdProduct,
};

export default apifyCrawlerService;
