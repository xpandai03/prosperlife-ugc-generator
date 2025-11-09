/**
 * UGC Chain Orchestration Service (Phase 5)
 *
 * Manages the NanoBanana + Veo3 chained workflow (Mode A):
 * 1. Generate NanoBanana image
 * 2. Poll until image is ready
 * 3. Analyze image with OpenAI Vision
 * 4. Generate Veo3 video prompt based on analysis
 * 5. Generate Veo3 video with analyzed image as reference
 * 6. Poll until video is ready
 *
 * Handles chain_metadata updates at each step for progress tracking
 */

import { kieService } from './kie';
import { openaiService } from './openai';
import { storage } from '../storage';
import { generatePrompt, injectImageAnalysis, type PromptVariables } from '../prompts/ugc-presets';
import { GenerationMode } from '../prompts/ugc-presets';
import { sendVideoCompleteNotification } from './resendService';

/**
 * Chain workflow state stored in chain_metadata
 */
export interface ChainMetadata {
  step: 'generating_image' | 'analyzing_image' | 'generating_video' | 'completed' | 'error' | 'fallback_to_veo3';
  nanoImageUrl?: string;
  nanoTaskId?: string;
  imageAnalysis?: string;
  videoPrompt?: string;
  videoTaskId?: string;
  timestamps: {
    imageStarted?: string;
    imageCompleted?: string;
    analysisCompleted?: string;
    videoStarted?: string;
    videoCompleted?: string;
  };
  error?: string;
  imageRetryCount?: number; // Track retry attempts for ready-but-no-URLs edge case
  fallbackReason?: string; // Reason for fallback to Veo3
}

/**
 * Parameters for starting a chain workflow
 */
export interface StartChainParams {
  assetId: string;
  promptVariables: PromptVariables;
  productImageUrl?: string;
}

/**
 * UGC Chain Orchestration Service
 */
export const ugcChainService = {
  /**
   * Step 1: Start NanoBanana image generation
   */
  async startImageGeneration(params: StartChainParams): Promise<void> {
    const { assetId, promptVariables } = params;

    console.log(`[UGC Chain] Step 1: Starting NanoBanana image generation for asset ${assetId}`);

    try {
      // Generate image prompt using preset template
      const imagePrompt = generatePrompt(GenerationMode.MODE_A, promptVariables);

      console.log(`[UGC Chain] Image prompt generated (${imagePrompt.length} chars)`);

      // Submit to KIE NanoBanana (Flux Kontext)
      const result = await kieService.generateImage({
        prompt: imagePrompt,
        provider: 'flux-kontext',
        aspectRatio: '16:9',
        model: 'flux-kontext-pro',
        referenceImageUrl: params.productImageUrl,
      });

      // Update asset with task ID and chain metadata
      const chainMetadata: ChainMetadata = {
        step: 'generating_image',
        nanoTaskId: result.taskId,
        timestamps: {
          imageStarted: new Date().toISOString(),
        },
      };

      await storage.updateMediaAsset(assetId, {
        taskId: result.taskId,
        chainMetadata,
        metadata: {
          imagePrompt,
          promptVariables,
        },
      });

      console.log(`[UGC Chain] ✅ Step 1 complete: NanoBanana task ${result.taskId} started`);
      console.log(`[UGC Chain] Asset ${assetId} now in state: step=generating_image, taskId=${result.taskId}`);
    } catch (error: any) {
      console.error(`[UGC Chain] ❌ Step 1 failed:`, error);
      await this.handleChainError(assetId, 'generating_image', error.message);
      throw error;
    }
  },

  /**
   * Step 2: Check if image is ready, if so move to Step 3
   * Includes retry logic for edge case: status=ready but resultUrls=[]
   * Falls back to Veo3-only mode if NanoBanana fails after retries
   */
  async checkImageStatus(assetId: string): Promise<boolean> {
    const asset = await storage.getMediaAsset(assetId);
    if (!asset || !asset.taskId) {
      throw new Error(`Asset ${assetId} not found or missing taskId`);
    }

    const chainMetadata = asset.chainMetadata as ChainMetadata;
    if (!chainMetadata || chainMetadata.step !== 'generating_image') {
      return false; // Not in image generation step
    }

    console.log(`[UGC Chain] Step 2: Checking NanoBanana image status for taskId=${asset.taskId}`);

    try {
      const status = await kieService.checkStatus(asset.taskId, 'kie-flux-kontext');
      console.log(`[UGC Chain] Step 2: KIE status response: status=${status.status}, resultUrls count=${status.resultUrls?.length || 0}`);

      // Handle failed status
      if (status.status === 'failed') {
        console.error(`[UGC Chain] ❌ Step 2: Image generation failed: ${status.errorMessage}`);
        console.log(`[UGC Chain] ⚠️ Falling back to Veo3-only mode (Mode B)`);

        // Fallback to Veo3 instead of complete failure
        const productImageUrl = asset.metadata && typeof asset.metadata === 'object' && 'productImageUrl' in asset.metadata
          ? (asset.metadata as any).productImageUrl
          : undefined;
        await this.fallbackToVeo3(assetId, 'Image generation failed', productImageUrl);
        return true; // Continue chain with fallback
      }

      // Handle success case with URLs
      if (status.status === 'ready' && status.resultUrls && status.resultUrls.length > 0) {
        const imageUrl = status.resultUrls[0];
        console.log(`[UGC Chain] ✅ Step 2 complete: NanoBanana image ready`);
        console.log(`[UGC Chain] Image URL: ${imageUrl.substring(0, 80)}...`);

        // Reset retry count on success
        chainMetadata.imageRetryCount = 0;
        await storage.updateMediaAsset(assetId, { chainMetadata });

        // Move to Step 3: Analyze image
        await this.analyzeImage(assetId, imageUrl);
        return true;
      }

      // ⚠️ EDGE CASE: status=ready but resultUrls=[] or undefined
      if (status.status === 'ready' && (!status.resultUrls || status.resultUrls.length === 0)) {
        const retryCount = chainMetadata.imageRetryCount || 0;
        const MAX_RETRIES = 5;

        console.log(`[Flux-Kontext Retry] Attempt ${retryCount + 1}/${MAX_RETRIES} -- Status is ready but no URLs yet...`);

        if (retryCount < MAX_RETRIES) {
          // Increment retry count and wait for next poll
          chainMetadata.imageRetryCount = retryCount + 1;
          await storage.updateMediaAsset(assetId, { chainMetadata });

          console.log(`[Flux-Kontext Retry] Will retry after next polling interval`);
          return false; // Continue polling
        } else {
          // Max retries exceeded - fall back to Veo3
          console.error(`[Flux-Kontext ⚠️] Image missing after ${MAX_RETRIES} retries -- falling back to Veo3 direct mode`);

          const productImageUrl = asset.metadata && typeof asset.metadata === 'object' && 'productImageUrl' in asset.metadata
            ? (asset.metadata as any).productImageUrl
            : undefined;
          await this.fallbackToVeo3(
            assetId,
            `Image fetch failed after ${MAX_RETRIES} retries (status=ready but no URLs)`,
            productImageUrl
          );
          return true; // Continue chain with fallback
        }
      }

      // Still processing
      console.log(`[UGC Chain] Step 2: Image still processing, will retry...`);
      return false;
    } catch (error: any) {
      console.error(`[UGC Chain] ❌ Step 2 error:`, error);

      // On error, try to fallback to Veo3 instead of complete failure
      console.log(`[UGC Chain] ⚠️ Error occurred, attempting fallback to Veo3...`);
      try {
        const asset = await storage.getMediaAsset(assetId);
        const productImageUrl = asset?.metadata && typeof asset.metadata === 'object' && 'productImageUrl' in asset.metadata
          ? (asset.metadata as any).productImageUrl
          : undefined;
        await this.fallbackToVeo3(assetId, `Image generation error: ${error.message}`, productImageUrl);
        return true; // Continue chain with fallback
      } catch (fallbackError) {
        console.error(`[UGC Chain] ❌ Fallback also failed:`, fallbackError);
        await this.handleChainError(assetId, 'generating_image', error.message);
        return false;
      }
    }
  },

  /**
   * Step 3: Analyze image with OpenAI Vision and generate video prompt
   */
  async analyzeImage(assetId: string, imageUrl: string): Promise<void> {
    console.log(`[UGC Chain] Step 3: Starting image analysis with OpenAI Vision`);
    console.log(`[UGC Chain] Asset ID: ${assetId}, Image URL: ${imageUrl.substring(0, 80)}...`);

    try {
      const asset = await storage.getMediaAsset(assetId);
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`);
      }

      const chainMetadata = asset.chainMetadata as ChainMetadata;
      const promptVariables = (asset.metadata && typeof asset.metadata === 'object' && 'promptVariables' in asset.metadata
        ? asset.metadata.promptVariables
        : undefined) as PromptVariables | undefined;

      if (!promptVariables) {
        throw new Error('Missing promptVariables in asset metadata');
      }

      // Update chain metadata: analyzing image
      chainMetadata.step = 'analyzing_image';
      chainMetadata.nanoImageUrl = imageUrl;
      chainMetadata.timestamps.imageCompleted = new Date().toISOString();

      await storage.updateMediaAsset(assetId, {
        chainMetadata,
      });
      console.log(`[UGC Chain] Step 3: Updated asset state to analyzing_image`);

      // Analyze image with Vision API
      const analysisPrompt = `Analyze this UGC-style product photo in detail. Describe:
- Who is in the photo (age, gender, appearance, clothing)
- What they're holding (the product) and how
- The setting/environment (location, lighting, background)
- The overall mood and authenticity of the shot
- Any visible product branding or labels

Be specific and detailed - this description will be used to create a video based on this image.`;

      console.log(`[UGC Chain] Step 3: Calling OpenAI Vision API...`);
      const imageAnalysis = await openaiService.analyzeImage({
        imageUrl,
        prompt: analysisPrompt,
        maxTokens: 500,
      });

      console.log(`[UGC Chain] ✅ Step 3: Image analysis complete (${imageAnalysis.length} chars)`);
      console.log(`[UGC Chain] Analysis preview: ${imageAnalysis.substring(0, 100)}...`);

      // Generate Veo3 video prompt using chained template
      const videoPrompt = generatePrompt(
        GenerationMode.MODE_A,
        promptVariables,
        imageAnalysis // Pass image analysis for chained prompt
      );

      console.log(`[UGC Chain] Video prompt generated (${videoPrompt.length} chars)`);

      // Update chain metadata
      chainMetadata.imageAnalysis = imageAnalysis;
      chainMetadata.videoPrompt = videoPrompt;
      chainMetadata.timestamps.analysisCompleted = new Date().toISOString();

      await storage.updateMediaAsset(assetId, {
        chainMetadata,
        metadata: {
          ...(asset.metadata || {}),
          imageAnalysis,
          videoPrompt,
        },
      });

      console.log(`[UGC Chain] ✅ Step 3 complete: Image analyzed, proceeding to Step 4 (video generation)`);

      // Move to Step 4: Generate video
      await this.startVideoGeneration(assetId, videoPrompt, imageUrl);
    } catch (error: any) {
      console.error(`[UGC Chain] ❌ Step 3 failed:`, error);
      await this.handleChainError(assetId, 'analyzing_image', error.message);
      throw error;
    }
  },

  /**
   * Step 4: Start Veo3 video generation with analyzed image as reference
   * Image URL is optional - if not provided, generates text-only video
   */
  async startVideoGeneration(assetId: string, videoPrompt: string, imageUrl?: string): Promise<void> {
    console.log(`[UGC Chain] Step 4: Starting Veo3 video generation`);
    console.log(`[UGC Chain] Asset ID: ${assetId}`);
    console.log(`[UGC Chain] Video prompt length: ${videoPrompt.length} chars`);
    console.log(`[UGC Chain] Reference image: ${imageUrl ? imageUrl.substring(0, 80) + '...' : 'None (text-only mode)'}`);

    try {
      // Submit to KIE Veo3 with image as reference (if available)
      console.log(`[UGC Chain] Step 4: Submitting to KIE Veo3 API...`);
      const result = await kieService.generateVideo({
        prompt: videoPrompt,
        model: 'veo3',
        aspectRatio: '16:9',
        imageUrls: imageUrl ? [imageUrl] : undefined, // Use image if available, otherwise text-only
      });

      const asset = await storage.getMediaAsset(assetId);
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`);
      }

      const chainMetadata = asset.chainMetadata as ChainMetadata;

      // Update chain metadata: generating video
      chainMetadata.step = 'generating_video';
      chainMetadata.videoTaskId = result.taskId;
      chainMetadata.timestamps.videoStarted = new Date().toISOString();

      await storage.updateMediaAsset(assetId, {
        taskId: result.taskId, // Update to video task ID
        provider: 'kie-veo3',   // Change provider to Veo3
        type: 'video',          // Change type to video
        chainMetadata,
      });

      console.log(`[UGC Chain] ✅ Step 4 complete: Veo3 task ${result.taskId} started`);
      console.log(`[UGC Chain] Asset ${assetId} now in state: step=generating_video, videoTaskId=${result.taskId}`);
    } catch (error: any) {
      console.error(`[UGC Chain] ❌ Step 4 failed:`, error);
      await this.handleChainError(assetId, 'generating_video', error.message);
      throw error;
    }
  },

  /**
   * Step 5: Check if video is ready
   */
  async checkVideoStatus(assetId: string): Promise<boolean> {
    const asset = await storage.getMediaAsset(assetId);
    if (!asset || !asset.taskId) {
      throw new Error(`Asset ${assetId} not found or missing taskId`);
    }

    const chainMetadata = asset.chainMetadata as ChainMetadata;
    if (!chainMetadata || chainMetadata.step !== 'generating_video') {
      return false; // Not in video generation step
    }

    console.log(`[UGC Chain] Step 5: Checking Veo3 video status for taskId=${asset.taskId}`);

    try {
      const status = await kieService.checkStatus(asset.taskId, 'kie-veo3');
      console.log(`[UGC Chain] Step 5: KIE status response: status=${status.status}, resultUrls count=${status.resultUrls?.length || 0}`);

      if (status.status === 'failed') {
        console.error(`[UGC Chain] ❌ Step 5: Video generation failed: ${status.errorMessage}`);
        await this.handleChainError(assetId, 'generating_video', status.errorMessage || 'Video generation failed');
        return false;
      }

      if (status.status === 'ready' && status.resultUrls && status.resultUrls.length > 0) {
        const videoUrl = status.resultUrls[0];
        console.log(`[UGC Chain] ✅ Step 5 complete: Veo3 video ready!`);
        console.log(`[UGC Chain] Video URL: ${videoUrl.substring(0, 80)}...`);

        // Mark chain as completed
        chainMetadata.step = 'completed';
        chainMetadata.timestamps.videoCompleted = new Date().toISOString();

        await storage.updateMediaAsset(assetId, {
          status: 'ready',
          resultUrl: videoUrl,
          resultUrls: status.resultUrls,
          completedAt: new Date(), // Date object, not string
          chainMetadata,
          apiResponse: { veo3: status },
        });

        console.log(`[UGC Chain] 🎉 CHAIN WORKFLOW COMPLETE for asset ${assetId}!`);
        console.log(`[UGC Chain] Total chain time: ${this.getChainDuration(chainMetadata)}`);

        // Send email notification (Phase 8)
        await sendVideoCompleteNotification({
          userId: asset.userId,
          assetId,
          status: 'ready',
          assetType: 'ugc-ad',
          videoUrl,
          generationMode: asset.generationMode || undefined,
        }).catch((error) => {
          // Don't fail the workflow if email fails
          console.error('[UGC Chain] Email notification failed:', error);
        });

        return true;
      }

      // Still processing
      console.log(`[UGC Chain] Step 5: Video still processing, will retry...`);
      return false;
    } catch (error: any) {
      console.error(`[UGC Chain] ❌ Step 5 error:`, error);
      await this.handleChainError(assetId, 'generating_video', error.message);
      return false;
    }
  },

  /**
   * Fallback to Veo3-only mode (Mode B) when NanoBanana fails
   * Generates video directly with Veo3 using product image (if available) or text-only
   */
  async fallbackToVeo3(assetId: string, reason: string, productImageUrl?: string): Promise<void> {
    console.log(`[UGC Chain Fallback] Starting Veo3 fallback for asset ${assetId}`);
    console.log(`[UGC Chain Fallback] Reason: ${reason}`);
    console.log(`[UGC Chain Fallback] Product image available: ${!!productImageUrl}`);

    try {
      const asset = await storage.getMediaAsset(assetId);
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`);
      }

      const chainMetadata = asset.chainMetadata as ChainMetadata;
      const promptVariables = (asset.metadata && typeof asset.metadata === 'object' && 'promptVariables' in asset.metadata
        ? asset.metadata.promptVariables
        : undefined) as PromptVariables | undefined;

      if (!promptVariables) {
        throw new Error('Missing promptVariables in asset metadata');
      }

      // Update chain metadata: mark as fallback
      chainMetadata.step = 'fallback_to_veo3';
      chainMetadata.fallbackReason = reason;
      if (!chainMetadata.timestamps.imageCompleted) {
        chainMetadata.timestamps.imageCompleted = new Date().toISOString(); // Mark image phase done
      }

      await storage.updateMediaAsset(assetId, {
        chainMetadata,
      });

      console.log(`[UGC Chain Fallback] Updated chain state to fallback_to_veo3`);

      // Generate Veo3 video prompt using Mode B (text-only mode)
      const videoPrompt = generatePrompt(
        GenerationMode.MODE_B, // Use Mode B for Veo3-only fallback
        promptVariables
      );

      console.log(`[UGC Chain Fallback] Video prompt generated (${videoPrompt.length} chars)`);
      console.log(`[UGC Chain Fallback] Prompt preview: ${videoPrompt.substring(0, 100)}...`);

      // Update chain metadata with video prompt
      chainMetadata.videoPrompt = videoPrompt;
      chainMetadata.imageAnalysis = 'N/A (fallback mode - no image analysis)';
      chainMetadata.timestamps.analysisCompleted = new Date().toISOString();

      await storage.updateMediaAsset(assetId, {
        chainMetadata,
        metadata: {
          ...(asset.metadata || {}),
          videoPrompt,
          fallbackMode: true,
        },
      });

      console.log(`[UGC Chain Fallback] ✅ Proceeding to Veo3 video generation (Mode B)`);

      // Start Veo3 video generation
      // If product image exists, use it as reference; otherwise text-only
      await this.startVideoGeneration(assetId, videoPrompt, productImageUrl);

    } catch (error: any) {
      console.error(`[UGC Chain Fallback] ❌ Fallback failed:`, error);
      await this.handleChainError(assetId, 'fallback_to_veo3', error.message);
      throw error;
    }
  },

  /**
   * Handle chain errors by updating asset status and chain metadata
   */
  async handleChainError(assetId: string, step: ChainMetadata['step'], errorMessage: string): Promise<void> {
    console.error(`[UGC Chain] Error in ${step} for asset ${assetId}:`, errorMessage);

    try {
      const asset = await storage.getMediaAsset(assetId);
      if (!asset) return;

      const chainMetadata = (asset.chainMetadata as ChainMetadata) || {
        step: 'error',
        timestamps: {},
      };

      chainMetadata.step = 'error';
      chainMetadata.error = errorMessage;

      await storage.updateMediaAsset(assetId, {
        status: 'error',
        errorMessage: `Chain failed at ${step}: ${errorMessage}`,
        chainMetadata,
      });

      // Send email notification for error (Phase 8)
      await sendVideoCompleteNotification({
        userId: asset.userId,
        assetId,
        status: 'error',
        assetType: 'ugc-ad',
        errorMessage: `Chain failed at ${step}: ${errorMessage}`,
      }).catch((emailError) => {
        console.error('[UGC Chain] Email notification failed:', emailError);
      });
    } catch (updateError) {
      console.error(`[UGC Chain] Failed to update error state:`, updateError);
    }
  },

  /**
   * Helper: Calculate chain duration from timestamps
   */
  getChainDuration(chainMetadata: ChainMetadata): string {
    const start = chainMetadata.timestamps?.imageStarted;
    const end = chainMetadata.timestamps?.videoCompleted;

    if (!start || !end) return 'Unknown';

    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  },
};
