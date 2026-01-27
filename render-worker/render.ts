/**
 * Remotion Render Logic (Jan 2026)
 * 
 * Handles the actual Remotion rendering process:
 * 1. Bundle the composition code
 * 2. Render to MP4 using Remotion renderer
 * 
 * This module is isolated to handle the Remotion-specific logic.
 */

import path from 'path';
import fs from 'fs/promises';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

// ==================== TYPES ====================

export interface RenderConfig {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  codec?: 'h264' | 'h265';
  crf?: number; // Quality (0-51, lower = better)
}

export interface RenderJob {
  jobId: string;
  code: string;
  config: RenderConfig;
  status: 'queued' | 'rendering' | 'complete' | 'failed';
  progress?: number;
  resultUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface RenderResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  duration?: number; // Render time in ms
}

// ==================== RENDER FUNCTION ====================

/**
 * Render a Remotion composition to video
 * 
 * @param codePath - Path to the composition TypeScript file
 * @param outputPath - Path for the output MP4 file
 * @param config - Render configuration
 * @param onProgress - Progress callback (0-100)
 */
export async function renderVideo(
  codePath: string,
  outputPath: string,
  config: RenderConfig,
  onProgress?: (progress: number) => void
): Promise<RenderResult> {
  const startTime = Date.now();
  console.log(`[Render] Starting render: ${codePath} -> ${outputPath}`);
  console.log(`[Render] Config:`, config);

  try {
    // Step 1: Create a wrapper entry point that properly exports the composition
    const entryPath = await createEntryPoint(codePath);
    console.log(`[Render] Entry point created: ${entryPath}`);

    // Step 2: Bundle the composition
    console.log(`[Render] Bundling composition...`);
    const bundled = await bundle({
      entryPoint: entryPath,
      onProgress: (progress) => {
        const bundleProgress = Math.round(progress * 20); // 0-20%
        onProgress?.(bundleProgress);
      },
    });
    console.log(`[Render] Bundle complete: ${bundled}`);

    // Step 3: Select the composition
    console.log(`[Render] Selecting composition...`);
    const composition = await selectComposition({
      serveUrl: bundled,
      id: 'ContentEngineVideo',
      inputProps: {},
    });
    console.log(`[Render] Composition selected:`, composition.id);

    // Step 4: Render the video
    console.log(`[Render] Rendering video...`);
    await renderMedia({
      composition: {
        ...composition,
        // Override with our config
        fps: config.fps,
        width: config.width,
        height: config.height,
        durationInFrames: config.durationInFrames,
      },
      serveUrl: bundled,
      codec: config.codec === 'h265' ? 'h265' : 'h264',
      outputLocation: outputPath,
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
      crf: config.crf || 23,
      onProgress: ({ progress }) => {
        const renderProgress = 20 + Math.round(progress * 80); // 20-100%
        onProgress?.(renderProgress);
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[Render] Render complete in ${duration}ms: ${outputPath}`);

    // Verify output exists
    await fs.access(outputPath);

    return {
      success: true,
      outputPath,
      duration,
    };

  } catch (error: any) {
    console.error(`[Render] Render failed:`, error);
    return {
      success: false,
      error: error.message || 'Unknown render error',
    };
  }
}

/**
 * Create an entry point file that properly exports the composition
 * 
 * Remotion requires a specific structure with registerRoot() and Composition
 */
async function createEntryPoint(compositionPath: string): Promise<string> {
  const dir = path.dirname(compositionPath);
  const entryPath = path.join(dir, 'entry.tsx');

  // Create entry point that wraps the user's composition
  const entryCode = `
import { registerRoot } from 'remotion';
import { Composition } from 'remotion';
import React from 'react';

// Import the generated composition
import MyComposition from './Composition';

// Root component that registers the composition
const Root: React.FC = () => {
  return (
    <Composition
      id="ContentEngineVideo"
      component={MyComposition}
      durationInFrames={1800}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};

registerRoot(Root);
`;

  await fs.writeFile(entryPath, entryCode);
  return entryPath;
}

// ==================== EXPORTS ====================

export default renderVideo;
