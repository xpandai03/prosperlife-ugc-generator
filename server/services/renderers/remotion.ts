/**
 * Remotion Renderer (Jan 2026)
 * 
 * Content Engine's primary renderer for long-form video (3-10 minutes).
 * Uses Claude AI to generate Remotion code, then dispatches to render worker.
 * 
 * Flow:
 * 1. Pre-generate TTS audio for all scenes (ElevenLabs)
 * 2. Fetch stock footage for all scenes (Pexels)
 * 3. Generate Remotion code via Claude API
 * 4. Validate generated code
 * 5. Dispatch to render worker (Docker service)
 * 6. Poll for completion
 * 7. Update MediaAsset with result URL
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import type { SceneSpec, SceneObject, MediaAsset } from '../../../shared/schema';
import type { IRenderer, RenderResult, RemotionRenderOptions } from './base';
import { ttsService } from '../tts';
import { stockFootageService } from '../stockFootage';
import { remotionPrompts, type RemotionPromptInput } from '../../prompts/remotion-codegen';
import { storage } from '../../storage';

// ==================== CONFIGURATION ====================

// Render worker URL (Docker service)
const RENDER_WORKER_URL = process.env.REMOTION_WORKER_URL || 'http://localhost:3001';

// Claude API for code generation
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Default render settings
const DEFAULT_FPS = 30;
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920; // 9:16 portrait

// Polling settings
const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_POLL_ATTEMPTS = 30; // 15 minutes max

// ==================== TYPES ====================

interface RenderJob {
  jobId: string;
  sceneSpecId: string;
  code: string;
  config: {
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
  };
  status: 'queued' | 'rendering' | 'complete' | 'failed';
  resultUrl?: string;
  error?: string;
}

interface PreparedScene {
  order: number;
  voiceoverText: string;
  visualIntent: string;
  durationHint?: number;
  audioUrl: string;
  videoUrls: string[];
}

// ==================== RENDERER ====================

/**
 * Remotion Renderer - Content Engine long-form video renderer
 */
export const remotionRenderer: IRenderer = {
  name: 'remotion',

  /**
   * Check if this renderer can handle the SceneSpec
   */
  canHandle(sceneSpec: SceneSpec): boolean {
    return sceneSpec.rendererType === 'remotion' || sceneSpec.rendererType === 'code_based';
  },

  /**
   * Render a SceneSpec using Remotion
   */
  async render(sceneSpec: SceneSpec, options?: RemotionRenderOptions): Promise<RenderResult> {
    console.log('[Remotion Renderer] Starting render for SceneSpec:', sceneSpec.id);
    console.log('[Remotion Renderer] Title:', sceneSpec.title);
    console.log('[Remotion Renderer] Target duration:', sceneSpec.targetDuration, 'seconds');

    // Validate SceneSpec
    if (!sceneSpec.scenes || sceneSpec.scenes.length === 0) {
      return {
        success: false,
        error: 'SceneSpec has no scenes defined',
      };
    }

    // Validate duration (Content Engine: 3-10 minutes)
    if (sceneSpec.targetDuration < 180) {
      return {
        success: false,
        error: `Duration too short for Content Engine. Minimum is 3 minutes (180s), got ${sceneSpec.targetDuration}s`,
      };
    }
    if (sceneSpec.targetDuration > 600) {
      return {
        success: false,
        error: `Duration too long for Content Engine v1. Maximum is 10 minutes (600s), got ${sceneSpec.targetDuration}s`,
      };
    }

    const scenes = sceneSpec.scenes as SceneObject[];
    const fps = options?.fps || DEFAULT_FPS;
    const width = options?.width || DEFAULT_WIDTH;
    const height = options?.height || DEFAULT_HEIGHT;

    try {
      // Step 1: Generate TTS audio for all scenes
      console.log('[Remotion Renderer] Step 1: Generating TTS audio...');
      const voiceoverTexts = scenes.map(s => s.voiceoverText);
      const ttsResult = await ttsService.generateAudioBatch(voiceoverTexts);
      
      if (!ttsResult.success) {
        console.error('[Remotion Renderer] TTS errors:', ttsResult.errors);
        // Continue with partial audio - some scenes may have null
      }

      // Step 2: Fetch stock footage for all scenes
      console.log('[Remotion Renderer] Step 2: Fetching stock footage...');
      const visualIntents = scenes.map(s => s.visualIntent);
      const footageResult = await stockFootageService.getFootageForScenes(visualIntents, 1);
      
      if (!footageResult.success) {
        console.warn('[Remotion Renderer] Stock footage warnings:', footageResult.errors);
        // Continue with fallback footage
      }

      // Step 3: Prepare scenes with assets
      console.log('[Remotion Renderer] Step 3: Preparing scene data...');
      const preparedScenes: PreparedScene[] = scenes.map((scene, index) => ({
        order: scene.order,
        voiceoverText: scene.voiceoverText,
        visualIntent: scene.visualIntent,
        durationHint: scene.durationHint,
        audioUrl: ttsResult.audioUrls[index] || '',
        videoUrls: footageResult.videoUrls[index] || [],
      }));

      // Step 4: Generate Remotion code via Claude
      console.log('[Remotion Renderer] Step 4: Generating Remotion code via Claude...');
      const promptInput: RemotionPromptInput = {
        title: sceneSpec.title,
        description: sceneSpec.description || '',
        targetDurationSeconds: sceneSpec.targetDuration,
        fps,
        width,
        height,
        scenes: preparedScenes,
      };

      const generatedCode = await generateRemotionCode(promptInput);
      
      if (!generatedCode) {
        return {
          success: false,
          error: 'Failed to generate Remotion code from Claude',
        };
      }

      // Step 5: Validate generated code
      console.log('[Remotion Renderer] Step 5: Validating generated code...');
      const cleanedCode = remotionPrompts.cleanCode(generatedCode);
      const validation = remotionPrompts.validateCode(cleanedCode);
      
      if (!validation.valid) {
        console.error('[Remotion Renderer] Code validation failed:', validation.error);
        return {
          success: false,
          error: `Generated code validation failed: ${validation.error}`,
        };
      }

      // Step 6: Create MediaAsset record
      console.log('[Remotion Renderer] Step 6: Creating MediaAsset...');
      const assetId = uuidv4();
      const durationInFrames = sceneSpec.targetDuration * fps;

      await storage.createMediaAsset({
        id: assetId,
        userId: sceneSpec.userId,
        provider: 'remotion',
        type: 'video',
        prompt: `Content Engine: ${sceneSpec.title}`,
        status: 'processing',
        sceneSpecId: sceneSpec.id,
        metadata: {
          sceneSpecId: sceneSpec.id,
          channelConfigId: sceneSpec.channelConfigId,
          targetDuration: sceneSpec.targetDuration,
          fps,
          width,
          height,
          durationInFrames,
          sceneCount: scenes.length,
        },
      });

      // Step 7: Update SceneSpec status
      await storage.updateSceneSpec(sceneSpec.id, {
        status: 'rendering',
        mediaAssetId: assetId,
      });

      // Step 8: Dispatch to render worker
      console.log('[Remotion Renderer] Step 7: Dispatching to render worker...');
      const jobId = uuidv4();
      
      const dispatchResult = await dispatchRenderJob({
        jobId,
        sceneSpecId: sceneSpec.id,
        code: cleanedCode,
        config: {
          fps,
          width,
          height,
          durationInFrames,
        },
        status: 'queued',
      });

      if (!dispatchResult.success) {
        // Update status to failed
        await storage.updateMediaAsset(assetId, {
          status: 'failed',
          errorMessage: dispatchResult.error,
        });
        await storage.updateSceneSpec(sceneSpec.id, {
          status: 'failed',
          errorMessage: dispatchResult.error,
        });
        
        return {
          success: false,
          error: dispatchResult.error || 'Failed to dispatch render job',
        };
      }

      // Step 9: Start background polling
      console.log('[Remotion Renderer] Step 8: Starting background polling...');
      pollForCompletion(jobId, assetId, sceneSpec.id);

      return {
        success: true,
        mediaAssetId: assetId,
        metadata: {
          provider: 'remotion',
          duration: sceneSpec.targetDuration,
          jobId,
        },
      };

    } catch (error: any) {
      console.error('[Remotion Renderer] Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error in Remotion renderer',
      };
    }
  },
};

// ==================== CLAUDE CODE GENERATION ====================

/**
 * Generate Remotion code using Claude API
 */
async function generateRemotionCode(input: RemotionPromptInput): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) {
    console.error('[Remotion Renderer] ANTHROPIC_API_KEY not configured');
    return null;
  }

  const userPrompt = remotionPrompts.buildUserPrompt(input);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        system: remotionPrompts.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        timeout: 120000, // 2 minute timeout for code generation
      }
    );

    const content = response.data.content;
    if (content && content.length > 0 && content[0].type === 'text') {
      console.log('[Remotion Renderer] Claude generated code, length:', content[0].text.length);
      return content[0].text;
    }

    console.error('[Remotion Renderer] Unexpected Claude response format');
    return null;

  } catch (error: any) {
    console.error('[Remotion Renderer] Claude API error:', error.response?.data || error.message);
    return null;
  }
}

// ==================== RENDER WORKER DISPATCH ====================

/**
 * Dispatch a render job to the Docker render worker
 */
async function dispatchRenderJob(job: RenderJob): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Remotion Renderer] Dispatching job to:', RENDER_WORKER_URL);
    
    const response = await axios.post(
      `${RENDER_WORKER_URL}/render`,
      {
        jobId: job.jobId,
        code: job.code,
        outputConfig: job.config,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout for dispatch
      }
    );

    if (response.data.success || response.data.jobId) {
      console.log('[Remotion Renderer] Job dispatched successfully:', job.jobId);
      return { success: true };
    }

    return {
      success: false,
      error: response.data.error || 'Unknown dispatch error',
    };

  } catch (error: any) {
    // If render worker is unavailable, this is expected during development
    if (error.code === 'ECONNREFUSED') {
      console.warn('[Remotion Renderer] Render worker not available at', RENDER_WORKER_URL);
      console.warn('[Remotion Renderer] Job queued but cannot be executed until worker is running');
      // Return success to allow the flow to continue in dev mode
      // The job will be picked up when the worker starts
      return {
        success: false,
        error: 'Render worker not available. Please start the render-worker service.',
      };
    }

    console.error('[Remotion Renderer] Dispatch error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to dispatch render job',
    };
  }
}

// ==================== POLLING ====================

/**
 * Poll the render worker for job completion
 */
async function pollForCompletion(
  jobId: string,
  mediaAssetId: string,
  sceneSpecId: string
): Promise<void> {
  let attempts = 0;

  const poll = async () => {
    attempts++;
    console.log(`[Remotion Renderer] Polling job ${jobId}, attempt ${attempts}/${MAX_POLL_ATTEMPTS}`);

    try {
      const response = await axios.get(`${RENDER_WORKER_URL}/status/${jobId}`, {
        timeout: 10000,
      });

      const { status, resultUrl, error } = response.data;

      if (status === 'complete' && resultUrl) {
        // Success - update MediaAsset and SceneSpec
        console.log('[Remotion Renderer] Job completed successfully:', resultUrl);
        
        await storage.updateMediaAsset(mediaAssetId, {
          status: 'ready',
          resultUrl,
          completedAt: new Date(),
        });

        await storage.updateSceneSpec(sceneSpecId, {
          status: 'rendered',
          renderedAt: new Date(),
        });

        return; // Done polling
      }

      if (status === 'failed') {
        // Failure - update status
        console.error('[Remotion Renderer] Job failed:', error);
        
        await storage.updateMediaAsset(mediaAssetId, {
          status: 'failed',
          errorMessage: error || 'Render failed',
        });

        await storage.updateSceneSpec(sceneSpecId, {
          status: 'failed',
          errorMessage: error || 'Render failed',
        });

        return; // Done polling
      }

      // Still rendering - continue polling
      if (attempts < MAX_POLL_ATTEMPTS) {
        setTimeout(poll, POLL_INTERVAL_MS);
      } else {
        // Timeout - mark as failed
        console.error('[Remotion Renderer] Job timed out after', MAX_POLL_ATTEMPTS, 'attempts');
        
        await storage.updateMediaAsset(mediaAssetId, {
          status: 'failed',
          errorMessage: 'Render timed out',
        });

        await storage.updateSceneSpec(sceneSpecId, {
          status: 'failed',
          errorMessage: 'Render timed out',
        });
      }

    } catch (error: any) {
      console.error('[Remotion Renderer] Poll error:', error.message);
      
      // Network error - retry if attempts remaining
      if (attempts < MAX_POLL_ATTEMPTS) {
        setTimeout(poll, POLL_INTERVAL_MS);
      } else {
        await storage.updateMediaAsset(mediaAssetId, {
          status: 'failed',
          errorMessage: 'Failed to check render status',
        });

        await storage.updateSceneSpec(sceneSpecId, {
          status: 'failed',
          errorMessage: 'Failed to check render status',
        });
      }
    }
  };

  // Start polling after initial delay
  setTimeout(poll, POLL_INTERVAL_MS);
}

// ==================== EXPORTS ====================

export default remotionRenderer;
