/**
 * Remotion Render Worker - Express Server (Jan 2026)
 * 
 * A Docker-based service that receives Remotion code, renders video, and uploads result.
 * Runs independently from the main Streamline app.
 * 
 * API:
 * POST /render - Queue a render job
 * GET /status/:jobId - Check job status
 * GET /health - Health check
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { renderVideo, type RenderJob, type RenderConfig } from './render';

// ==================== CONFIGURATION ====================

const PORT = process.env.PORT || 3001;
const JOBS_DIR = process.env.JOBS_DIR || '/app/jobs';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/app/output';

// KIE Upload for result storage (same as main app)
const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_UPLOAD_URL = process.env.KIE_UPLOAD_URL || 'https://kieai.redpandaai.co';

// In-memory job store (production would use Redis)
const jobs = new Map<string, RenderJob>();

// ==================== EXPRESS APP ====================

const app = express();
app.use(express.json({ limit: '10mb' })); // Large limit for code bundles

// ==================== ROUTES ====================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    jobs: {
      total: jobs.size,
      queued: [...jobs.values()].filter(j => j.status === 'queued').length,
      rendering: [...jobs.values()].filter(j => j.status === 'rendering').length,
      complete: [...jobs.values()].filter(j => j.status === 'complete').length,
      failed: [...jobs.values()].filter(j => j.status === 'failed').length,
    },
  });
});

/**
 * Queue a render job
 * 
 * POST /render
 * Body: { jobId?, code, outputConfig: { fps, width, height, durationInFrames } }
 */
app.post('/render', async (req, res) => {
  try {
    const { jobId: providedJobId, code, outputConfig } = req.body;

    // Validate request
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid code' });
    }
    if (!outputConfig || !outputConfig.fps || !outputConfig.durationInFrames) {
      return res.status(400).json({ error: 'Missing or invalid outputConfig' });
    }

    const jobId = providedJobId || uuidv4();
    const config: RenderConfig = {
      fps: outputConfig.fps || 30,
      width: outputConfig.width || 1080,
      height: outputConfig.height || 1920,
      durationInFrames: outputConfig.durationInFrames,
      codec: outputConfig.codec || 'h264',
      crf: outputConfig.crf || 23,
    };

    // Create job record
    const job: RenderJob = {
      jobId,
      code,
      config,
      status: 'queued',
      createdAt: new Date(),
    };

    jobs.set(jobId, job);
    console.log(`[Worker] Job ${jobId} queued. Duration: ${config.durationInFrames} frames`);

    // Start rendering in background
    processJob(jobId);

    res.status(202).json({
      success: true,
      jobId,
      status: 'queued',
      message: 'Job queued for rendering',
    });

  } catch (error: any) {
    console.error('[Worker] Error queuing job:', error);
    res.status(500).json({ error: error.message || 'Failed to queue job' });
  }
});

/**
 * Get job status
 * 
 * GET /status/:jobId
 */
app.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    resultUrl: job.resultUrl,
    error: job.error,
    progress: job.progress,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
});

/**
 * List all jobs (for debugging)
 */
app.get('/jobs', (req, res) => {
  const jobList = [...jobs.values()].map(job => ({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    error: job.error,
  }));

  res.json({ jobs: jobList });
});

/**
 * Cancel a job
 * 
 * DELETE /jobs/:jobId
 */
app.delete('/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status === 'rendering') {
    // Cannot cancel rendering job (would need process killing)
    return res.status(400).json({ error: 'Cannot cancel job that is currently rendering' });
  }

  jobs.delete(jobId);
  res.json({ success: true, message: 'Job deleted' });
});

// ==================== JOB PROCESSING ====================

/**
 * Process a render job
 */
async function processJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  // Update status to rendering
  job.status = 'rendering';
  job.progress = 0;
  console.log(`[Worker] Starting render for job ${jobId}`);

  try {
    // Create job directory
    const jobDir = path.join(JOBS_DIR, jobId);
    await fs.mkdir(jobDir, { recursive: true });

    // Write code to file
    const codePath = path.join(jobDir, 'Composition.tsx');
    await fs.writeFile(codePath, job.code);
    console.log(`[Worker] Code written to ${codePath}`);

    // Render the video
    const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
    
    const result = await renderVideo(codePath, outputPath, job.config, (progress) => {
      job.progress = progress;
    });

    if (!result.success) {
      throw new Error(result.error || 'Render failed');
    }

    // Upload to KIE storage
    console.log(`[Worker] Uploading result to storage...`);
    const uploadedUrl = await uploadToStorage(outputPath, `${jobId}.mp4`);

    // Update job status
    job.status = 'complete';
    job.resultUrl = uploadedUrl;
    job.completedAt = new Date();
    job.progress = 100;
    console.log(`[Worker] Job ${jobId} completed: ${uploadedUrl}`);

    // Cleanup local files
    await fs.rm(jobDir, { recursive: true, force: true });
    await fs.unlink(outputPath).catch(() => {}); // Ignore if already deleted

  } catch (error: any) {
    console.error(`[Worker] Job ${jobId} failed:`, error);
    job.status = 'failed';
    job.error = error.message || 'Unknown error';
    job.completedAt = new Date();
  }
}

/**
 * Upload rendered video to KIE storage
 */
async function uploadToStorage(filePath: string, filename: string): Promise<string> {
  if (!KIE_API_KEY) {
    throw new Error('KIE_API_KEY not configured');
  }

  const FormData = (await import('form-data')).default;
  const axios = (await import('axios')).default;

  const fileBuffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', fileBuffer, {
    filename,
    contentType: 'video/mp4',
  });
  form.append('uploadPath', 'content-engine/renders');

  const uploadUrl = `${KIE_UPLOAD_URL}/api/file-stream-upload`;
  console.log(`[Worker] Uploading to ${uploadUrl}`);

  const response = await axios.post(uploadUrl, form, {
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      ...form.getHeaders(),
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300000, // 5 minute timeout for large files
  });

  if (response.data.code !== 200 && !response.data.success) {
    throw new Error(`Upload failed: ${response.data.msg || 'Unknown error'}`);
  }

  const uploadedUrl = response.data.data?.url || response.data.url;
  if (!uploadedUrl) {
    throw new Error('No URL returned from upload');
  }

  return uploadedUrl;
}

// ==================== STARTUP ====================

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

// Start server
ensureDirectories().then(() => {
  app.listen(PORT, () => {
    console.log(`[Worker] Remotion Render Worker running on port ${PORT}`);
    console.log(`[Worker] Jobs directory: ${JOBS_DIR}`);
    console.log(`[Worker] Output directory: ${OUTPUT_DIR}`);
    console.log(`[Worker] KIE Upload: ${KIE_UPLOAD_URL}`);
  });
}).catch(error => {
  console.error('[Worker] Failed to start:', error);
  process.exit(1);
});
