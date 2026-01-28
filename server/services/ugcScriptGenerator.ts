/**
 * UGC Script Generator Service (Jan 2026)
 *
 * Generates scene scripts for UGC videos from product briefs using AI.
 * Creates optimized voiceover text for each scene type.
 */

// ==================== TYPES ====================

export interface ProductBrief {
  productName: string;
  productFeatures: string;   // Paragraph or comma-separated
  targetAudience?: string;
  brandTone?: 'casual' | 'professional' | 'energetic' | 'luxury';
}

export interface UGCSceneScripts {
  hook: string;                 // Attention-grabbing hook text (visual only)
  showcaseNarration: string;    // 2-3 sentences for showcase voiceover
  featuresNarration: string;    // Benefits narration
  featuresList: string[];       // Individual feature items (3)
  ctaNarration?: string;        // Optional CTA voiceover
  avatarScript?: string;        // Script for avatar to speak (if using avatar)
}

export interface ScriptGenerationResult {
  success: boolean;
  scripts?: UGCSceneScripts;
  error?: string;
}

// ==================== CONFIG ====================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

const SYSTEM_PROMPT = `You are a UGC (User Generated Content) video script writer specializing in short-form product videos for social media.

Your task is to create engaging, concise scripts for a 30-45 second product video with the following structure:
1. Hook (3-5s) - Visual text overlay to grab attention
2. Showcase (8-12s) - Voiceover introducing the product
3. Features (10-15s) - Voiceover highlighting 3 key benefits
4. Avatar (5-8s) - Script for a person speaking (optional)
5. CTA (3-5s) - Call-to-action voiceover

Guidelines:
- Keep all text punchy and conversational
- Hook should be 3-8 words max, attention-grabbing
- Showcase narration: 2-3 short sentences, introduce the product naturally
- Features: Extract exactly 3 key benefits, each 5-10 words
- Avatar script: First-person testimonial style, casual and authentic
- CTA: Simple, direct call-to-action

Output must be valid JSON with this exact structure:
{
  "hook": "string",
  "showcaseNarration": "string",
  "featuresNarration": "string",
  "featuresList": ["feature1", "feature2", "feature3"],
  "ctaNarration": "string",
  "avatarScript": "string"
}`;

// ==================== SERVICE ====================

/**
 * Generate UGC scene scripts from a product brief
 */
export async function generateSceneScripts(
  brief: ProductBrief
): Promise<ScriptGenerationResult> {
  if (!OPENAI_API_KEY) {
    console.error('[UGC Script] OpenAI API key not configured');
    return {
      success: false,
      error: 'Script generation service not configured',
    };
  }

  const toneGuide = getToneGuide(brief.brandTone);

  const userPrompt = `Create UGC video scripts for this product:

Product Name: ${brief.productName}
Features/Description: ${brief.productFeatures}
${brief.targetAudience ? `Target Audience: ${brief.targetAudience}` : ''}
Brand Tone: ${toneGuide}

Generate the JSON output with all script components.`;

  try {
    console.log('[UGC Script] Generating scripts for:', brief.productName);

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    const responseText = await response.text();

    if (responseText.trim() === '') {
      throw new Error('Empty response from AI');
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[UGC Script] JSON parse error:', parseError);
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok) {
      const errorMessage = data.error?.message || data.error || 'Unknown error from OpenAI API';
      throw new Error(`OpenAI API Error (${response.status}): ${errorMessage}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty content in response');
    }

    const scripts = JSON.parse(content) as UGCSceneScripts;

    // Validate required fields
    if (!scripts.hook || !scripts.showcaseNarration || !scripts.featuresList) {
      throw new Error('Missing required script fields');
    }

    // Ensure featuresList has exactly 3 items
    if (scripts.featuresList.length < 3) {
      // Pad with generic benefits
      while (scripts.featuresList.length < 3) {
        scripts.featuresList.push('Premium quality guaranteed');
      }
    } else if (scripts.featuresList.length > 3) {
      scripts.featuresList = scripts.featuresList.slice(0, 3);
    }

    console.log('[UGC Script] Scripts generated successfully');

    return {
      success: true,
      scripts,
    };
  } catch (error: any) {
    console.error('[UGC Script] Generation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate scripts',
    };
  }
}

/**
 * Generate a quick hook text without full AI call
 * Uses simple templates for faster response
 */
export function generateQuickHook(productName: string): string {
  const templates = [
    `Stop scrolling if you need ${productName}`,
    `This ${productName} changed everything`,
    `POV: You finally found the perfect ${productName}`,
    `Wait - you need to see this ${productName}`,
    `The ${productName} everyone's talking about`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate default scripts without AI (fallback)
 */
export function getDefaultScripts(productName: string, features: string): UGCSceneScripts {
  // Parse features from comma-separated or newline-separated string
  const featuresList = features
    .split(/[,\n]/)
    .map(f => f.trim())
    .filter(f => f.length > 0)
    .slice(0, 3);

  // Pad if needed
  while (featuresList.length < 3) {
    featuresList.push('Premium quality');
  }

  return {
    hook: `Stop scrolling for ${productName}!`,
    showcaseNarration: `Introducing ${productName}. This is the product you've been looking for. Let me show you why it's so special.`,
    featuresNarration: `Here's what makes it amazing. ${featuresList.join('. ')}. Trust me, you won't regret this.`,
    featuresList,
    ctaNarration: `Get yours today. Link in bio.`,
    avatarScript: `I've been using ${productName} for a while now, and honestly? It's a game changer. If you're on the fence, just go for it.`,
  };
}

// ==================== HELPERS ====================

function getToneGuide(tone?: string): string {
  switch (tone) {
    case 'casual':
      return 'Friendly and relaxed, like talking to a friend';
    case 'professional':
      return 'Polished and informative, building trust';
    case 'energetic':
      return 'Excited and enthusiastic, high energy';
    case 'luxury':
      return 'Sophisticated and premium, emphasizing quality';
    default:
      return 'Natural and conversational, authentic UGC style';
  }
}

// ==================== EXPORTS ====================

export const ugcScriptGenerator = {
  generateSceneScripts,
  generateQuickHook,
  getDefaultScripts,
};

export default ugcScriptGenerator;
