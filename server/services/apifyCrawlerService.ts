/**
 * Generic Product Page Crawler Service (Jan 2026)
 *
 * Fast, reliable scraping for generic product pages.
 * Strategy:
 *   1. Direct HTTP fetch + HTML parsing (fast, free)
 *   2. ScrapingBee fallback for blocked sites
 *
 * Extracts: OG tags, JSON-LD, meta tags, page content
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

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
const REQUEST_TIMEOUT = 15000; // 15 seconds

// User agent to avoid blocks
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ==================== MAIN CRAWLER ====================

/**
 * Crawl a single product page URL
 * Uses direct fetch first, falls back to ScrapingBee if needed
 */
export async function crawlProductPage(url: string): Promise<ApifyCrawlResponse> {
  const startTime = Date.now();

  // Validate URL
  try {
    new URL(url);
  } catch {
    return {
      success: false,
      error: 'Invalid URL provided',
    };
  }

  console.log(`[Product Crawler] Starting crawl for: ${url}`);

  // Try direct fetch first
  let result = await crawlDirectly(url);

  // If direct crawl failed and we have ScrapingBee, try fallback
  if (!result.success && SCRAPINGBEE_API_KEY) {
    console.log(`[Product Crawler] Direct fetch failed, trying ScrapingBee fallback`);
    result = await crawlWithScrapingBee(url);
  }

  const duration = Date.now() - startTime;
  console.log(`[Product Crawler] Crawl completed in ${duration}ms (success: ${result.success})`);

  return {
    ...result,
    duration,
    runId: `direct-${Date.now()}`,
  };
}

// ==================== DIRECT FETCH ====================

async function crawlDirectly(url: string): Promise<ApifyCrawlResponse> {
  try {
    console.log(`[Product Crawler] Direct fetch: ${url}`);

    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
    });

    if (response.status !== 200) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const html = response.data;
    const crawlResult = parseHtml(html, url);

    // Validate we got useful data
    if (!crawlResult.metadata?.title && !crawlResult.metadata?.openGraph?.length) {
      console.log('[Product Crawler] Direct fetch returned insufficient data');
      return {
        success: false,
        error: 'Page does not contain sufficient product metadata',
      };
    }

    console.log(`[Product Crawler] Direct fetch successful: "${crawlResult.metadata?.title}"`);

    return {
      success: true,
      data: crawlResult,
    };
  } catch (error: any) {
    console.log(`[Product Crawler] Direct fetch error: ${error.message}`);

    // Return specific error for common cases
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return { success: false, error: 'Request timeout' };
    }
    if (error.response?.status === 403) {
      return { success: false, error: 'Access forbidden (may need proxy)' };
    }
    if (error.response?.status === 404) {
      return { success: false, error: 'Page not found' };
    }

    return { success: false, error: error.message };
  }
}

// ==================== SCRAPINGBEE FALLBACK ====================

async function crawlWithScrapingBee(url: string): Promise<ApifyCrawlResponse> {
  if (!SCRAPINGBEE_API_KEY) {
    return { success: false, error: 'ScrapingBee not configured' };
  }

  try {
    console.log(`[Product Crawler] ScrapingBee fetch: ${url}`);

    const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
    scrapingBeeUrl.searchParams.set('api_key', SCRAPINGBEE_API_KEY);
    scrapingBeeUrl.searchParams.set('url', url);
    scrapingBeeUrl.searchParams.set('render_js', 'true'); // Render JS for dynamic content
    scrapingBeeUrl.searchParams.set('premium_proxy', 'true');
    scrapingBeeUrl.searchParams.set('country_code', 'us');

    const response = await axios.get(scrapingBeeUrl.toString(), {
      timeout: REQUEST_TIMEOUT * 2, // Double timeout for proxy
    });

    if (response.status !== 200) {
      return { success: false, error: `ScrapingBee HTTP ${response.status}` };
    }

    const html = response.data;
    const crawlResult = parseHtml(html, url);

    // Validate we got useful data
    if (!crawlResult.metadata?.title && !crawlResult.metadata?.openGraph?.length) {
      return {
        success: false,
        error: 'ScrapingBee returned page without product metadata',
      };
    }

    console.log(`[Product Crawler] ScrapingBee successful: "${crawlResult.metadata?.title}"`);

    return {
      success: true,
      data: crawlResult,
    };
  } catch (error: any) {
    console.log(`[Product Crawler] ScrapingBee error: ${error.message}`);
    return { success: false, error: `ScrapingBee: ${error.message}` };
  }
}

// ==================== HTML PARSING ====================

function parseHtml(html: string, url: string): ApifyCrawlResult {
  const metadata: ApifyCrawlResult['metadata'] = {
    openGraph: [],
    twitter: [],
    jsonLd: [],
  };

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    metadata.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (descMatch) {
    metadata.description = decodeHtmlEntities(descMatch[1]);
  }

  // Extract OpenGraph and product meta tags (og:*, product:*)
  const ogRegex = /<meta[^>]*property=["']((?:og|product):[^"']*)["'][^>]*content=["']([^"']*)["']/gi;
  const ogRegex2 = /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']((?:og|product):[^"']*)["']/gi;

  let match;
  while ((match = ogRegex.exec(html)) !== null) {
    metadata.openGraph!.push({ property: match[1], content: decodeHtmlEntities(match[2]) });
  }
  while ((match = ogRegex2.exec(html)) !== null) {
    metadata.openGraph!.push({ property: match[2], content: decodeHtmlEntities(match[1]) });
  }

  // Extract Twitter card tags
  const twitterRegex = /<meta[^>]*(?:name|property)=["'](twitter:[^"']*)["'][^>]*content=["']([^"']*)["']/gi;
  const twitterRegex2 = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["'](twitter:[^"']*)["']/gi;

  while ((match = twitterRegex.exec(html)) !== null) {
    metadata.twitter!.push({ property: match[1], content: decodeHtmlEntities(match[2]) });
  }
  while ((match = twitterRegex2.exec(html)) !== null) {
    metadata.twitter!.push({ property: match[2], content: decodeHtmlEntities(match[1]) });
  }

  // Extract JSON-LD
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1].trim());
      metadata.jsonLd!.push(jsonData);
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  // Extract visible text content (simplified)
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit text length
  if (text.length > 5000) {
    text = text.substring(0, 5000);
  }

  // Extract all image URLs from HTML
  const imageUrls: string[] = [];
  const imgRegex = /<img[^>]*src=["']([^"']+)["']/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    const imgUrl = resolveUrl(match[1], url);
    if (imgUrl && isValidImageUrl(imgUrl)) {
      imageUrls.push(imgUrl);
    }
  }

  // Add srcset images
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcsetParts = match[1].split(',');
    for (const part of srcsetParts) {
      const srcUrl = part.trim().split(/\s+/)[0];
      const resolvedUrl = resolveUrl(srcUrl, url);
      if (resolvedUrl && isValidImageUrl(resolvedUrl)) {
        imageUrls.push(resolvedUrl);
      }
    }
  }

  // Build markdown with images
  let markdown = '';
  if (metadata.title) {
    markdown += `# ${metadata.title}\n\n`;
  }
  if (metadata.description) {
    markdown += `${metadata.description}\n\n`;
  }
  for (const imgUrl of [...new Set(imageUrls)].slice(0, 20)) {
    markdown += `![Image](${imgUrl})\n`;
  }

  return {
    url,
    loadedUrl: url,
    metadata,
    text,
    markdown,
    html: html.substring(0, 50000), // Limit stored HTML
    crawl: {
      loadedAt: new Date().toISOString(),
      uniqueKey: url,
      httpStatusCode: 200,
    },
  };
}

// ==================== HELPERS ====================

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function resolveUrl(imgUrl: string, baseUrl: string): string | null {
  try {
    if (imgUrl.startsWith('data:')) return null;
    if (imgUrl.startsWith('//')) {
      return 'https:' + imgUrl;
    }
    if (imgUrl.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${imgUrl}`;
    }
    if (imgUrl.startsWith('http')) {
      return imgUrl;
    }
    // Relative URL
    const base = new URL(baseUrl);
    return new URL(imgUrl, base).toString();
  } catch {
    return null;
  }
}

function isValidImageUrl(url: string): boolean {
  // Skip tiny images, icons, tracking pixels
  if (url.includes('1x1') || url.includes('pixel') || url.includes('spacer')) {
    return false;
  }
  // Check for image extension or CDN patterns
  const imagePatterns = /\.(jpg|jpeg|png|webp|avif)($|\?)/i;
  const cdnPatterns = /(cdn|images|media|static|uploads|wp-content\/uploads)/i;
  return imagePatterns.test(url) || cdnPatterns.test(url);
}

/**
 * Extract OpenGraph and product meta data as a key-value map
 */
export function extractOpenGraph(
  metadata: ApifyCrawlResult['metadata']
): Record<string, string> {
  const og: Record<string, string> = {};

  if (!metadata?.openGraph) return og;

  for (const item of metadata.openGraph) {
    if (item.property && item.content) {
      // Store with both full key and without prefix for flexibility
      // og:image -> 'image' and 'og:image'
      // product:price:amount -> 'product:price:amount'
      if (item.property.startsWith('og:')) {
        const shortKey = item.property.replace(/^og:/, '');
        og[shortKey] = item.content;
      }
      og[item.property] = item.content;
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

// ==================== EXPORTS ====================

export const apifyCrawlerService = {
  crawlProductPage,
  extractOpenGraph,
  extractJsonLdProduct,
};

export default apifyCrawlerService;
