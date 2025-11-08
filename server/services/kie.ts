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

import FormData from 'form-data';
import axios from 'axios';

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
 * File upload result
 */
export interface KIEFileUploadResult {
  fileUrl: string;
  fileId?: string;
}

/**
 * KIE.ai Service
 */
export const kieService = {
  /**
   * Upload file to KIE.ai and get public URL
   * Use this to convert blob URLs or local files to publicly accessible URLs
   */
  async uploadFile(fileUrl: string): Promise<string> {
    if (!KIE_API_KEY) {
      throw new Error('KIE_API_KEY is not configured. Please add it to your .env file.');
    }

    // If already a public URL, return as-is
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      if (!fileUrl.startsWith('blob:')) {
        console.log('[KIE Upload] URL already public, skipping upload:', fileUrl.substring(0, 80) + '...');
        return fileUrl;
      }
    }

    console.log('[KIE Upload] Blob or local URL detected, uploading file to KIE...');

    try {
      // Fetch the file to get the actual data
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.status}`);
      }

      // Convert to buffer for Node.js form upload
      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Determine file extension from content-type
      const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.split('/')[1] || 'jpg';
      const fileName = `ugc_upload_${Date.now()}.${extension}`;

      console.log('[KIE Upload] File fetched, size:', buffer.length, 'bytes, type:', contentType);

      // Create form data using form-data library
      const form = new FormData();
      form.append('file', buffer, {
        filename: fileName,
        contentType: contentType,
      });

      console.log('[KIE Upload] Uploading to KIE File Upload API...');

      // Upload to KIE using axios with form-data
      const uploadResponse = await axios.post(
        `${KIE_BASE_URL}/api/v1/file/upload`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            ...form.getHeaders(), // Adds Content-Type with boundary
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      const data = uploadResponse.data;

      if (data.code !== 200 && !data.success) {
        console.error('[KIE Upload] API Error:', data);
        throw new Error(`KIE Upload API Error: ${data.msg || data.message || 'Unknown error'}`);
      }

      // Extract public URL from response
      const uploadedUrl = data.data?.fileUrl || data.data?.url || data.fileUrl || data.url;

      if (!uploadedUrl) {
        console.error('[KIE Upload] No fileUrl in response:', data);
        throw new Error('KIE Upload API did not return a file URL');
      }

      console.log('[KIE Upload ✅] Uploaded to:', uploadedUrl);
      return uploadedUrl;

    } catch (error: any) {
      console.error('[KIE Upload ❌] Upload failed:', error.message);
      if (error.response) {
        console.error('[KIE Upload] Response status:', error.response.status);
        console.error('[KIE Upload] Response data:', error.response.data);
      }
      console.error('[KIE Upload] Error details:', error.stack || error.toString());
      throw new Error(`Failed to upload file to KIE: ${error.message}`);
    }
  },
  /**
   * Generate video using Veo3
   */
  async generateVideo(params: GenerateVideoParams): Promise<KIEGenerationResult> {
    if (!KIE_API_KEY) {
      throw new Error('KIE_API_KEY is not configured. Please add it to your .env file.');
    }

    // ✅ FIX: Upload blob URLs to get public URLs before generating
    let publicImageUrls: string[] | undefined;
    if (params.imageUrls && params.imageUrls.length > 0) {
      console.log('[KIE Service] Processing image URLs for Veo3...');
      publicImageUrls = [];

      for (const imageUrl of params.imageUrls) {
        try {
          const publicUrl = await this.uploadFile(imageUrl);
          publicImageUrls.push(publicUrl);
        } catch (error: any) {
          console.error('[KIE Service] Failed to upload image, will try to use original URL:', error.message);
          // Fallback to original URL if upload fails (in case it's already public)
          publicImageUrls.push(imageUrl);
        }
      }
    }

    console.log('[KIE Service] Generating video:', {
      prompt: params.prompt.substring(0, 50) + '...',
      model: params.model || 'veo3',
      aspectRatio: params.aspectRatio || '16:9',
      imageUrls: publicImageUrls?.map(url => url.substring(0, 60) + '...'),
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
        ...(publicImageUrls && { imageUrls: publicImageUrls }),
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

    // ✅ FIX: Upload blob URLs to get public URLs before generating
    let publicReferenceUrl: string | undefined;
    if (params.referenceImageUrl) {
      try {
        console.log('[KIE Service] Processing reference image URL...');
        publicReferenceUrl = await this.uploadFile(params.referenceImageUrl);
      } catch (error: any) {
        console.error('[KIE Service] Failed to upload reference image, will try original URL:', error.message);
        publicReferenceUrl = params.referenceImageUrl; // Fallback to original
      }
    }

    console.log('[KIE Service] Generating image:', {
      prompt: params.prompt.substring(0, 50) + '...',
      provider: params.provider,
      referenceImageUrl: publicReferenceUrl ? publicReferenceUrl.substring(0, 60) + '...' : undefined,
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
        ...(publicReferenceUrl && { filesUrl: [publicReferenceUrl] }),
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
        ...(publicReferenceUrl && { inputImage: publicReferenceUrl }),
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

    const rawData = data.data;
    const successFlag = rawData.successFlag;
    const state = rawData.state; // ✅ PHASE 4.7.1: Veo3 uses 'state' field instead of 'successFlag'

    // ✅ DEBUG: Log raw response for Flux-Kontext to diagnose parsing issues
    if (provider.includes('flux-kontext')) {
      console.log('[KIE Flux-Kontext Debug] Raw response:', JSON.stringify(rawData, null, 2));
      console.log('[KIE Flux-Kontext Debug] Fields:', {
        successFlag,
        state,
        hasResponse: !!rawData.response,
        hasResultJson: !!rawData.resultJson,
        resultJsonType: typeof rawData.resultJson,
      });
    }

    // ✅ DEBUG: Log raw response for Veo3 to diagnose status/URL issues
    if (provider.includes('veo3')) {
      console.log('[KIE Veo3 Debug] Raw response:', JSON.stringify(rawData, null, 2));
      console.log('[KIE Veo3 Debug] Fields:', {
        successFlag,
        state,
        hasResponse: !!rawData.response,
        hasResultUrls: !!rawData.response?.resultUrls,
        resultUrlsCount: rawData.response?.resultUrls?.length || 0,
        hasResultJson: !!rawData.resultJson,
        resultJsonType: typeof rawData.resultJson,
      });
    }

    // ✅ PHASE 4.7.1: Map status from multiple possible fields (Veo3 vs Images)
    // successFlag values observed:
    //   0 = processing (initial state)
    //   1 = success/ready
    //   2 = failed
    //   3 = processing/transcoding (Veo3 specific - video being generated)
    //  -1 = failed/error
    let status: 'processing' | 'ready' | 'failed';
    if (successFlag === 0 || successFlag === 3 || state === 'PROCESSING') {
      status = 'processing'; // ✅ FIX: successFlag=3 is also a processing state
    } else if (successFlag === 1 || state === 'SUCCESS') {
      status = 'ready';
    } else if (state === 'FAILED' || successFlag === -1 || successFlag === 2) {
      status = 'failed';
    } else {
      // Unknown state - log warning and default to processing
      console.warn(`[KIE Service] ⚠️ Unknown status: successFlag=${successFlag}, state=${state}`);
      status = 'processing';
    }

    console.log(`[KIE Status Check] ${provider} - successFlag=${successFlag}, state=${state}, mapped status=${status}`);

    // Extract result URLs with robust fallback logic
    // ✅ FIX: Check for URLs regardless of status - sometimes KIE returns URLs before changing successFlag
    let resultUrls: string[] | undefined;

    // Always try to extract URLs (not just when status=ready)
    // This handles cases where URLs appear before successFlag changes to 1
    // ✅ PHASE 4.7.1: Check ALL possible KIE response paths (based on n8n workflow analysis)
    // Priority order verified from UGC Ads Veo & Sora.json n8n template:
    //  - Veo3 videos: data.response.resultUrls (lines 411, 1008)
    //  - Sora videos: JSON.parse(data.resultJson).resultUrls (line 681)
    //  - NanoBanana images: JSON.parse(data.resultJson).resultUrls (line 229)
    let urls: any[] =
      rawData.response?.resultUrls ||            // ✅ Veo3 PRIMARY path (videos)
      rawData.resultJson?.resultUrls ||          // Sora/NanoBanana path (may be JSON string)
      rawData.metadata?.response?.resultUrls ||  // Nested metadata path
      rawData.response?.result_urls ||           // Snake_case variant
      rawData.metadata?.resultUrls ||            // Direct metadata path
      rawData.resultUrls ||                      // Direct path
      (rawData.resultJson?.resultUrl ? [rawData.resultJson.resultUrl] : []) || // Single URL (Sora)
      (rawData.response?.resultUrl ? [rawData.response.resultUrl] : []) ||  // Single URL (Veo3)
      (rawData.response?.resultImageUrl ? [rawData.response.resultImageUrl] : []) || // Flux kontext
      (rawData.response?.videoUrl ? [rawData.response.videoUrl] : []) || // Veo3 videoUrl
      (rawData.videoUrl ? [rawData.videoUrl] : []) || // Direct videoUrl
      rawData.outputs?.map((o: any) => o.url).filter(Boolean) ||
      rawData.outputFiles?.filter(Boolean) ||
      rawData.result?.map((r: any) => r.url).filter(Boolean) ||
      rawData.records?.map((r: any) => r.fileUrl).filter(Boolean) ||
      rawData.resources?.map((r: any) => r.url).filter(Boolean) ||
      (rawData.data?.resources?.[0]?.url ? [rawData.data.resources[0].url] : []) ||
      (rawData.resultUrl ? [rawData.resultUrl] : []) ||
      (rawData.url ? [rawData.url] : []) ||
      [];

    // ✅ Handle case where resultJson is a JSON string (Sora/NanoBanana)
    if ((!urls || urls.length === 0) && typeof rawData.resultJson === 'string') {
      try {
        const parsed = JSON.parse(rawData.resultJson);
        urls = parsed.resultUrls || parsed.resultUrl ? [parsed.resultUrl] : [];
      } catch (e) {
        // resultJson not a valid JSON string, continue with fallbacks
      }
    }

    resultUrls = urls.filter(Boolean); // Remove null/undefined

    // ✅ FIX: If we found URLs, mark as ready regardless of successFlag
    // This handles edge cases where KIE returns URLs before updating successFlag
    if (resultUrls && resultUrls.length > 0 && status === 'processing') {
      console.log(`[KIE Service] ⚠️ Found URLs but status was processing - marking as ready`);
      status = 'ready';
    }

    // ✅ PHASE 4.7.1: Enhanced logging for Veo3 debugging
    if (provider.includes('veo3')) {
      console.log('[KIE Veo3 ✅] Status check:', {
        taskId,
        state,
        successFlag,
        status,
        urlCount: resultUrls?.length || 0,
        firstUrl: resultUrls?.[0] ? resultUrls[0].substring(0, 60) + '...' : 'none',
      });
    } else if (provider.includes('flux-kontext')) {
      console.log('[KIE Flux-Kontext ✅] URL extraction result:', {
        taskId,
        state,
        successFlag,
        status,
        urlCount: resultUrls?.length || 0,
        firstUrl: resultUrls?.[0] ? resultUrls[0].substring(0, 80) + '...' : 'none',
      });
    } else {
      console.log('[KIE FIX ✅] Extracted resultUrls:', resultUrls);
    }

    if (!resultUrls || resultUrls.length === 0) {
      console.warn(`[KIE Service] ⚠️ No result URLs found in response for ${provider}!`);
      console.log('[KIE Service] All checked paths:', {
        'response.resultUrls': rawData.response?.resultUrls,
        'resultJson.resultUrls': rawData.resultJson?.resultUrls,
        'resultJson (type)': typeof rawData.resultJson,
        'response.resultImageUrl': rawData.response?.resultImageUrl,
        'response.videoUrl': rawData.response?.videoUrl,
        'metadata.response.resultUrls': rawData.metadata?.response?.resultUrls,
      });
      console.log('[KIE Service] Full raw response data:', JSON.stringify(rawData, null, 2));
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
