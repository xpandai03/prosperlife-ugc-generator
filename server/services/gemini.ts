/**
 * Google Gemini 2.5 Flash Service
 *
 * Fallback image generation when KIE.ai fails
 *
 * Note: Gemini returns base64-encoded images that need to be uploaded to cloud storage.
 * For MVP, we're using a placeholder. In production, implement Supabase Storage upload.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

if (!GEMINI_API_KEY) {
  console.warn('[Gemini Service] Warning: GEMINI_API_KEY not configured');
}

export interface GenerateGeminiImageParams {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16';
}

export interface GeminiImageResult {
  imageUrl: string;
  metadata: {
    model: string;
    prompt: string;
    generatedAt: string;
  };
}

export const geminiService = {
  /**
   * Generate image using Gemini 2.5 Flash
   */
  async generateImage(params: GenerateGeminiImageParams): Promise<GeminiImageResult> {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured. Please add it to your .env file.');
    }

    console.log('[Gemini Service] Generating image:', {
      prompt: params.prompt.substring(0, 50) + '...',
      model: GEMINI_MODEL,
    });

    // Gemini API endpoint for image generation
    const endpoint = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate an image: ${params.prompt}`,
          }],
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    const responseText = await response.text();
    if (responseText.trim() === '') {
      throw new Error(`Gemini API returned empty response (HTTP ${response.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Gemini Service] JSON parse error:', parseError);
      throw new Error(`Gemini API returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok) {
      console.error('[Gemini Service] API Error:', data);
      const errorMessage = data.error?.message || 'Unknown error';
      throw new Error(`Gemini API Error (${response.status}): ${errorMessage}`);
    }

    // Extract image data from response
    // Note: Gemini's actual response structure may vary based on the model and capabilities
    // This is a simplified implementation that needs to be adapted based on actual API behavior
    const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!imageData) {
      // If Gemini doesn't support image generation directly, throw error
      throw new Error('Gemini image generation not yet supported. Please use KIE.ai providers.');
    }

    // Convert base64 to URL (upload to storage)
    // For MVP, we'll use a data URL. In production, upload to Supabase Storage.
    const dataUrl = `data:image/png;base64,${imageData}`;

    console.log('[Gemini Service] Image generated (base64 length):', imageData.length);

    return {
      imageUrl: dataUrl,
      metadata: {
        model: GEMINI_MODEL,
        prompt: params.prompt,
        generatedAt: new Date().toISOString(),
      },
    };
  },

  /**
   * Upload base64 image to cloud storage
   *
   * TODO: Implement upload to Supabase Storage
   * For now, returns data URL as placeholder
   */
  async uploadBase64Image(base64Data: string): Promise<string> {
    // Placeholder implementation
    // In production, upload to Supabase Storage:
    // 1. Decode base64 to buffer
    // 2. Upload to Supabase Storage bucket
    // 3. Return public URL

    console.warn('[Gemini Service] uploadBase64Image not fully implemented - using data URL');
    return `data:image/png;base64,${base64Data}`;
  },
};
