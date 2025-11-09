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
const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co';

if (!KIE_API_KEY) {
  console.warn('[KIE Service] Warning: KIE_API_KEY not configured');
}

/**
 * Parameters for video generation (Veo3 or Sora2)
 */
export interface GenerateVideoParams {
  prompt: string;
  model?: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2-pro';
  aspectRatio?: string; // Default: '16:9'
  imageUrls?: string[]; // Optional image-to-video
  duration?: '10s' | '15s' | '25s'; // Sora2 duration (Pro supports 25s)
  removeWatermark?: boolean; // Sora2 watermark removal
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
      form.append('uploadPath', 'ugc-studio/uploads'); // Directory for UGC uploads

      const uploadUrl = `${KIE_UPLOAD_URL}/api/file-stream-upload`;
      console.log('[KIE Upload] Uploading to:', uploadUrl);

      // Upload to KIE using axios with form-data
      const uploadResponse = await axios.post(
        uploadUrl,
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

      console.log('[KIE Upload] Response:', { success: data.success, code: data.code, msg: data.msg });

      if (data.code !== 200 && !data.success) {
        console.error('[KIE Upload] API Error:', data);
        throw new Error(`KIE Upload API Error: ${data.msg || data.message || 'Unknown error'}`);
      }

      // Extract public URL from response (downloadUrl field)
      const uploadedUrl = data.data?.downloadUrl || data.data?.fileUrl || data.data?.url || data.fileUrl || data.url;

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
   * Upload file buffer directly to KIE.ai and get public URL
   * Use this when you already have the file data in memory (e.g., from multer)
   */
  async uploadFileBuffer(buffer: Buffer, mimeType: string, originalFilename?: string): Promise<string> {
    if (!KIE_API_KEY) {
      throw new Error('KIE_API_KEY is not configured. Please add it to your .env file.');
    }

    console.log('[KIE Upload Buffer] Uploading file buffer to KIE...');
    console.log('[KIE Upload Buffer] Buffer size:', buffer.length, 'bytes, type:', mimeType);

    try {
      // Determine file extension from MIME type
      const extension = mimeType.split('/')[1] || 'jpg';
      const fileName = originalFilename || `ugc_upload_${Date.now()}.${extension}`;

      // Create form data using form-data library
      const form = new FormData();
      form.append('file', buffer, {
        filename: fileName,
        contentType: mimeType,
      });
      form.append('uploadPath', 'ugc-studio/uploads'); // Directory for UGC uploads

      const uploadUrl = `${KIE_UPLOAD_URL}/api/file-stream-upload`;
      console.log('[KIE Upload Buffer] Uploading to:', uploadUrl);
      console.log('[KIE Upload Buffer] File info:', { filename: fileName, size: buffer.length, type: mimeType });

      // Upload to KIE using axios with form-data
      const uploadResponse = await axios.post(
        uploadUrl,
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

      console.log('[KIE Upload Buffer] Response:', { success: data.success, code: data.code, msg: data.msg });

      if (data.code !== 200 && !data.success) {
        console.error('[KIE Upload Buffer] API Error:', data);
        throw new Error(`KIE Upload API Error: ${data.msg || data.message || 'Unknown error'}`);
      }

      // Extract public URL from response (downloadUrl field)
      const uploadedUrl = data.data?.downloadUrl || data.data?.fileUrl || data.data?.url || data.fileUrl || data.url;

      if (!uploadedUrl) {
        console.error('[KIE Upload Buffer] No fileUrl in response:', data);
        throw new Error('KIE Upload API did not return a file URL');
      }

      console.log('[KIE Upload Buffer ✅] Uploaded to:', uploadedUrl);
      return uploadedUrl;

    } catch (error: any) {
      console.error('[KIE Upload Buffer ❌] Upload failed:', error.message);
      if (error.response) {
        console.error('[KIE Upload Buffer] Response status:', error.response.status);
        console.error('[KIE Upload Buffer] Response data:', error.response.data);
      }
      console.error('[KIE Upload Buffer] Error details:', error.stack || error.toString());
      throw new Error(`Failed to upload file buffer to KIE: ${error.message}`);
    }
  },

  /**
   * Generate video using Veo3 or Sora2
   */
  async generateVideo(params: GenerateVideoParams): Promise<KIEGenerationResult> {
    if (!KIE_API_KEY) {
      throw new Error('KIE_API_KEY is not configured. Please add it to your .env file.');
    }

    const model = params.model || 'veo3';
    const isSora = model.startsWith('sora');

    // ✅ FIX: Upload blob URLs to get public URLs before generating
    let publicImageUrls: string[] | undefined;
    if (params.imageUrls && params.imageUrls.length > 0) {
      console.log(`[KIE Service] Processing image URLs for ${model}...`);
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

    // Determine endpoint and request body based on model
    let endpoint: string;
    let requestBody: any;

    if (isSora) {
      // Sora2 uses unified jobs endpoint
      endpoint = `${KIE_BASE_URL}/api/v1/jobs/createTask`;

      // Convert aspect ratio to portrait/landscape
      const aspectRatioValue = params.aspectRatio === '9:16' ? 'portrait' : 'landscape';

      // Convert duration from "10s" to "10"
      const durationValue = (params.duration || '10s').replace('s', '');

      // Determine which Sora2 model to use
      const soraModel = publicImageUrls && publicImageUrls.length > 0
        ? 'sora-2-image-to-video'  // Image-to-video
        : 'sora-2-text-to-video';  // Text-to-video

      // Build request body based on model type
      // Note: Storyboard uses 'shots', but regular models use 'prompt'
      // Construct callback URL for production (Render deployment)
      const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || 'http://localhost:5000';
      const callBackUrl = `${baseUrl}/api/kie/sora2/callback`;

      requestBody = {
        model: soraModel,
        callBackUrl,  // Include callback URL for async updates
        input: {
          prompt: params.prompt,  // Add prompt field for non-Storyboard models
          n_frames: durationValue,
          aspect_ratio: aspectRatioValue,
          ...(publicImageUrls && publicImageUrls.length > 0 && { image_urls: publicImageUrls }),
        }
      };

      console.log('[KIE Service] Generating Sora2 video:', {
        model: soraModel,
        prompt: params.prompt.substring(0, 50) + '...',
        aspectRatio: aspectRatioValue,
        duration: durationValue + 's',
        callBackUrl,
        imageUrls: publicImageUrls?.map(url => url.substring(0, 60) + '...'),
      });
    } else {
      // Veo3 endpoint (existing)
      endpoint = `${KIE_BASE_URL}/api/v1/veo/generate`;

      requestBody = {
        prompt: params.prompt,
        model: model,
        aspectRatio: params.aspectRatio || '16:9',
        ...(publicImageUrls && { imageUrls: publicImageUrls }),
      };

      console.log('[KIE Service] Generating Veo3 video:', {
        prompt: params.prompt.substring(0, 50) + '...',
        model,
        aspectRatio: params.aspectRatio || '16:9',
        imageUrls: publicImageUrls?.map(url => url.substring(0, 60) + '...'),
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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

    console.log(`[KIE Service] ${isSora ? 'Sora2' : 'Veo3'} video generation started:`, data.data.taskId);

    return {
      taskId: data.data.taskId,
      provider: isSora ? 'kie-sora2' : 'kie-veo3',
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

    if (provider.includes('sora2') || provider.includes('sora-2')) {
      // Sora2 uses /jobs/recordInfo endpoint (camelCase, no hyphen!)
      // Source: n8n workflow line 630 - confirmed working endpoint
      endpoint = `${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${taskId}`;
    } else if (provider.includes('veo3')) {
      endpoint = `${KIE_BASE_URL}/api/v1/veo/record-info?taskId=${taskId}`;
    } else if (provider.includes('4o-image')) {
      endpoint = `${KIE_BASE_URL}/api/v1/gpt4o-image/record-info?taskId=${taskId}`;
    } else if (provider.includes('flux-kontext')) {
      endpoint = `${KIE_BASE_URL}/api/v1/flux/kontext/record-info?taskId=${taskId}`;
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // All status checks use GET (RESTful pattern for Sora2)
    console.log(`[KIE Service] Checking status:`, {
      provider,
      taskId,
      method: 'GET',
      endpoint,
    });

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
      console.error(`[KIE Service] ❌ API Error Response:`, JSON.stringify(data, null, 2));
      console.error(`[KIE Service] Provider: ${provider}, TaskId: ${taskId}`);
      throw new Error(`KIE API Error (${data.code}): ${data.msg || data.message || 'Unknown error'}`);
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

    // ✅ DEBUG: Log raw response for Sora2 to diagnose status/URL issues
    if (provider.includes('sora')) {
      console.log('[KIE Sora2 Debug] Raw response:', JSON.stringify(rawData, null, 2));
      console.log('[KIE Sora2 Debug] Fields:', {
        state,
        hasResultJson: !!rawData.resultJson,
        resultJsonType: typeof rawData.resultJson,
        failCode: rawData.failCode,
        failMsg: rawData.failMsg,
      });
    }

    // ✅ PHASE 4.7.1: Map status from multiple possible fields (Veo3 vs Images vs Sora2)
    // successFlag values observed:
    //   0 = processing (initial state)
    //   1 = success/ready
    //   2 = failed
    //   3 = processing/transcoding (Veo3 specific - video being generated)
    //  -1 = failed/error
    // Sora2 state values: "success", "fail", or undefined (processing)
    let status: 'processing' | 'ready' | 'failed';
    if (successFlag === 0 || successFlag === 3 || state === 'PROCESSING' || (provider.includes('sora') && !state)) {
      status = 'processing'; // ✅ FIX: successFlag=3 is also a processing state, Sora2 undefined state = processing
    } else if (successFlag === 1 || state === 'SUCCESS' || state === 'success') {
      status = 'ready';
    } else if (state === 'FAILED' || state === 'fail' || successFlag === -1 || successFlag === 2) {
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
    //  - Flux-Kontext images: data.response.resultImageUrl (CRITICAL for NanoBanana!)
    //  - Veo3 videos: data.response.resultUrls (lines 411, 1008)
    //  - Sora videos: JSON.parse(data.resultJson).resultUrls (line 681)

    let urls: any[] = [];

    // Check each path and use the first non-empty result
    if (rawData.response?.resultImageUrl) {
      // ✅ CRITICAL: Flux-Kontext (NanoBanana) returns resultImageUrl, not resultUrls!
      urls = [rawData.response.resultImageUrl];
    } else if (rawData.response?.resultUrls && rawData.response.resultUrls.length > 0) {
      // Veo3 PRIMARY path (videos)
      urls = rawData.response.resultUrls;
    } else if (rawData.resultJson?.resultUrls && rawData.resultJson.resultUrls.length > 0) {
      // Sora/NanoBanana path (may be JSON string)
      urls = rawData.resultJson.resultUrls;
    } else if (rawData.response?.videoUrl) {
      // Veo3 videoUrl
      urls = [rawData.response.videoUrl];
    } else if (rawData.response?.resultUrl) {
      // Single URL (Veo3)
      urls = [rawData.response.resultUrl];
    } else if (rawData.resultJson?.resultUrl) {
      // Single URL (Sora)
      urls = [rawData.resultJson.resultUrl];
    } else if (rawData.metadata?.response?.resultUrls && rawData.metadata.response.resultUrls.length > 0) {
      // Nested metadata path
      urls = rawData.metadata.response.resultUrls;
    } else if (rawData.response?.result_urls && rawData.response.result_urls.length > 0) {
      // Snake_case variant
      urls = rawData.response.result_urls;
    } else if (rawData.metadata?.resultUrls && rawData.metadata.resultUrls.length > 0) {
      // Direct metadata path
      urls = rawData.metadata.resultUrls;
    } else if (rawData.resultUrls && rawData.resultUrls.length > 0) {
      // Direct path
      urls = rawData.resultUrls;
    } else if (rawData.videoUrl) {
      // Direct videoUrl
      urls = [rawData.videoUrl];
    } else if (rawData.outputs && rawData.outputs.length > 0) {
      // Outputs array
      urls = rawData.outputs.map((o: any) => o.url).filter(Boolean);
    } else if (rawData.outputFiles && rawData.outputFiles.length > 0) {
      // Output files
      urls = rawData.outputFiles.filter(Boolean);
    } else if (rawData.result && rawData.result.length > 0) {
      // Result array
      urls = rawData.result.map((r: any) => r.url).filter(Boolean);
    } else if (rawData.records && rawData.records.length > 0) {
      // Records array
      urls = rawData.records.map((r: any) => r.fileUrl).filter(Boolean);
    } else if (rawData.resources && rawData.resources.length > 0) {
      // Resources array
      urls = rawData.resources.map((r: any) => r.url).filter(Boolean);
    } else if (rawData.data?.resources?.[0]?.url) {
      // Nested resources
      urls = [rawData.data.resources[0].url];
    } else if (rawData.resultUrl) {
      // Direct resultUrl
      urls = [rawData.resultUrl];
    } else if (rawData.url) {
      // Direct url
      urls = [rawData.url];
    }

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
