/**
 * Automation Renderer (Jan 2026)
 *
 * Renders SceneSpecs into videos using the existing KIE video generation pipeline.
 * This is the default/fast path for Content Engine.
 */

import { v4 as uuidv4 } from 'uuid';
import type { SceneSpec, SceneObject, MediaAsset } from '../../../shared/schema';
import { kieService } from '../kie';
import { storage } from '../../storage';
import {
  type IRenderer,
  type RenderResult,
  type RenderOptions,
  transformScenesToPrompt,
} from './base';

// ==================== CONSTANTS ====================

/**
 * Maximum polling attempts (15 seconds × 40 = 10 minutes)
 */
const MAX_POLL_ATTEMPTS = 40;

/**
 * Polling interval in milliseconds
 */
const POLL_INTERVAL_MS = 15000;

/**
 * Provider-specific duration limits
 */
const DURATION_LIMITS = {
  veo3: { min: 6, max: 20 },
  sora2: { min: 6, max: 15 },
};

// ==================== AUTOMATION RENDERER ====================

/**
 * Automation Renderer
 *
 * Uses KIE's Veo3 or Sora2 to render SceneSpecs into videos.
 * Follows the existing mediaGen polling pattern.
 */
export const automationRenderer: IRenderer = {
  name: 'automation',

  /**
   * Check if this renderer can handle the SceneSpec
   */
  canHandle(sceneSpec: SceneSpec): boolean {
    return sceneSpec.rendererType === 'automation';
  },

  /**
   * Render a SceneSpec into a video
   */
  async render(sceneSpec: SceneSpec, options?: RenderOptions): Promise<RenderResult> {
    const startTime = Date.now();
    const provider = options?.provider || 'veo3';
    const aspectRatio = options?.aspectRatio || '9:16'; // Vertical for shorts

    console.log('[Automation Renderer] Starting render:', {
      sceneSpecId: sceneSpec.id,
      title: sceneSpec.title,
      targetDuration: sceneSpec.targetDuration,
      sceneCount: (sceneSpec.scenes as SceneObject[]).length,
      provider,
      aspectRatio,
    });

    try {
      // 1. Validate duration against provider limits
      const limits = DURATION_LIMITS[provider];
      const duration = Math.min(Math.max(sceneSpec.targetDuration, limits.min), limits.max);

      if (duration !== sceneSpec.targetDuration) {
        console.log(`[Automation Renderer] Duration adjusted from ${sceneSpec.targetDuration}s to ${duration}s for ${provider}`);
      }

      // 2. Transform SceneSpec into video prompt
      const scenes = sceneSpec.scenes as SceneObject[];
      const prompt = transformScenesToPrompt(scenes, duration);

      console.log('[Automation Renderer] Generated prompt:', {
        length: prompt.length,
        preview: prompt.substring(0, 200) + '...',
      });

      // 3. Start video generation
      const generation = await kieService.generateVideo({
        prompt,
        model: provider === 'sora2' ? 'sora2' : 'veo3',
        aspectRatio,
        duration,
      });

      console.log('[Automation Renderer] Generation started:', {
        taskId: generation.taskId,
        provider: generation.provider,
      });

      // 4. Create MediaAsset record (processing state)
      const assetId = uuidv4();
      const mediaAsset = await storage.createMediaAsset({
        id: assetId,
        userId: sceneSpec.userId,
        provider: generation.provider,
        type: 'video',
        prompt,
        status: 'processing',
        taskId: generation.taskId,
        sceneSpecId: sceneSpec.id,
        metadata: {
          sceneSpecId: sceneSpec.id,
          channelConfigId: sceneSpec.channelConfigId,
          renderOptions: options,
          scenes: scenes.length,
          targetDuration: duration,
        },
      });

      // 5. Update SceneSpec status to rendering
      await storage.updateSceneSpec(sceneSpec.id, {
        status: 'rendering',
        mediaAssetId: assetId,
      });

      // 6. Poll for completion (background)
      // Note: We start polling in background and return immediately
      // The status can be checked via the media asset endpoint
      pollForCompletion(generation.taskId, generation.provider, assetId, sceneSpec.id)
        .catch(error => {
          console.error('[Automation Renderer] Polling error:', error);
        });

      const renderTime = Date.now() - startTime;

      return {
        success: true,
        mediaAssetId: assetId,
        metadata: {
          provider: generation.provider,
          duration,
          renderTime,
        },
      };
    } catch (error) {
      console.error('[Automation Renderer] Render error:', error);

      // Update SceneSpec status to failed
      await storage.updateSceneSpec(sceneSpec.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Render failed',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown render error',
      };
    }
  },
};

// ==================== POLLING FUNCTION ====================

/**
 * Poll for video generation completion
 * Updates both MediaAsset and SceneSpec when complete
 */
async function pollForCompletion(
  taskId: string,
  provider: string,
  assetId: string,
  sceneSpecId: string
): Promise<void> {
  console.log('[Automation Renderer] Starting poll:', { taskId, provider, assetId, sceneSpecId });

  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    await sleep(POLL_INTERVAL_MS);
    attempts++;

    try {
      const status = await kieService.checkStatus(taskId, provider);

      console.log(`[Automation Renderer] Poll ${attempts}/${MAX_POLL_ATTEMPTS}:`, {
        taskId,
        status: status.status,
        hasUrls: !!status.resultUrls?.length,
      });

      if (status.status === 'ready') {
        // Success - update MediaAsset and SceneSpec
        const resultUrl = status.resultUrls?.[0];

        await storage.updateMediaAsset(assetId, {
          status: 'ready',
          resultUrl,
          resultUrls: status.resultUrls,
          completedAt: new Date(),
        });

        await storage.updateSceneSpec(sceneSpecId, {
          status: 'rendered',
          renderedAt: new Date(),
        });

        console.log('[Automation Renderer] Render complete:', {
          assetId,
          sceneSpecId,
          resultUrl: resultUrl?.substring(0, 60) + '...',
        });

        return;
      }

      if (status.status === 'failed') {
        // Failed - update both records
        const errorMessage = status.errorMessage || 'Video generation failed';

        await storage.updateMediaAsset(assetId, {
          status: 'error',
          errorMessage,
        });

        await storage.updateSceneSpec(sceneSpecId, {
          status: 'failed',
          errorMessage,
        });

        console.error('[Automation Renderer] Render failed:', { assetId, sceneSpecId, errorMessage });

        return;
      }

      // Still processing - continue polling
    } catch (error) {
      console.error(`[Automation Renderer] Poll error (attempt ${attempts}):`, error);

      // Continue polling on transient errors
      if (attempts >= MAX_POLL_ATTEMPTS) {
        throw error;
      }
    }
  }

  // Timeout - mark as failed
  const timeoutMessage = `Render timeout after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000} seconds`;

  await storage.updateMediaAsset(assetId, {
    status: 'error',
    errorMessage: timeoutMessage,
  });

  await storage.updateSceneSpec(sceneSpecId, {
    status: 'failed',
    errorMessage: timeoutMessage,
  });

  console.error('[Automation Renderer] Render timeout:', { assetId, sceneSpecId });
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== EXPORTS ====================

export default automationRenderer;
