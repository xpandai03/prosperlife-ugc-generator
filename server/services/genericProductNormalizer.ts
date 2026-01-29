/**
 * Generic Product Normalizer (Jan 2026)
 *
 * Converts raw Apify crawl output into a NormalizedProduct object
 * suitable for video generation.
 */

import OpenAI from 'openai';
import {
  ApifyCrawlResult,
  extractOpenGraph,
  extractJsonLdProduct,
} from './apifyCrawlerService';

// ==================== TYPES ====================

export interface NormalizedProduct {
  // Required
  title: string;
  description: string;
  images: string[];
  sourceUrl: string;
  benefits: string[];

  // Optional
  price: string | null;
  originalPrice: string | null;
  brand: string | null;
  category: string | null;

  // Metadata
  dataQuality: 'high' | 'medium' | 'low';
  qualityFlags: string[];
  extractionSource: {
    titleFrom: 'jsonld' | 'og' | 'title_tag' | 'h1' | 'ai';
    descriptionFrom: 'jsonld' | 'og' | 'meta' | 'content' | 'ai';
    imageCountRaw: number;
    imageCountFinal: number;
    benefitsFrom: 'structured' | 'ai';
  };
  crawledAt: Date;
}

export interface NormalizationResult {
  success: boolean;
  product?: NormalizedProduct;
  error?: string;
}

// ==================== CONFIG ====================

const MIN_IMAGE_COUNT = 1; // MVP: Allow products with just 1 image
const MAX_IMAGE_COUNT = 5;
const MIN_DESCRIPTION_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_TITLE_LENGTH = 80;

// Patterns to filter out non-product images
const IMAGE_EXCLUDE_PATTERNS = [
  /\.svg$/i,
  /\.gif$/i,
  /icon/i,
  /logo/i,
  /badge/i,
  /payment/i,
  /trust/i,
  /shipping/i,
  /sprite/i,
  /placeholder/i,
  /\/assets\//i,
  /\/icons\//i,
  /\/ui\//i,
  /\/static\/.*\.(png|jpg)/i,
  /data:image\//i,
  /gravatar/i,
  /avatar/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /instagram\.com/i,
  /pinterest\.com/i,
  /google\.com\/.*\.(png|jpg|svg)/i,
  /cdn\.shopify\.com\/.*\/files\//i, // Shopify misc files
  /woocommerce.*placeholder/i, // WooCommerce placeholder images only
  /wp-content\/plugins/i,
  /wp-content\/themes\/.*\/(images|assets|icons)/i, // Theme assets, not product images
  // Supplement/nutrition labels - not the main product image
  /supplement[-_]?facts/i,
  /nutrition[-_]?facts/i,
  /nutrition[-_]?label/i,
  /ingredients[-_]?label/i,
  /label[-_]?image/i,
  /drug[-_]?facts/i,
];

// Patterns that indicate a GOOD product image (prioritize these)
const IMAGE_PRIORITY_PATTERNS = [
  /product/i,
  /main/i,
  /hero/i,
  /featured/i,
  /primary/i,
  /-1\./i,  // Often the first/main image
  /_1\./i,
];

// Text patterns to ignore in descriptions
const DESCRIPTION_IGNORE_PATTERNS = [
  /free shipping/i,
  /\d+-day return/i,
  /money.?back guarantee/i,
  /terms (and conditions|apply)/i,
  /see details/i,
  /add to cart/i,
  /buy now/i,
  /in stock/i,
  /out of stock/i,
  /customer service/i,
  /contact us/i,
  /sign up/i,
  /subscribe/i,
  /newsletter/i,
];

// ==================== MAIN NORMALIZER ====================

/**
 * Normalize raw Apify crawl data into a video-ready product object
 */
export async function normalizeProduct(
  crawlData: ApifyCrawlResult,
  sourceUrl: string
): Promise<NormalizationResult> {
  console.log('[Normalizer] Starting normalization for:', sourceUrl);

  const qualityFlags: string[] = [];
  const extractionSource: NormalizedProduct['extractionSource'] = {
    titleFrom: 'ai',
    descriptionFrom: 'ai',
    imageCountRaw: 0,
    imageCountFinal: 0,
    benefitsFrom: 'ai',
  };

  try {
    // Extract structured data
    const og = extractOpenGraph(crawlData.metadata);
    const jsonLd = extractJsonLdProduct(crawlData.metadata);

    // ==================== TITLE EXTRACTION ====================
    let title = '';

    // Priority 1: JSON-LD Product.name
    if (jsonLd?.name) {
      title = cleanTitle(jsonLd.name);
      extractionSource.titleFrom = 'jsonld';
    }
    // Priority 2: OpenGraph title
    else if (og.title) {
      title = cleanTitle(og.title);
      extractionSource.titleFrom = 'og';
    }
    // Priority 3: Page title tag
    else if (crawlData.metadata?.title) {
      title = cleanTitle(crawlData.metadata.title);
      extractionSource.titleFrom = 'title_tag';
    }
    // Priority 4: First H1 from markdown
    else if (crawlData.markdown) {
      const h1Match = crawlData.markdown.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = cleanTitle(h1Match[1]);
        extractionSource.titleFrom = 'h1';
      }
    }

    if (!title || title.length < 3) {
      return {
        success: false,
        error: 'Could not extract product title from page',
      };
    }

    console.log(`[Normalizer] Title: "${title}" (from ${extractionSource.titleFrom})`);

    // ==================== IMAGE EXTRACTION ====================
    const allImages = collectImages(crawlData, og, jsonLd);
    extractionSource.imageCountRaw = allImages.length;

    console.log(`[Normalizer] Raw images collected: ${allImages.length}`);

    const filteredImages = filterAndDeduplicateImages(allImages);
    extractionSource.imageCountFinal = filteredImages.length;

    console.log(`[Normalizer] Filtered images: ${filteredImages.length}`);

    if (filteredImages.length < MIN_IMAGE_COUNT) {
      return {
        success: false,
        error: `Insufficient product images found (${filteredImages.length}/${MIN_IMAGE_COUNT} required). Page may not be a product page.`,
      };
    }

    const selectedImages = filteredImages.slice(0, MAX_IMAGE_COUNT);
    if (filteredImages.length < 5) {
      qualityFlags.push('low_image_count');
    }

    // ==================== DESCRIPTION EXTRACTION ====================
    let description = '';

    // Priority 1: JSON-LD description
    if (jsonLd?.description) {
      description = cleanDescription(jsonLd.description);
      extractionSource.descriptionFrom = 'jsonld';
    }
    // Priority 2: OpenGraph description
    else if (og.description) {
      description = cleanDescription(og.description);
      extractionSource.descriptionFrom = 'og';
    }
    // Priority 3: Meta description
    else if (crawlData.metadata?.description) {
      description = cleanDescription(crawlData.metadata.description);
      extractionSource.descriptionFrom = 'meta';
    }
    // Priority 4: Extract from content
    else if (crawlData.text) {
      description = extractDescriptionFromText(crawlData.text);
      extractionSource.descriptionFrom = 'content';
    }

    if (!description || description.length < MIN_DESCRIPTION_LENGTH) {
      qualityFlags.push('low_text_quality');
      // We'll try to generate with AI later
    }

    console.log(`[Normalizer] Description: ${description.length} chars (from ${extractionSource.descriptionFrom})`);

    // ==================== BENEFITS EXTRACTION ====================
    let benefits = extractBenefitsFromMarkdown(crawlData.markdown || '');

    if (benefits.length < 3) {
      // Use AI to generate benefits
      console.log('[Normalizer] Insufficient benefits found, using AI generation');
      benefits = await generateBenefitsWithAI(title, description, crawlData.text || '');
      extractionSource.benefitsFrom = 'ai';
      qualityFlags.push('ai_generated_benefits');
    } else {
      extractionSource.benefitsFrom = 'structured';
    }

    console.log(`[Normalizer] Benefits: ${benefits.length} (from ${extractionSource.benefitsFrom})`);

    // ==================== PRICE EXTRACTION ====================
    let price: string | null = null;
    let originalPrice: string | null = null;

    if (jsonLd?.offers) {
      const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      if (offers?.price) {
        price = formatPrice(offers.price, offers.priceCurrency);
      }
      if (offers?.highPrice && offers.highPrice !== offers.price) {
        originalPrice = formatPrice(offers.highPrice, offers.priceCurrency);
      }
    }

    // Try to extract from text if not in JSON-LD
    if (!price && crawlData.text) {
      price = extractPriceFromText(crawlData.text);
    }

    console.log(`[Normalizer] Price: ${price || 'not found'}`);

    // ==================== BRAND EXTRACTION ====================
    let brand: string | null = null;

    if (jsonLd?.brand) {
      brand = typeof jsonLd.brand === 'string' ? jsonLd.brand : jsonLd.brand?.name;
    } else if (og.site_name) {
      brand = og.site_name;
    }

    // ==================== CATEGORY EXTRACTION ====================
    let category: string | null = null;

    if (jsonLd?.category) {
      category = jsonLd.category;
    }

    // ==================== DATA QUALITY ASSESSMENT ====================
    let dataQuality: 'high' | 'medium' | 'low' = 'medium';

    if (
      selectedImages.length >= 5 &&
      description.length >= 150 &&
      extractionSource.benefitsFrom === 'structured' &&
      price
    ) {
      dataQuality = 'high';
    } else if (
      selectedImages.length < 4 ||
      description.length < 100 ||
      qualityFlags.includes('ai_generated_benefits')
    ) {
      dataQuality = 'low';
    }

    console.log(`[Normalizer] Data quality: ${dataQuality}`);

    // ==================== CONSTRUCT RESULT ====================
    const product: NormalizedProduct = {
      title,
      description: description || `${title} - Premium quality product.`,
      images: selectedImages,
      sourceUrl,
      benefits,
      price,
      originalPrice,
      brand,
      category,
      dataQuality,
      qualityFlags,
      extractionSource,
      crawledAt: new Date(),
    };

    return {
      success: true,
      product,
    };
  } catch (error: any) {
    console.error('[Normalizer] Error:', error);
    return {
      success: false,
      error: error.message || 'Normalization failed',
    };
  }
}

// ==================== IMAGE HELPERS ====================

/**
 * Collect all candidate images from various sources
 */
function collectImages(
  crawlData: ApifyCrawlResult,
  og: Record<string, string>,
  jsonLd: any
): string[] {
  const images: string[] = [];

  // OpenGraph image (highest priority)
  if (og.image) {
    images.push(og.image);
  }

  // JSON-LD Product images
  if (jsonLd?.image) {
    if (Array.isArray(jsonLd.image)) {
      images.push(...jsonLd.image.map((img: any) => typeof img === 'string' ? img : img.url).filter(Boolean));
    } else if (typeof jsonLd.image === 'string') {
      images.push(jsonLd.image);
    } else if (jsonLd.image?.url) {
      images.push(jsonLd.image.url);
    }
  }

  // Twitter card image
  if (crawlData.metadata?.twitter) {
    const twitterImage = crawlData.metadata.twitter.find(t => t.property === 'twitter:image');
    if (twitterImage?.content) {
      images.push(twitterImage.content);
    }
  }

  // Extract from markdown
  if (crawlData.markdown) {
    const mdImages = crawlData.markdown.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g);
    if (mdImages) {
      for (const match of mdImages) {
        const urlMatch = match.match(/\((https?:\/\/[^\s)]+)\)/);
        if (urlMatch?.[1]) {
          images.push(urlMatch[1]);
        }
      }
    }
  }

  return images;
}

/**
 * Filter out non-product images, deduplicate, and prioritize product images
 */
function filterAndDeduplicateImages(images: string[]): string[] {
  const seen = new Set<string>();
  const priorityImages: string[] = [];
  const regularImages: string[] = [];

  for (const url of images) {
    // Skip if matches exclude pattern
    if (IMAGE_EXCLUDE_PATTERNS.some(pattern => pattern.test(url))) {
      console.log(`[Normalizer] Excluded image: ${url.substring(0, 80)}...`);
      continue;
    }

    // Normalize URL for deduplication (remove size params)
    const normalizedUrl = normalizeImageUrl(url);

    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);

      // Check if this is a priority (main product) image
      if (IMAGE_PRIORITY_PATTERNS.some(pattern => pattern.test(url))) {
        priorityImages.push(url);
      } else {
        regularImages.push(url);
      }
    }
  }

  // Return priority images first, then regular images
  return [...priorityImages, ...regularImages];
}

/**
 * Normalize image URL for deduplication
 */
function normalizeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common size/quality params
    parsed.searchParams.delete('w');
    parsed.searchParams.delete('h');
    parsed.searchParams.delete('width');
    parsed.searchParams.delete('height');
    parsed.searchParams.delete('size');
    parsed.searchParams.delete('quality');
    parsed.searchParams.delete('q');
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// ==================== TEXT HELPERS ====================

/**
 * Clean and truncate title
 */
function cleanTitle(raw: string): string {
  let title = raw.trim();

  // Remove common suffixes
  title = title.replace(/\s*[-|–—]\s*(Shop|Store|Buy|Official|Home).*$/i, '');
  title = title.replace(/\s*[-|–—]\s*[^-|–—]+$/, ''); // Remove site name after separator

  // Remove common prefixes
  title = title.replace(/^(Buy|Shop|Order)\s+/i, '');

  // Truncate
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.substring(0, MAX_TITLE_LENGTH - 3) + '...';
  }

  return title.trim();
}

/**
 * Clean description text
 */
function cleanDescription(raw: string): string {
  let desc = raw.trim();

  // Remove HTML entities
  desc = desc.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Remove patterns we don't want
  for (const pattern of DESCRIPTION_IGNORE_PATTERNS) {
    desc = desc.replace(pattern, '');
  }

  // Clean up whitespace
  desc = desc.replace(/\s+/g, ' ').trim();

  // Truncate if too long, but keep complete sentences
  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    const sentences = desc.match(/[^.!?]+[.!?]+/g) || [];
    let result = '';
    for (const sentence of sentences) {
      if ((result + sentence).length <= MAX_DESCRIPTION_LENGTH) {
        result += sentence;
      } else {
        break;
      }
    }
    desc = result.trim() || desc.substring(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
  }

  return desc;
}

/**
 * Extract description from raw text content
 */
function extractDescriptionFromText(text: string): string {
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 50 && p.length < 500);

  // Find first paragraph that looks like a product description
  for (const para of paragraphs.slice(0, 10)) {
    // Skip if it's navigation, policy, etc.
    if (DESCRIPTION_IGNORE_PATTERNS.some(pattern => pattern.test(para))) {
      continue;
    }
    // Skip if it starts with common non-description patterns
    if (/^(Home|About|Contact|Menu|Cart|Search|Login)/i.test(para)) {
      continue;
    }
    return cleanDescription(para);
  }

  return '';
}

/**
 * Extract benefit bullets from markdown
 */
function extractBenefitsFromMarkdown(markdown: string): string[] {
  const benefits: string[] = [];

  // Look for bullet lists
  const listMatches = markdown.match(/^[-*]\s+(.+)$/gm);
  if (listMatches) {
    for (const match of listMatches) {
      const benefit = match.replace(/^[-*]\s+/, '').trim();
      if (
        benefit.length > 10 &&
        benefit.length < 100 &&
        !DESCRIPTION_IGNORE_PATTERNS.some(p => p.test(benefit))
      ) {
        benefits.push(benefit);
        if (benefits.length >= 5) break;
      }
    }
  }

  // Look for numbered lists
  if (benefits.length < 3) {
    const numberedMatches = markdown.match(/^\d+\.\s+(.+)$/gm);
    if (numberedMatches) {
      for (const match of numberedMatches) {
        const benefit = match.replace(/^\d+\.\s+/, '').trim();
        if (
          benefit.length > 10 &&
          benefit.length < 100 &&
          !benefits.includes(benefit) &&
          !DESCRIPTION_IGNORE_PATTERNS.some(p => p.test(benefit))
        ) {
          benefits.push(benefit);
          if (benefits.length >= 5) break;
        }
      }
    }
  }

  return benefits;
}

/**
 * Generate benefits using AI when structured extraction fails
 */
async function generateBenefitsWithAI(
  title: string,
  description: string,
  fullText: string
): Promise<string[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.warn('[Normalizer] OpenAI API key not set, using fallback benefits');
    return [
      'Premium quality materials',
      'Designed for everyday use',
      'Satisfaction guaranteed',
    ];
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Truncate full text to avoid token limits
    const truncatedText = fullText.substring(0, 2000);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a product copywriter. Extract or generate 4 concise benefit statements for the product. Each benefit should be 5-15 words, focus on customer value, and start with an action verb or outcome. Return ONLY a JSON array of strings.`,
        },
        {
          role: 'user',
          content: `Product: ${title}\n\nDescription: ${description}\n\nAdditional context: ${truncatedText}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse JSON array from response
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      const benefits = JSON.parse(match[0]);
      if (Array.isArray(benefits) && benefits.length >= 3) {
        return benefits.slice(0, 5).map(b => String(b).trim());
      }
    }

    console.warn('[Normalizer] Could not parse AI benefits, using fallback');
  } catch (error: any) {
    console.error('[Normalizer] AI benefit generation failed:', error.message);
  }

  // Fallback benefits
  return [
    'Premium quality materials',
    'Designed for everyday use',
    'Satisfaction guaranteed',
  ];
}

/**
 * Format price with currency
 */
function formatPrice(price: number | string, currency?: string): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(numPrice)) return String(price);

  const currencySymbol = currency === 'USD' || !currency ? '$' : currency;
  return `${currencySymbol}${numPrice.toFixed(2)}`;
}

/**
 * Extract price from text content
 */
function extractPriceFromText(text: string): string | null {
  // Skip prices that appear in promotional/shipping text
  const skipPatterns = [
    /free shipping over \$\d+/i,
    /orders over \$\d+/i,
    /save \$\d+/i,
    /up to \$\d+/i,
    /\$\d+ off/i,
    /\$\d+ minimum/i,
  ];

  // Remove promotional text first
  let cleanText = text;
  for (const pattern of skipPatterns) {
    cleanText = cleanText.replace(pattern, '');
  }

  // Match "Price: $X" pattern first (most reliable)
  const labeledMatch = cleanText.match(/(?:Price|Cost|Now|Sale)[\s:]*\$(\d+(?:\.\d{2})?)/i);
  if (labeledMatch) {
    return `$${labeledMatch[1]}`;
  }

  // Look for prices with cents (more likely to be product prices)
  const priceWithCents = cleanText.match(/\$(\d{1,3}(?:\.\d{2}))/);
  if (priceWithCents) {
    return priceWithCents[0];
  }

  // Fallback: any price pattern
  const priceMatch = cleanText.match(/\$(\d+(?:\.\d{2})?)/);
  if (priceMatch) {
    return priceMatch[0];
  }

  return null;
}

// ==================== EXPORTS ====================

export const genericProductNormalizer = {
  normalizeProduct,
};

export default genericProductNormalizer;
