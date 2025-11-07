/**
 * KIE.ai Media Generation Service
 *
 * Supports:
 * - Veo3 video generation (8s max)
 * - 4O Image generation
 * - Flux Kontext image generation
 *
 * Documentation: https://docs.kie.ai/
 */

const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_BASE_URL = 'https://api.kie.ai';

if (!KIE_API_KEY) {
  console.warn('[KIE Service] Warning: KIE_API_KEY not configured');
}

/**
 * Parameters for Veo3 video generation
 */
export interface GenerateVideoParams {
  prompt: string;
  model?: 'veo3' | 'veo3_fast';
  aspectRatio?: string; // Default: '16:9'
  imageUrls?: string[]; // Optional image-to-video
}

/**
 * Parameters for image generation
 */
export interface GenerateImageParams {
  prompt: string;
  provider: '4o-image' | 'flux-kontext'; // User selects
  size?: '1:1' | '3:2' | '2:3'; // For 4O
  aspectRatio?: string; // For Flux (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, 16:21)
  model?: 'flux-kontext-pro' | 'flux-kontext-max';
  nVariants?: 1 | 2 | 4; // For 4O
  referenceImageUrl?: string; // Optional input image
}

/**
 * Result from starting a generation
 */
export interface KIEGenerationResult {
  taskId: string;
  provider: string;
  type: 'video' | 'image';
}

/**
 * Status check result
 */
export interface KIEStatusResult {
  taskId: string;
  status: 'processing' | 'ready' | 'failed';
  resultUrls?: string[];
  errorMessage?: string;
  progress?: number; // 0-1 for 4O Image
}

/**
 * KIE.ai Service
 */
export const kieService = {
  /**
   * Generate video using Veo3
   */
  async generateVideo(params: GenerateVideoParams): Promise<KIEGenerationResult> {
    if (!KIE_API_KEY) {
      throw new Error('KIE_API_KEY is not configured. Please add it to your .env file.');
    }

    console.log('[KIE Service] Generating video:', {
      prompt: params.prompt.substring(0, 50) + '...',
      model: params.model || 'veo3',
      aspectRatio: params.aspectRatio || '16:9',
    });

    const response = await fetch(`${KIE_BASE_URL}/api/v1/veo/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        model: params.model || 'veo3',
        aspectRatio: params.aspectRatio || '16:9',
        ...(params.imageUrls && { imageUrls: params.imageUrls }),
      }),
    });

    // Safe JSON parsing (following existing pattern)
    const responseText = await response.text();
    if (responseText.trim() === '') {
      throw new Error(`KIE API returned empty response (HTTP ${response.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[KIE Service] JSON parse error:', parseError);
      throw new Error(`KIE API returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    if (data.code !== 200) {
      console.error('[KIE Service] API Error:', data);
      throw new Error(`KIE API Error: ${data.msg || 'Unknown error'}`);
    }

    console.log('[KIE Service] Video generation started:', data.data.taskId);

    return {
      taskId: data.data.taskId,
      provider: 'kie-veo3',
      type: 'video',
    };
  },

  /**
   * Generate image using 4O Image or Flux Kontext
   */
  async generateImage(params: GenerateImageParams): Promise<KIEGenerationResult> {
    if (!KIE_API_KEY) {
      throw new Error('KIE_API_KEY is not configured. Please add it to your .env file.');
    }

    console.log('[KIE Service] Generating image:', {
      prompt: params.prompt.substring(0, 50) + '...',
      provider: params.provider,
    });

    let endpoint: string;
    let requestBody: any;

    if (params.provider === '4o-image') {
      endpoint = `${KIE_BASE_URL}/api/v1/gpt4o-image/generate`;
      requestBody = {
        prompt: params.prompt,
        size: params.size || '1:1',
        nVariants: params.nVariants || 1,
        isEnhance: false,
        ...(params.referenceImageUrl && { filesUrl: [params.referenceImageUrl] }),
      };
    } else {
      endpoint = `${KIE_BASE_URL}/api/v1/flux/kontext/generate`;
      requestBody = {
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || '16:9',
        model: params.model || 'flux-kontext-pro',
        outputFormat: 'png',
        enableTranslation: true,
        promptUpsampling: true,
        ...(params.referenceImageUrl && { inputImage: params.referenceImageUrl }),
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    if (responseText.trim() === '') {
      throw new Error(`KIE API returned empty response (HTTP ${response.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[KIE Service] JSON parse error:', parseError);
      throw new Error(`KIE API returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    if (data.code !== 200) {
      console.error('[KIE Service] API Error:', data);
      throw new Error(`KIE API Error: ${data.msg || 'Unknown error'}`);
    }

    console.log('[KIE Service] Image generation started:', data.data.taskId);

    return {
      taskId: data.data.taskId,
      provider: `kie-${params.provider}`,
      type: 'image',
    };
  },

  /**
   * Check generation status (video or image)
   */
  async checkStatus(taskId: string, provider: string): Promise<KIEStatusResult> {
    if (!KIE_API_KEY) {
      throw new Error('KIE_API_KEY is not configured. Please add it to your .env file.');
    }

    let endpoint: string;

    if (provider.includes('veo3')) {
      endpoint = `${KIE_BASE_URL}/api/v1/veo/record-info?taskId=${taskId}`;
    } else if (provider.includes('4o-image')) {
      endpoint = `${KIE_BASE_URL}/api/v1/gpt4o-image/record-info?taskId=${taskId}`;
    } else if (provider.includes('flux-kontext')) {
      endpoint = `${KIE_BASE_URL}/api/v1/flux/kontext/record-info?taskId=${taskId}`;
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
    });

    const responseText = await response.text();
    if (responseText.trim() === '') {
      throw new Error(`KIE API returned empty response (HTTP ${response.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[KIE Service] JSON parse error:', parseError);
      throw new Error(`KIE API returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    if (data.code !== 200) {
      throw new Error(`KIE API Error: ${data.msg || 'Unknown error'}`);
    }

    const successFlag = data.data.successFlag;

    // Map successFlag to status
    let status: 'processing' | 'ready' | 'failed';
    if (successFlag === 0) {
      status = 'processing';
    } else if (successFlag === 1) {
      status = 'ready';
    } else {
      status = 'failed';
    }

    // Extract result URLs
    let resultUrls: string[] | undefined;
    if (status === 'ready') {
      if (provider.includes('veo3')) {
        resultUrls = JSON.parse(data.data.resultUrls || '[]');
      } else if (provider.includes('4o-image')) {
        resultUrls = data.data.response?.result_urls || [];
      } else if (provider.includes('flux-kontext')) {
        resultUrls = [data.data.response?.resultImageUrl];
      }
    }

    return {
      taskId,
      status,
      resultUrls,
      errorMessage: data.data.errorMessage,
      progress: data.data.progress ? parseFloat(data.data.progress) : undefined,
    };
  },

  /**
   * Get 1080p HD version (Veo3 only, requires 16:9 aspect ratio)
   */
  async get1080pVideo(taskId: string): Promise<string> {
    if (!KIE_API_KEY) {
      throw new Error('KIE_API_KEY is not configured. Please add it to your .env file.');
    }

    const response = await fetch(
      `${KIE_BASE_URL}/api/v1/veo/get-1080p-video?taskId=${taskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${KIE_API_KEY}`,
        },
      }
    );

    const responseText = await response.text();
    if (responseText.trim() === '') {
      throw new Error(`KIE API returned empty response (HTTP ${response.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[KIE Service] JSON parse error:', parseError);
      throw new Error(`KIE API returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    if (data.code !== 200) {
      throw new Error(`Failed to get 1080p video: ${data.msg}`);
    }

    return data.data.hdVideoUrl;
  },
};
