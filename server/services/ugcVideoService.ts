/**
 * UGC Video Service (Jan 2026)
 *
 * Orchestrates the full UGC video generation pipeline:
 * 1. Script generation (AI)
 * 2. TTS audio generation (ElevenLabs)
 * 3. Asset preparation (stock footage fallbacks)
 * 4. Remotion composition assembly
 * 5. Render worker invocation
 * 6. Upload to CDN
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { storage } from '../storage';
import { ugcScriptGenerator, type ProductBrief } from './ugcScriptGenerator';
import {
  ugcAudioPreparer,
  type UGCAudioAssets,
  type SceneDurationsFromAudio,
} from './ugcAudioPreparer';
import { kieService } from './kie';

// ==================== TYPES ====================

export interface GenerateUGCVideoParams {
  userId: string;
  productName: string;
  productFeatures: string;
  productImages: string[];      // 2-4 URLs (minimum 2 required)
  hookText?: string;            // Optional, AI-generated if missing
  ctaText?: string;             // Optional, default "Shop Now"
  includeAvatar?: boolean;      // Default false
  avatarPrompt?: string;        // For KIE generation
  logoUrl?: string;
}

export interface UGCGenerationResult {
  success: boolean;
  assetId?: string;
  error?: string;
}

export interface RenderJobStatus {
  jobId: string;
  status: 'queued' | 'rendering' | 'complete' | 'failed';
  progress?: number;
  resultUrl?: string;
  error?: string;
}

// ==================== CONFIG ====================

const RENDER_WORKER_URL = process.env.RENDER_WORKER_URL || 'http://localhost:3001';
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

// ==================== SERVICE ====================

/**
 * Generate a UGC video from product information
 * Returns immediately with assetId for polling
 */
export async function generateUGCVideo(
  params: GenerateUGCVideoParams
): Promise<UGCGenerationResult> {
  const {
    userId,
    productName,
    productFeatures,
    productImages,
    hookText,
    ctaText = 'Shop Now',
    includeAvatar = false,
    avatarPrompt,
    logoUrl,
  } = params;

  // Validate inputs
  if (productImages.length < 2) {
    return {
      success: false,
      error: 'Minimum 2 product images required',
    };
  }

  if (productImages.length > 4) {
    return {
      success: false,
      error: 'Maximum 4 product images allowed',
    };
  }

  const assetId = uuidv4();

  try {
    // Create MediaAsset record immediately for tracking
    await storage.createMediaAsset({
      id: assetId,
      userId,
      provider: 'remotion-ugc',
      type: 'video',
      prompt: `UGC Video: ${productName}`,
      status: 'processing',
      metadata: {
        productName,
        productFeatures,
        productImages,
        includeAvatar,
        startedAt: new Date().toISOString(),
      },
    });

    console.log(`[UGC Video] Created asset ${assetId} for user ${userId}`);

    // Start async processing
    processUGCVideo(assetId, params).catch((error) => {
      console.error(`[UGC Video] Processing failed for ${assetId}:`, error);
      storage.updateMediaAsset(assetId, {
        status: 'error',
        errorMessage: error.message || 'Unknown processing error',
      });
    });

    return {
      success: true,
      assetId,
    };
  } catch (error: any) {
    console.error('[UGC Video] Failed to create asset:', error);
    return {
      success: false,
      error: error.message || 'Failed to initiate video generation',
    };
  }
}

/**
 * Process UGC video generation (async)
 */
async function processUGCVideo(
  assetId: string,
  params: GenerateUGCVideoParams
): Promise<void> {
  const {
    productName,
    productFeatures,
    productImages,
    hookText,
    ctaText = 'Shop Now',
    includeAvatar = false,
    avatarPrompt,
    logoUrl,
  } = params;

  console.log(`[UGC Video] Starting processing for ${assetId}`);

  // Step 1: Generate scripts (AI or fallback)
  console.log(`[UGC Video] Step 1: Generating scripts...`);
  const brief: ProductBrief = {
    productName,
    productFeatures,
  };

  let scripts;
  const scriptResult = await ugcScriptGenerator.generateSceneScripts(brief);
  if (scriptResult.success && scriptResult.scripts) {
    scripts = scriptResult.scripts;
  } else {
    console.log(`[UGC Video] AI script generation failed, using fallback`);
    scripts = ugcScriptGenerator.getDefaultScripts(productName, productFeatures);
  }

  // Override hook if provided
  const finalHookText = hookText || scripts.hook;

  await storage.updateMediaAsset(assetId, {
    metadata: {
      step: 'scripts_generated',
      scripts,
    },
  });

  // Step 2: Generate TTS audio
  console.log(`[UGC Video] Step 2: Generating TTS audio...`);
  const audioResult = await ugcAudioPreparer.prepareAudio({
    showcaseNarration: scripts.showcaseNarration,
    featuresNarration: scripts.featuresNarration,
    ctaNarration: scripts.ctaNarration,
  });

  if (audioResult.errors.length > 0) {
    console.log(`[UGC Video] TTS warnings: ${audioResult.errors.join(', ')}`);
  }

  // Step 3: Calculate scene durations from audio
  console.log(`[UGC Video] Step 3: Calculating scene durations...`);
  let sceneDurations = ugcAudioPreparer.calculateSceneDurations(
    audioResult.audioAssets,
    includeAvatar ? 6 : 0  // 6 seconds for avatar if included
  );

  // Redistribute time if no avatar
  if (!includeAvatar) {
    sceneDurations = ugcAudioPreparer.redistributeWithoutAvatar(sceneDurations);
  }

  const totalDuration = ugcAudioPreparer.getTotalDurationSeconds(sceneDurations);
  console.log(`[UGC Video] Total duration: ${totalDuration}s`);

  await storage.updateMediaAsset(assetId, {
    metadata: {
      step: 'audio_prepared',
      sceneDurations,
      totalDuration,
      audioUrls: {
        showcase: audioResult.audioAssets.showcase?.url,
        features: audioResult.audioAssets.features?.url,
        cta: audioResult.audioAssets.cta?.url,
      },
    },
  });

  // Step 4: Generate composition code
  console.log(`[UGC Video] Step 4: Generating composition code...`);
  const compositionCode = generateCompositionCode({
    productName,
    productImages,
    hookText: finalHookText,
    tagline: productName,
    features: scripts.featuresList,
    ctaText,
    logoUrl,
    audioUrls: {
      showcase: audioResult.audioAssets.showcase?.url,
      features: audioResult.audioAssets.features?.url,
      cta: audioResult.audioAssets.cta?.url,
    },
    sceneDurations,
  });

  // Step 5: Submit to render worker
  console.log(`[UGC Video] Step 5: Submitting to render worker...`);
  const totalFrames =
    sceneDurations.hook +
    sceneDurations.showcase +
    sceneDurations.features +
    sceneDurations.avatar +
    sceneDurations.cta;

  const renderResult = await submitRenderJob(assetId, compositionCode, {
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    durationInFrames: totalFrames,
  });

  if (!renderResult.success) {
    throw new Error(renderResult.error || 'Render job submission failed');
  }

  await storage.updateMediaAsset(assetId, {
    metadata: {
      step: 'rendering',
      renderJobId: renderResult.jobId,
    },
  });

  // Step 6: Poll for completion
  console.log(`[UGC Video] Step 6: Waiting for render completion...`);
  const finalResult = await waitForRenderCompletion(renderResult.jobId!);

  if (finalResult.status === 'complete' && finalResult.resultUrl) {
    console.log(`[UGC Video] Render complete: ${finalResult.resultUrl}`);
    await storage.updateMediaAsset(assetId, {
      status: 'ready',
      resultUrl: finalResult.resultUrl,
      completedAt: new Date(),
      metadata: {
        step: 'complete',
        totalDuration,
        sceneDurations,
        hasAvatar: includeAvatar,
      },
    });
  } else {
    throw new Error(finalResult.error || 'Render failed');
  }
}

/**
 * Generate Remotion composition code for render worker
 */
function generateCompositionCode(params: {
  productName: string;
  productImages: string[];
  hookText: string;
  tagline: string;
  features: string[];
  ctaText: string;
  logoUrl?: string;
  audioUrls: {
    showcase?: string;
    features?: string;
    cta?: string;
  };
  sceneDurations: SceneDurationsFromAudio;
}): string {
  const {
    productName,
    productImages,
    hookText,
    tagline,
    features,
    ctaText,
    logoUrl,
    audioUrls,
    sceneDurations,
  } = params;

  // Escape strings for JavaScript
  const escapeString = (s: string) => s.replace(/'/g, "\\'").replace(/"/g, '\\"');

  return `
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  Img,
  Audio,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';

// ==================== HOOK SCENE ====================
const HookScene = ({ productImage, hookText, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imageScale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    easing: Easing.out(Easing.ease),
  });

  const textProgress = spring({
    frame: frame - 8,
    fps,
    config: { damping: 15, stiffness: 100, mass: 0.8 },
  });

  const textScale = interpolate(textProgress, [0, 1], [0.8, 1]);
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textY = interpolate(textProgress, [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        <Img src={productImage} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: \`scale(\${imageScale})\` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.6) 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 40px' }}>
        <div style={{ opacity: textOpacity, transform: \`translateY(\${textY}px) scale(\${textScale})\`, textAlign: 'center' }}>
          <h1 style={{ color: 'white', fontSize: 64, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, textShadow: '0 4px 30px rgba(0,0,0,0.9)', lineHeight: 1.2, margin: 0 }}>
            {hookText}
          </h1>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ==================== SHOWCASE SCENE ====================
const ShowcaseScene = ({ productImages, tagline, audioUrl, durationInFrames }) => {
  const frame = useCurrentFrame();
  const imagesCount = productImages.length;
  const framesPerImage = Math.floor(durationInFrames / imagesCount);
  const currentImageIndex = Math.min(Math.floor(frame / framesPerImage), imagesCount - 1);
  const frameInCurrentImage = frame - currentImageIndex * framesPerImage;

  const kenBurnsProgress = interpolate(frameInCurrentImage, [0, framesPerImage], [0, 1], { extrapolateRight: 'clamp' });
  const isZoomIn = currentImageIndex % 2 === 0;
  const scale = isZoomIn
    ? interpolate(kenBurnsProgress, [0, 1], [1, 1.15], { easing: Easing.inOut(Easing.ease) })
    : interpolate(kenBurnsProgress, [0, 1], [1.15, 1], { easing: Easing.inOut(Easing.ease) });

  const transitionDuration = Math.min(15, framesPerImage / 4);
  const imageOpacity = interpolate(frameInCurrentImage, [0, transitionDuration, framesPerImage - transitionDuration, framesPerImage], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {audioUrl && <Audio src={audioUrl} />}
      {productImages.map((imageUrl, index) => {
        if (index !== currentImageIndex && index !== currentImageIndex - 1) return null;
        const opacity = index === currentImageIndex ? imageOpacity : interpolate(frameInCurrentImage, [0, transitionDuration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <AbsoluteFill key={index} style={{ opacity, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
            <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: index === currentImageIndex ? \`scale(\${scale})\` : 'scale(1)' }} />
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.4) 100%)' }} />
      {tagline && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 180 }}>
          <p style={{ color: 'white', fontSize: 48, fontWeight: 600, textShadow: '0 2px 20px rgba(0,0,0,0.8)', lineHeight: 1.3, margin: 0, textAlign: 'center', padding: '0 40px' }}>
            {tagline}
          </p>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ==================== FEATURES SCENE ====================
const FeaturesScene = ({ features, productImage, audioUrl, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgScale = interpolate(frame, [0, durationInFrames], [1.05, 1], { easing: Easing.out(Easing.ease) });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {audioUrl && <Audio src={audioUrl} />}
      {productImage && (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img src={productImage} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: \`scale(\${bgScale})\`, filter: 'blur(15px) brightness(0.4)' }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: productImage ? 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%)' : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }} />
      <AbsoluteFill style={{ padding: '120px 48px', justifyContent: 'center' }}>
        <h2 style={{ color: 'white', fontSize: 44, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 4, margin: '0 0 48px 0', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
          Why You'll Love It
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {features.map((feature, index) => {
            const staggerDelay = (durationInFrames / 5) * index;
            const progress = spring({ frame: frame - staggerDelay, fps, config: { damping: 20, stiffness: 80, mass: 0.8 } });
            const translateX = interpolate(progress, [0, 1], [-50, 0]);
            const opacity = interpolate(progress, [0, 1], [0, 1]);
            return (
              <div key={index} style={{ opacity, transform: \`translateX(\${translateX}px)\`, display: 'flex', alignItems: 'center', gap: 24, padding: '24px 32px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, marginBottom: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 32, flexShrink: 0 }}>✓</div>
                <p style={{ color: 'white', fontSize: 36, fontWeight: 600, margin: 0, lineHeight: 1.3, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{feature}</p>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ==================== CTA SCENE ====================
const CTAScene = ({ productImage, ctaText, logoUrl, audioUrl, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imageProgress = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const imageScale = interpolate(imageProgress, [0, 1], [1.1, 1]);
  const imageOpacity = interpolate(imageProgress, [0, 1], [0, 1]);

  const ctaProgress = spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 100 } });
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.8, 1]);
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);
  const ctaY = interpolate(ctaProgress, [0, 1], [30, 0]);

  const pulseFrame = Math.max(0, frame - 45);
  const buttonPulse = 1 + Math.sin((pulseFrame / fps) * 4) * 0.03;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {audioUrl && <Audio src={audioUrl} />}
      <AbsoluteFill style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 70%, #1a1a2e 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 180 }}>
        <div style={{ opacity: imageOpacity, transform: \`scale(\${imageScale})\`, width: 400, height: 400, borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '4px solid rgba(255,255,255,0.2)' }}>
          <Img src={productImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 250 }}>
        <div style={{ opacity: ctaOpacity, transform: \`translateY(\${ctaY}px) scale(\${ctaScale})\`, textAlign: 'center' }}>
          <div style={{ backgroundColor: 'white', color: '#1a1a2e', fontSize: 40, fontWeight: 700, padding: '24px 64px', borderRadius: 50, transform: \`scale(\${buttonPulse})\`, boxShadow: '0 10px 40px rgba(255,255,255,0.3)', display: 'inline-block' }}>
            {ctaText}
          </div>
        </div>
      </AbsoluteFill>
      {logoUrl && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100 }}>
          <Img src={logoUrl} style={{ height: 60, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ==================== MAIN COMPOSITION ====================
const UGCComposition = () => {
  const productImages = ${JSON.stringify(productImages)};
  const hookText = '${escapeString(hookText)}';
  const tagline = '${escapeString(tagline)}';
  const features = ${JSON.stringify(features)};
  const ctaText = '${escapeString(ctaText)}';
  const logoUrl = ${logoUrl ? `'${escapeString(logoUrl)}'` : 'null'};
  const audioUrls = {
    showcase: ${audioUrls.showcase ? `'${audioUrls.showcase}'` : 'null'},
    features: ${audioUrls.features ? `'${audioUrls.features}'` : 'null'},
    cta: ${audioUrls.cta ? `'${audioUrls.cta}'` : 'null'},
  };
  const sceneDurations = ${JSON.stringify(sceneDurations)};

  const hookStart = 0;
  const showcaseStart = hookStart + sceneDurations.hook;
  const featuresStart = showcaseStart + sceneDurations.showcase;
  const ctaStart = featuresStart + sceneDurations.features + sceneDurations.avatar;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Sequence from={hookStart} durationInFrames={sceneDurations.hook}>
        <HookScene productImage={productImages[0]} hookText={hookText} durationInFrames={sceneDurations.hook} />
      </Sequence>
      <Sequence from={showcaseStart} durationInFrames={sceneDurations.showcase}>
        <ShowcaseScene productImages={productImages} tagline={tagline} audioUrl={audioUrls.showcase} durationInFrames={sceneDurations.showcase} />
      </Sequence>
      <Sequence from={featuresStart} durationInFrames={sceneDurations.features}>
        <FeaturesScene features={features} productImage={productImages[0]} audioUrl={audioUrls.features} durationInFrames={sceneDurations.features} />
      </Sequence>
      <Sequence from={ctaStart} durationInFrames={sceneDurations.cta}>
        <CTAScene productImage={productImages[0]} ctaText={ctaText} logoUrl={logoUrl} audioUrl={audioUrls.cta} durationInFrames={sceneDurations.cta} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default UGCComposition;
`;
}

/**
 * Submit render job to render worker
 */
async function submitRenderJob(
  assetId: string,
  code: string,
  config: { fps: number; width: number; height: number; durationInFrames: number }
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const response = await axios.post(
      `${RENDER_WORKER_URL}/render`,
      {
        jobId: assetId,
        code,
        outputConfig: config,
      },
      {
        timeout: 30000, // 30s timeout for submission
      }
    );

    if (response.data.success) {
      return {
        success: true,
        jobId: response.data.jobId,
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Render submission failed',
      };
    }
  } catch (error: any) {
    console.error('[UGC Video] Render worker error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to connect to render worker',
    };
  }
}

/**
 * Poll render worker for job completion
 */
async function waitForRenderCompletion(
  jobId: string,
  maxWaitMs: number = 300000 // 5 minutes
): Promise<RenderJobStatus> {
  const startTime = Date.now();
  const pollIntervalMs = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await axios.get(`${RENDER_WORKER_URL}/status/${jobId}`);
      const status: RenderJobStatus = response.data;

      if (status.status === 'complete' || status.status === 'failed') {
        return status;
      }

      console.log(`[UGC Video] Render progress: ${status.progress || 0}%`);
    } catch (error: any) {
      console.error('[UGC Video] Status check error:', error.message);
    }

    await sleep(pollIntervalMs);
  }

  return {
    jobId,
    status: 'failed',
    error: 'Render timeout exceeded',
  };
}

/**
 * Get status of a UGC video generation
 */
export async function getUGCVideoStatus(assetId: string): Promise<{
  status: string;
  resultUrl?: string;
  error?: string;
  metadata?: any;
}> {
  const asset = await storage.getMediaAsset(assetId);
  if (!asset) {
    return { status: 'not_found' };
  }

  return {
    status: asset.status,
    resultUrl: asset.resultUrl || undefined,
    error: asset.errorMessage || undefined,
    metadata: asset.metadata,
  };
}

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== EXPORTS ====================

export const ugcVideoService = {
  generateUGCVideo,
  getUGCVideoStatus,
};

export default ugcVideoService;
