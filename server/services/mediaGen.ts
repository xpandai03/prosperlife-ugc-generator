/**
 * Media Generation Orchestrator
 *
 * Unified interface for all AI media generation providers
 */

import { kieService } from './kie.js';
import { geminiService } from './gemini.js';

export type MediaProvider = 'kie-veo3' | 'kie-4o-image' | 'kie-flux-kontext' | 'gemini-flash';
export type MediaType = 'image' | 'video';

export interface GenerateMediaParams {
  provider: MediaProvider;
  type: MediaType;
  prompt: string;
  referenceImageUrl?: string;
  options?: {
    // Video options
    aspectRatio?: string;
    duration?: number;
    resolution?: '720p' | '1080p';

    // Image options
    size?: '1:1' | '3:2' | '2:3';
    style?: string;
    nVariants?: 1 | 2 | 4;
  };
}

export interface MediaGenerationResult {
  taskId: string;
  provider: MediaProvider;
  type: MediaType;
  status: 'processing' | 'ready' | 'failed';
  resultUrl?: string;
  resultUrls?: string[]; // ✅ PHASE 4.7.1: Array of result URLs for validation
  metadata?: any;
}

/**
 * Generate media using specified provider
 */
export async function generateMedia(params: GenerateMediaParams): Promise<MediaGenerationResult> {
  console.log('[MediaGen] Starting generation:', {
    provider: params.provider,
    type: params.type,
    prompt: params.prompt.substring(0, 50) + '...',
  });

  try {
    if (params.type === 'video') {
      // Video generation - KIE Veo3 only
      if (params.provider !== 'kie-veo3') {
        throw new Error('Only kie-veo3 provider supports video generation');
      }

      const result = await kieService.generateVideo({
        prompt: params.prompt,
        model: 'veo3',
        aspectRatio: params.options?.aspectRatio || '16:9',
        imageUrls: params.referenceImageUrl ? [params.referenceImageUrl] : undefined,
      });

      return {
        taskId: result.taskId,
        provider: params.provider,
        type: params.type,
        status: 'processing',
      };
    } else {
      // Image generation
      if (params.provider === 'gemini-flash') {
        // Gemini Flash (synchronous fallback)
        const result = await geminiService.generateImage({
          prompt: params.prompt,
          aspectRatio: params.options?.size as any,
        });

        return {
          taskId: `gemini-${Date.now()}`,
          provider: params.provider,
          type: params.type,
          status: 'ready',
          resultUrl: result.imageUrl,
          metadata: result.metadata,
        };
      } else {
        // KIE image generation
        const imageProvider = params.provider === 'kie-4o-image' ? '4o-image' : 'flux-kontext';

        const result = await kieService.generateImage({
          prompt: params.prompt,
          provider: imageProvider,
          size: params.options?.size,
          aspectRatio: params.options?.aspectRatio,
          nVariants: params.options?.nVariants,
          referenceImageUrl: params.referenceImageUrl,
        });

        return {
          taskId: result.taskId,
          provider: params.provider,
          type: params.type,
          status: 'processing',
        };
      }
    }
  } catch (error: any) {
    console.error('[MediaGen] Generation failed:', error);
    throw error;
  }
}

/**
 * Check generation status (polling)
 */
export async function checkMediaStatus(
  taskId: string,
  provider: MediaProvider
): Promise<MediaGenerationResult> {
  console.log('[MediaGen] Checking status:', { taskId, provider });

  if (provider === 'gemini-flash') {
    // Gemini is synchronous, should already be complete
    throw new Error('Gemini Flash generations are synchronous and do not require polling');
  }

  const status = await kieService.checkStatus(taskId, provider);

  return {
    taskId,
    provider,
    type: provider.includes('veo3') ? 'video' : 'image',
    status: status.status,
    resultUrl: status.resultUrls?.[0],
    resultUrls: status.resultUrls, // ✅ PHASE 4.7.1: Include all URLs array for validation
    metadata: {
      progress: status.progress,
      errorMessage: status.errorMessage,
      checkedAt: new Date().toISOString(), // ✅ PHASE 4.7.1: Add timestamp for debugging
    },
  };
}
