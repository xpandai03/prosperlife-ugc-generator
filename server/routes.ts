import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import multer from "multer";
import { storage } from "./storage";
import { klapService } from "./services/klap";
import { kieService } from "./services/kie";
import { lateService } from "./services/late";
import { stripeService } from "./services/stripe";
import { postToSocialSchema } from "./validators/social";
import { generateMediaSchema, validateProviderType } from "./validators/mediaGen";
import { generateMedia, checkMediaStatus } from "./services/mediaGen";
import { GenerationMode, generatePrompt, formatICPForPrompt, formatSceneForPrompt, type PromptVariables } from "./prompts/ugc-presets";
import { ugcChainService } from "./services/ugcChain";
import { supabaseAdmin } from "./services/supabaseAuth";
import { sendVideoCompleteNotification } from "./services/resendService";
import { requireAuth } from "./middleware/auth";
import { checkCredits, deductCreditsFromRequest } from "./middleware/checkCredits";
import * as creditService from "./services/creditService";
// Legacy usage limits - kept for reference during migration, will be removed in Phase 5
import { checkVideoLimit, checkPostLimit, checkMediaGenerationLimit, incrementVideoUsage, incrementPostUsage, incrementMediaGenerationUsage, getCurrentUsage, FREE_VIDEO_LIMIT, FREE_POST_LIMIT, FREE_MEDIA_GENERATION_LIMIT } from "./services/usageLimits";
import { db } from "./db";
import { stripeEvents, users, socialPosts } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import type Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";

// Admin email check helper (used by /api/user and requireAdmin middleware)
const isAdminEmail = (email: string | null | undefined): boolean => {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return email ? adminEmails.includes(email.toLowerCase()) : false;
};

// Validation schemas
const createVideoSchema = z.object({
  sourceVideoUrl: z.string().url(),
  autoExport: z.boolean().optional().default(false),
});

const createBulkVideoSchema = z.object({
  urls: z.array(z.string().url()).min(1, "At least one URL is required"),
  autoExport: z.boolean().optional().default(false),
});

const exportVideoSchema = z.object({
  projectId: z.string(),
});

const processVideoAdvancedSchema = z.object({
  url: z.string().url(),
  email: z.string().email().optional(),
  targetClipCount: z.number().int().min(1).max(10),
  minimumDuration: z.number().int().min(1).max(180),
});

// Phase 4: UGC Preset Generation Schema
// Duration limits per mode - PROVIDER HARD LIMITS:
//
// Mode A (nanobana+veo3): 8s max
//   - Always uses NanoBanana image → Veo3 image-to-video
//   - Provider hard-caps image-to-video at ~8s
//
// Mode B (veo3-only): 20s max
//   - With product image + duration ≤8s: Uses image-to-video (image in video)
//   - With product image + duration >8s: Auto-switches to text-to-video (image NOT used)
//   - Without product image: Uses text-to-video (supports up to 20s)
//
// Mode C (sora2): 15s max
//   - Uses n_frames field: only "10" (10s) or "15" (15s) supported
//   - "25" is only for sora-2-pro-storyboard (not used here)
//
const MODE_DURATION_LIMITS: Record<string, number> = {
  'nanobana+veo3': 8,  // Provider hard-cap for image-to-video
  'veo3-only': 20,     // Text-to-video supports 20s; image-to-video auto-switches at 8s
  'sora2': 15,         // KIE sora-2-* models: n_frames "10" or "15" only
};

const generateUGCPresetSchema = z.object({
  productName: z.string().min(1).max(100),
  productFeatures: z.string().min(10).max(2000), // Increased from 500 to 2000 for detailed product descriptions
  customerPersona: z.string(),
  videoSetting: z.string(),
  generationMode: z.enum(["nanobana+veo3", "veo3-only", "sora2"]),
  // Duration in seconds - FormData sends strings, so preprocess to number
  duration: z.preprocess(
    (val) => {
      if (typeof val === 'string') return parseInt(val, 10);
      if (typeof val === 'number') return val;
      return 10; // Default
    },
    z.number().int().min(6).max(30)
  ),
  productImageUrl: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : val,
    z.string().url().optional()
  ),
}).refine((data) => {
  // Validate duration against mode-specific limits
  const maxDuration = MODE_DURATION_LIMITS[data.generationMode] || 20;
  return data.duration <= maxDuration;
}, (data) => {
  // Mode-specific error messages for better UX
  const maxDuration = MODE_DURATION_LIMITS[data.generationMode] || 20;
  let message: string;

  if (data.generationMode === 'nanobana+veo3') {
    message = `Mode A (Premium) supports up to 8 seconds. Selected: ${data.duration}s. Use Mode B (Fast) for longer videos.`;
  } else if (data.generationMode === 'sora2') {
    message = `Mode C (Budget) supports up to 15 seconds. Selected: ${data.duration}s. Use Mode B (Fast) for longer videos.`;
  } else {
    message = `Duration (${data.duration}s) exceeds maximum (${maxDuration}s) for selected mode`;
  }

  return { message, path: ["duration"] };
});

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/auth/health - Health check for Supabase authentication configuration (public endpoint)
  app.get("/api/auth/health", async (req, res) => {
    try {
      // Check server-side Supabase configuration
      const serverEnvCheck = {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      };

      // Check if Supabase client can connect
      let serverClientConnected = false;
      try {
        const { data, error } = await supabaseAdmin.from('users').select('count');
        serverClientConnected = !error;
      } catch (e) {
        serverClientConnected = false;
      }

      // Client env vars are set at build time (VITE_ prefix)
      // We can only verify they're present in the compiled bundle
      const clientEnvCheck = {
        note: "Client env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are set at build time",
        buildTimeVarsRequired: true
      };

      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        server: {
          environmentVariables: serverEnvCheck,
          clientConnected: serverClientConnected,
          allConfigured: serverEnvCheck.SUPABASE_URL && serverEnvCheck.SUPABASE_SERVICE_ROLE_KEY && serverClientConnected
        },
        client: clientEnvCheck,
        message: serverEnvCheck.SUPABASE_URL && serverEnvCheck.SUPABASE_SERVICE_ROLE_KEY && serverClientConnected
          ? "Supabase auth is fully configured and connected"
          : "Supabase auth configuration incomplete - check environment variables"
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        error: error.message,
        message: "Failed to check Supabase auth health"
      });
    }
  });

  // POST /api/auth/webhook - Handle Supabase auth webhooks (public endpoint)
  app.post("/api/auth/webhook", async (req, res) => {
    try {
      const event = req.body;

      console.log('[Auth Webhook] Received event:', event.type);

      // Handle user.created event
      if (event.type === 'INSERT' && event.table === 'users') {
        const { id: userId, email, full_name } = event.record;

        // Validate required fields
        if (!userId || !email) {
          console.error('[Auth Webhook] Missing required fields:', { userId, email });
          return res.status(400).json({ error: 'Missing userId or email' });
        }

        // Derive name from full_name or email
        const name = full_name || email.split('@')[0];

        console.log('[Auth Webhook] New user created:', { userId, email, name });

        // ✅ CRITICAL FIX: Create/update user in Neon database (for Resend notifications)
        try {
          const existingNeonUser = await storage.getUser(userId);

          if (!existingNeonUser) {
            // Create new user in Neon DB
            await storage.createUser({
              id: userId,
              email: email,
              fullName: name,
              subscriptionStatus: 'free',
            });
            console.log('[Auth Webhook] ✅ User created in Neon DB:', { userId, email });
          } else {
            // Update existing user with email/name (in case they were missing)
            await storage.updateUser(userId, {
              email: email,
              fullName: name,
            });
            console.log('[Auth Webhook] ✅ User updated in Neon DB:', { userId, email });
          }
        } catch (neonError: any) {
          console.error('[Auth Webhook] Failed to sync user to Neon DB:', neonError);
          // Continue - don't fail the webhook
        }

        // Debug: Check if lateService and createProfile exist
        console.log('[Auth Webhook] lateService type:', typeof lateService);
        console.log('[Auth Webhook] createProfile type:', typeof lateService?.createProfile);

        // Check if profile already exists (idempotency)
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('late_profile_id')
          .eq('id', userId)
          .single();

        if (existingUser?.late_profile_id) {
          console.log('[Auth Webhook] Profile already exists:', existingUser.late_profile_id);
          return res.json({ received: true, message: 'Profile already exists' });
        }

        // Create Late.dev profile for the new user
        try {
          const { profileId } = await lateService.createProfile(email, name);

          console.log('[Auth Webhook] Late.dev profile created:', profileId);

          // Update user record with Late profile ID
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ late_profile_id: profileId })
            .eq('id', userId);

          if (updateError) {
            console.error('[Auth Webhook] Failed to update user with profile ID:', updateError);
          } else {
            console.log('[Auth Webhook] User updated with Late profile ID');
          }
        } catch (profileError: any) {
          console.error('[Auth Webhook] Failed to create Late profile:', profileError);
          // Don't fail the webhook - profile can be created later
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('[Auth Webhook] Error processing webhook:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/kie/sora2/callback - Handle KIE Sora2 completion callbacks (PUBLIC endpoint)
  // This must be BEFORE requireAuth middleware since KIE doesn't send auth tokens
  app.post('/api/kie/sora2/callback', async (req, res) => {
    try {
      const callbackData = req.body;

      console.log('[Sora2 Callback] Received callback:', JSON.stringify(callbackData, null, 2));

      // Extract data from callback
      const { code, data, msg } = callbackData;

      if (!data || !data.taskId) {
        console.error('[Sora2 Callback] Invalid callback data - missing taskId');
        return res.status(400).json({ error: 'Invalid callback data' });
      }

      const { taskId, state, resultJson, failCode, failMsg } = data;

      // Find the asset by taskId
      const asset = await storage.getMediaAssetByTaskId(taskId);
      if (!asset) {
        console.error(`[Sora2 Callback] No asset found for taskId: ${taskId}`);
        return res.status(404).json({ error: 'Asset not found' });
      }
      console.log(`[Sora2 Callback] Found asset ${asset.id} for taskId ${taskId}, state: ${state}`);

      // Handle success
      if (state === 'success' && resultJson) {
        let resultUrls: string[] = [];

        // Parse resultJson (it's a JSON string according to docs)
        try {
          const parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
          resultUrls = parsed.resultUrls || [];
        } catch (parseError) {
          console.error('[Sora2 Callback] Failed to parse resultJson:', parseError);
        }

        if (resultUrls.length > 0) {
          const videoUrl = resultUrls[0];

          console.log(`[Sora2 Callback] ✅ Video generated successfully: ${videoUrl.substring(0, 80)}...`);

          await storage.updateMediaAsset(asset.id, {
            status: 'ready',
            resultUrl: videoUrl,
            resultUrls: resultUrls,
            completedAt: new Date(),
            apiResponse: callbackData,
          });

          console.log(`[Sora2 Callback] Asset ${asset.id} updated to ready`);

          // Send email notification (Phase 8)
          await sendVideoCompleteNotification({
            userId: asset.userId,
            assetId: asset.id,
            status: 'ready',
            assetType: 'ugc-ad',
            videoUrl,
            generationMode: 'sora2',
          }).catch((error) => {
            console.error('[Sora2 Callback] Email notification failed:', error);
          });
        } else {
          console.error('[Sora2 Callback] Success but no resultUrls found');
          await storage.updateMediaAsset(asset.id, {
            status: 'error',
            errorMessage: 'Video generated but no URL returned',
            apiResponse: callbackData,
          });
        }
      }
      // Handle failure
      else if (state === 'fail') {
        const errorMessage = failMsg || 'Sora2 generation failed';

        console.error(`[Sora2 Callback] ❌ Generation failed: ${errorMessage} (code: ${failCode})`);

        await storage.updateMediaAsset(asset.id, {
          status: 'error',
          errorMessage: `Sora2 Error (${failCode}): ${errorMessage}`,
          apiResponse: callbackData,
        });

        console.log(`[Sora2 Callback] Asset ${asset.id} updated to error`);

        // Send email notification for error (Phase 8)
        await sendVideoCompleteNotification({
          userId: asset.userId,
          assetId: asset.id,
          status: 'error',
          assetType: 'ugc-ad',
          errorMessage: `Sora2 Error (${failCode}): ${errorMessage}`,
        }).catch((error) => {
          console.error('[Sora2 Callback] Email notification failed:', error);
        });
      }
      // Handle unknown state
      else {
        console.warn(`[Sora2 Callback] Unknown state: ${state}, keeping as processing`);
      }

      // Acknowledge receipt
      res.json({ success: true, message: 'Callback processed' });

    } catch (error: any) {
      console.error('[Sora2 Callback] Error processing callback:', error);
      res.status(500).json({ error: 'Failed to process callback', details: error.message });
    }
  });

  // GET /api/brand - Public endpoint for fetching app name (no auth required)
  // MUST be defined BEFORE the global auth middleware below
  app.get('/api/brand', async (req, res) => {
    try {
      const settings = await storage.getBrandSettings();
      res.json({
        appName: settings?.appName || 'Streamline',
      });
    } catch (error: any) {
      console.error('[Brand] Error fetching brand settings:', error);
      res.json({ appName: 'Streamline' }); // Fallback on error
    }
  });

  // Apply authentication middleware to all /api/* routes (except routes defined above)
  app.use("/api/*", requireAuth);

  // POST /api/videos - Create video processing task and start processing
  app.post("/api/videos", checkCredits('klap_video_input'), async (req, res) => {
    try {
      const { sourceVideoUrl, autoExport } = createVideoSchema.parse(req.body);

      // Create initial task record
      const klapResponse =
        await klapService.createVideoToShortsTask(sourceVideoUrl);

      const task = await storage.createTask({
        id: klapResponse.id,
        userId: req.userId!,
        sourceVideoUrl,
        status: klapResponse.status,
        outputId: klapResponse.output_id || null,
        errorMessage: null,
        klapResponse: klapResponse as any,
        autoExportRequested: autoExport ? "true" : "false",
        autoExportStatus: autoExport ? "pending" : null,
      });

      // Deduct credits after successful Klap API call (Phase 9: XPAND Credits)
      await deductCreditsFromRequest(req, { taskId: task.id, type: 'klap_video_input' });

      // Start background processing
      processVideoTask(task.id).catch(console.error);

      res.json({ taskId: task.id, status: task.status, autoExport });
    } catch (error: any) {
      console.error("Error creating video task:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to create video task" });
    }
  });

  // POST /api/videos/bulk - Create multiple video processing tasks
  app.post("/api/videos/bulk", async (req, res) => {
    try {
      const { urls, autoExport } = createBulkVideoSchema.parse(req.body);

      // Phase 9: Check total credits upfront for all videos
      const costPerVideo = await creditService.getFeatureCost('klap_video_input');
      const totalCost = costPerVideo * urls.length;
      const balance = await creditService.getBalance(req.userId!);

      if (balance < totalCost) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `This bulk operation requires ${totalCost} credits (${costPerVideo} × ${urls.length} videos), but you only have ${balance}`,
          required: totalCost,
          balance,
          videoCount: urls.length,
          costPerVideo,
        });
      }

      const results = await Promise.allSettled(
        urls.map(async (url) => {
          try {
            const klapResponse = await klapService.createVideoToShortsTask(url);

            const task = await storage.createTask({
              id: klapResponse.id,
              userId: req.userId!,
              sourceVideoUrl: url,
              status: klapResponse.status,
              outputId: klapResponse.output_id || null,
              errorMessage: null,
              klapResponse: klapResponse as any,
              autoExportRequested: autoExport ? "true" : "false",
              autoExportStatus: autoExport ? "pending" : null,
            });

            // Deduct credits after successful Klap API call (Phase 9: XPAND Credits)
            await creditService.deductCredits(req.userId!, 'klap_video_input', { taskId: task.id, type: 'bulk_video' });
            console.log('[Credits] Deducted for bulk video:', url);

            // Start background processing
            processVideoTask(task.id).catch(console.error);

            return { taskId: task.id, status: task.status, url, success: true };
          } catch (error: any) {
            console.error(`Error creating task for ${url}:`, error);
            return {
              url,
              success: false,
              error: error.message || "Failed to create task",
            };
          }
        }),
      );

      const tasks = [];
      const failures = [];
      let successCount = 0;
      let failureCount = 0;

      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            tasks.push(result.value);
            successCount++;
          } else {
            failures.push(result.value);
            failureCount++;
          }
        } else {
          failureCount++;
        }
      }

      res.json({
        tasks,
        failures,
        successCount,
        failureCount,
        total: urls.length,
      });
    } catch (error: any) {
      console.error("Error creating bulk video tasks:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to create bulk video tasks" });
    }
  });

  // GET /api/user - Get current user data including subscription status
  app.get("/api/user", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Return user data needed for billing UI
      res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        subscriptionStatus: user.subscriptionStatus || 'free',
        stripeCustomerId: user.stripeCustomerId,
        subscriptionEndsAt: user.subscriptionEndsAt,
        createdAt: user.createdAt,
        isAdmin: isAdminEmail(user.email),
      });
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: error.message || "Failed to fetch user data" });
    }
  });

  // POST /api/admin/upgrade-to-pro - Temporary endpoint to upgrade current user to Pro
  app.post("/api/admin/upgrade-to-pro", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const updatedUser = await storage.updateUser(userId, {
        subscriptionStatus: 'pro',
        subscriptionEndsAt: null,
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        success: true,
        message: "Upgraded to Pro successfully",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          subscriptionStatus: updatedUser.subscriptionStatus,
        }
      });
    } catch (error: any) {
      console.error("Error upgrading user:", error);
      res.status(500).json({ error: error.message || "Failed to upgrade user" });
    }
  });

  // POST /api/admin/upgrade-email-to-pro - Upgrade user by email to Pro
  app.post("/api/admin/upgrade-email-to-pro", requireAuth, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Find user by email
      const allUsers = await storage.getUsers();
      const targetUser = allUsers.find(u => u.email === email);

      if (!targetUser) {
        return res.status(404).json({ error: "User not found with email: " + email });
      }

      const updatedUser = await storage.updateUser(targetUser.id, {
        subscriptionStatus: 'pro',
        subscriptionEndsAt: null,
      });

      res.json({
        success: true,
        message: `Upgraded ${email} to Pro successfully`,
        user: {
          id: updatedUser!.id,
          email: updatedUser!.email,
          subscriptionStatus: updatedUser!.subscriptionStatus,
        }
      });
    } catch (error: any) {
      console.error("Error upgrading user by email:", error);
      res.status(500).json({ error: error.message || "Failed to upgrade user" });
    }
  });

  // POST /api/process-video-advanced - Process video with custom parameters
  app.post("/api/process-video-advanced", requireAuth, checkCredits('klap_video_input'), async (req, res) => {
    try {
      const { url, email, targetClipCount, minimumDuration } = processVideoAdvancedSchema.parse(req.body);

      console.log('Process video advanced called with:', {
        url,
        email,
        targetClipCount,
        minimumDuration
      });

      // Step 1: Create task via Klap API with custom parameters
      const klapTask = await klapService.createVideoToShortsTask(url, {
        targetClipCount,
        minimumDuration,
      });

      // Step 2: Save task in database
      const task = await storage.createTask({
        id: klapTask.id,
        userId: req.userId!,
        sourceVideoUrl: url,
        email: email || null,
        status: klapTask.status,
        outputId: null,
        errorMessage: null,
        klapResponse: klapTask as any,
        autoExportRequested: "true",
        autoExportStatus: "pending",
      });

      // Deduct credits after successful Klap API call (Phase 9: XPAND Credits)
      await deductCreditsFromRequest(req, { taskId: task.id, type: 'process_video_advanced' });
      console.log('[Credits] Deducted for process-video-advanced');

      // Step 3: Start background workflow (follows exact script)
      processCompleteWorkflow(task.id).catch(console.error);

      res.json({ taskId: task.id, status: "processing" });
    } catch (error: any) {
      console.error("Error starting video processing:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to start processing" });
    }
  });

  // GET /api/videos - Get all video tasks for the user
  app.get("/api/videos", async (req, res) => {
    try {
      const tasks = await storage.getAllTasks(req.userId!);
      res.json(tasks);
    } catch (error: any) {
      console.error("Error fetching videos:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch videos" });
    }
  });

  // GET /api/usage - Get current usage stats for the user (Phase 6: Usage tracking)
  app.get("/api/usage", async (req, res) => {
    try {
      const usage = await getCurrentUsage(req.userId!);

      console.log('[Usage API] Fetched usage for user:', req.userId, usage);

      res.json(usage);
    } catch (error: any) {
      console.error("[Usage API] Error fetching usage:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Phase 7: Social Account Connection (OAuth) =====

  /**
   * GET /api/social/connect/:platform
   * Generate Late.dev OAuth URL for connecting a social account
   */
  app.get("/api/social/connect/:platform", async (req, res) => {
    try {
      const { platform } = req.params;
      const userId = req.userId!;

      console.log('[OAuth] Connect request:', { userId, platform });

      // Validate platform - use exact keys from Late.dev docs
      // Note: googlebusiness (not google_business) is the correct key
      const supportedPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'threads', 'pinterest', 'reddit', 'bluesky', 'googlebusiness'];

      // Map frontend platform keys to Late.dev API keys
      const platformKeyMap: Record<string, string> = {
        'google_business': 'googlebusiness', // Frontend uses google_business, Late uses googlebusiness
      };

      // Get the Late.dev platform key (map if needed)
      const latePlatform = platformKeyMap[platform.toLowerCase()] || platform.toLowerCase();

      if (!supportedPlatforms.includes(latePlatform)) {
        return res.status(400).json({
          error: 'Unsupported platform',
          message: `Platform "${platform}" is not supported. Supported platforms: ${supportedPlatforms.join(', ')}`,
        });
      }

      console.log('[OAuth] Platform mapping:', { originalPlatform: platform, latePlatform });

      // Get user's Late.dev profile ID
      let user = await storage.getUser(userId);

      console.log('[OAuth] User record:', {
        userId,
        email: user?.email,
        hasLateProfileId: !!user?.lateProfileId,
        lateProfileId: user?.lateProfileId,
      });

      // Create Late.dev profile if user doesn't have one
      if (!user?.lateProfileId) {
        console.log('[OAuth] User has no Late profile, creating one:', userId, 'email:', user?.email);

        try {
          // Create Late.dev profile
          const { profileId } = await lateService.createProfile(
            user!.email,
            user!.fullName || user!.email.split('@')[0]
          );

          // Update user with profile ID
          console.log('[OAuth] Saving lateProfileId to user:', { userId, profileId });
          const updateResult = await storage.updateUser(userId, { lateProfileId: profileId });
          console.log('[OAuth] updateUser result:', updateResult ? 'success' : 'failed', 'lateProfileId:', updateResult?.lateProfileId);

          // Reload user
          user = await storage.getUser(userId);

          console.log('[OAuth] Late profile created and saved:', {
            userId,
            profileId,
            savedProfileId: user?.lateProfileId,
            saveSuccess: user?.lateProfileId === profileId,
          });
        } catch (profileError: any) {
          console.log('[OAuth] Profile creation error details:', {
            message: profileError.message,
            name: profileError.name,
            stack: profileError.stack?.substring(0, 300),
          });

          // Handle "profile already exists" error - fetch existing profile
          // Check for various error messages that indicate duplicate profile
          const errorMsg = (profileError.message || '').toLowerCase();
          const isAlreadyExistsError = errorMsg.includes('already exists') ||
                                       errorMsg.includes('duplicate') ||
                                       errorMsg.includes('name is already') ||
                                       errorMsg.includes('profile limit');

          if (isAlreadyExistsError) {
            console.log('[OAuth] Profile already exists, fetching existing profile:', user!.email);

            try {
              // Fetch all profiles and find the one matching this user's email or name
              const profilesData = await lateService.getProfiles();

              // Try to match by email first
              let existingProfile = profilesData.profiles?.find(
                (p: any) => p.email === user!.email
              );

              // If email matching fails (email field might not be returned by API),
              // try matching by name (which is what Late.dev uses for uniqueness)
              if (!existingProfile) {
                const expectedName = user!.fullName || user!.email.split('@')[0];
                console.log('[OAuth] Email match failed, trying name match:', expectedName);

                existingProfile = profilesData.profiles?.find(
                  (p: any) => p.name === expectedName
                );
              }

              if (existingProfile) {
                const profileId = existingProfile._id;
                console.log('[OAuth] Found existing profile:', {
                  userId,
                  profileId,
                  matchedBy: existingProfile.email ? 'email' : 'name',
                  profileEmail: existingProfile.email,
                  profileName: existingProfile.name
                });

                // Store the existing profile ID
                await storage.updateUser(userId, { lateProfileId: profileId });

                // Reload user
                user = await storage.getUser(userId);

                console.log('[OAuth] Linked existing Late profile to user');
              } else {
                console.error('[OAuth] Profile exists but could not find it:', {
                  email: user!.email,
                  name: user!.fullName || user!.email.split('@')[0],
                  availableProfiles: profilesData.profiles?.length || 0
                });
                return res.status(500).json({
                  error: 'Profile reconciliation failed',
                  message: 'Your social media profile exists but we could not link it. Please contact support.',
                  details: 'Profile found in Late.dev but could not match by email or name',
                });
              }
            } catch (fetchError: any) {
              console.error('[OAuth] Failed to fetch existing profiles:', fetchError);
              return res.status(500).json({
                error: 'Profile lookup failed',
                message: 'Unable to find your existing profile. Please contact support.',
                details: fetchError.message,
              });
            }
          } else {
            // Other profile creation errors
            console.error('[OAuth] Failed to create Late profile:', profileError);
            return res.status(500).json({
              error: 'Failed to create profile',
              message: 'Unable to create your social media profile. Please try again.',
              details: profileError.message,
            });
          }
        }
      }

      if (!user?.lateProfileId) {
        console.error('[OAuth] Still no Late profile after creation attempt:', userId);
        return res.status(500).json({
          error: 'Profile creation failed',
          message: 'Unable to set up your social media profile. Please contact support.',
        });
      }

      // Generate OAuth redirect URL (frontend callback page)
      // Auto-detect frontend URL from request origin for production compatibility
      const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');
      const frontendUrl = process.env.FRONTEND_URL || origin || 'http://localhost:5000';
      const redirectUrl = `${frontendUrl}/oauth-callback`;

      console.log('[OAuth] Redirect URL:', { origin, frontendUrl, redirectUrl });

      // Generate Late.dev OAuth URL (server-side authenticated request)
      // Use the mapped Late platform key (e.g., googlebusiness instead of google_business)
      const connectUrl = await lateService.generateConnectUrl(
        user.lateProfileId,
        latePlatform, // Use the mapped platform key
        redirectUrl
      );

      console.log('[OAuth] OAuth URL generated successfully:', { userId, platform, latePlatform, profileId: user.lateProfileId });

      res.json({
        success: true,
        connectUrl,
        platform: latePlatform, // Return the Late.dev platform key
        profileId: user.lateProfileId,
      });
    } catch (error: any) {
      const { platform } = req.params;
      console.error('[OAuth] Error generating connect URL:', {
        error: error.message,
        platform,
        stack: error.stack?.substring(0, 500),
      });
      res.status(500).json({
        error: 'Failed to generate connect URL',
        message: error.message,
        platform,
      });
    }
  });

  /**
   * POST /api/social/callback
   * Handle OAuth callback from Late.dev
   *
   * Expected query params from Late.dev redirect:
   * - connected: platform name (e.g., "instagram")
   * - profileId: Late.dev profile ID
   * - username: Connected account username
   *
   * Or on error:
   * - error: error type
   * - platform: platform name
   */
  app.post("/api/social/callback", async (req, res) => {
    try {
      const { connected, profileId, username, error, platform } = req.body;
      const userId = req.userId!;

      console.log('[OAuth Callback] Received:', { connected, profileId, username, error, platform, userId });

      // Handle error case
      if (error) {
        console.error('[OAuth Callback] Connection failed:', { error, platform, userId });
        return res.status(400).json({
          success: false,
          error: 'Connection failed',
          message: `Failed to connect ${platform || 'account'}. Please try again.`,
          errorDetails: error,
        });
      }

      // Validate required parameters
      if (!connected || !profileId || !username) {
        return res.status(400).json({
          error: 'Invalid callback data',
          message: 'Missing required parameters from OAuth callback',
        });
      }

      // Verify the profileId matches the user's profile
      const user = await storage.getUser(userId);
      if (!user?.lateProfileId || user.lateProfileId !== profileId) {
        console.error('[OAuth Callback] Profile ID mismatch:', {
          userId,
          userProfileId: user?.lateProfileId,
          callbackProfileId: profileId,
        });
        return res.status(403).json({
          error: 'Profile mismatch',
          message: 'The connected profile does not match your account',
        });
      }

      // Fetch full account details from Late.dev
      const accountDetails = await lateService.handleOAuthCallback(profileId, connected);

      // Store the account ID in the user record
      // Note: This stores only ONE account ID. For multiple accounts, you'd need a separate table.
      await storage.updateUser(userId, {
        lateAccountId: accountDetails._id,
      });

      console.log('[OAuth Callback] Account connected successfully:', {
        userId,
        platform: connected,
        username,
        accountId: accountDetails._id,
      });

      res.json({
        success: true,
        message: `Successfully connected ${connected} account`,
        account: {
          platform: connected,
          username,
          accountId: accountDetails._id,
          displayName: accountDetails.displayName,
          profilePicture: accountDetails.profilePicture,
        },
      });
    } catch (error: any) {
      console.error('[OAuth Callback] Error handling callback:', error);
      res.status(500).json({
        error: 'Failed to complete connection',
        details: error.message,
      });
    }
  });

  /**
   * GET /api/social/accounts
   * List all connected social accounts for the authenticated user
   */
  app.get("/api/social/accounts", async (req, res) => {
    try {
      const userId = req.userId!;

      console.log('[Social Accounts] Fetching accounts for user:', userId);

      // Get user's Late.dev profile ID
      const user = await storage.getUser(userId);
      if (!user?.lateProfileId) {
        console.error('[Social Accounts] User has no Late profile:', userId);
        return res.json({
          accounts: [],
          message: 'No Late.dev profile configured',
        });
      }

      // Fetch accounts from Late.dev
      const accountsData = await lateService.getAccounts(user.lateProfileId);

      console.log('[Social Accounts] Accounts fetched:', {
        userId,
        count: accountsData.accounts?.length || 0,
      });

      res.json({
        success: true,
        accounts: accountsData.accounts || [],
        profileId: user.lateProfileId,
      });
    } catch (error: any) {
      console.error('[Social Accounts] Error fetching accounts:', error);
      res.status(500).json({
        error: 'Failed to fetch accounts',
        details: error.message,
      });
    }
  });

  /**
   * DELETE /api/social/accounts/:accountId
   * Disconnect a social account from Late.dev
   */
  app.delete("/api/social/accounts/:accountId", requireAuth, async (req, res) => {
    try {
      const { accountId } = req.params;
      const userId = req.userId!;

      console.log('[Social Accounts] Disconnecting account:', { userId, accountId });

      // Verify user has a Late profile
      const user = await storage.getUser(userId);
      if (!user?.lateProfileId) {
        return res.status(400).json({
          error: 'No Late.dev profile configured',
        });
      }

      // Disconnect the account via Late.dev API
      await lateService.disconnectAccount(accountId);

      console.log('[Social Accounts] Account disconnected successfully:', accountId);

      res.json({
        success: true,
        message: 'Account disconnected successfully',
      });
    } catch (error: any) {
      console.error('[Social Accounts] Error disconnecting account:', error);
      res.status(500).json({
        error: 'Failed to disconnect account',
        details: error.message,
      });
    }
  });

  // GET /api/videos/:id - Get task details with projects and exports
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const taskId = req.params.id;

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Verify ownership - ensure the task belongs to the authenticated user
      if (task.userId !== req.userId) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Update task status from Klap if still processing
      if (task.status === "processing") {
        try {
          const klapStatus = await klapService.getTaskStatus(taskId);
          if (klapStatus.status !== task.status) {
            await storage.updateTask(taskId, {
              status: klapStatus.status,
              outputId: klapStatus.output_id || null,
              errorMessage: klapStatus.error || null,
              klapResponse: klapStatus as any,
            });
            task.status = klapStatus.status;
            task.outputId = klapStatus.output_id || null;
          }

          // If ready, fetch and store projects
          if (klapStatus.status === "ready" && klapStatus.output_id) {
            await fetchAndStoreProjects(taskId, klapStatus.output_id, task.userId);
          }
        } catch (error) {
          console.error("Error updating task status:", error);
        }
      }

      const projects = await storage.getProjectsByTask(taskId);
      const exportsList = await storage.getExportsByTask(taskId);

      // Update export statuses if processing
      for (const exp of exportsList) {
        if (exp.status === "processing") {
          try {
            const project = projects.find((p) => p.id === exp.projectId);
            if (project) {
              const exportStatus = await klapService.getExportStatus(
                exp.folderId,
                exp.projectId,
                exp.id,
                taskId,
              );

              if (exportStatus.status !== exp.status) {
                await storage.updateExport(exp.id, {
                  status: exportStatus.status,
                  srcUrl: exportStatus.src_url || null,
                  errorMessage: exportStatus.error || null,
                  klapResponse: exportStatus as any,
                });
                exp.status = exportStatus.status;
                exp.srcUrl = exportStatus.src_url || null;
              }
            }
          } catch (error) {
            console.error("Error updating export status:", error);
          }
        }
      }

      res.json({
        task,
        projects,
        exports: exportsList,
      });
    } catch (error: any) {
      console.error("Error fetching video details:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch video details" });
    }
  });

  // POST /api/videos/:id/export - Trigger export for a project
  app.post("/api/videos/:id/export", async (req, res) => {
    try {
      const taskId = req.params.id;
      const { projectId } = exportVideoSchema.parse(req.body);

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Verify ownership - ensure the task belongs to the authenticated user
      if (task.userId !== req.userId) {
        return res.status(404).json({ error: "Task not found" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.taskId !== taskId) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Create export
      const exportResponse = await klapService.createExport(
        project.folderId,
        projectId,
        taskId,
      );

      const exportData = await storage.createExport({
        id: exportResponse.id,
        projectId,
        folderId: project.folderId,
        taskId,
        userId: req.userId!,
        status: exportResponse.status,
        srcUrl: exportResponse.src_url || null,
        errorMessage: exportResponse.error || null,
        klapResponse: exportResponse as any,
        isAutoExport: "false",
      });

      // Start polling export status
      pollExportStatus(
        exportData.id,
        project.folderId,
        projectId,
        taskId,
      ).catch(console.error);

      res.json(exportData);
    } catch (error: any) {
      console.error("Error creating export:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to create export" });
    }
  });

  // POST /api/process-video - Simple one-click workflow following exact script pattern
  app.post("/api/process-video", checkCredits('klap_full_workflow'), async (req, res) => {
    try {
      const { url, email } = z.object({
        url: z.string().url(),
        email: z.string().email().optional()
      }).parse(req.body);

      // Step 1: Create task via Klap API
      const klapTask = await klapService.createVideoToShortsTask(url);

      // Step 2: Save task in database
      const task = await storage.createTask({
        id: klapTask.id,
        userId: req.userId!,
        sourceVideoUrl: url,
        email: email || null,
        status: klapTask.status,
        outputId: null,
        errorMessage: null,
        klapResponse: klapTask as any,
        autoExportRequested: "true",
        autoExportStatus: "pending",
      });

      // Deduct credits after successful Klap API call (Phase 9: XPAND Credits)
      await deductCreditsFromRequest(req, { taskId: task.id, type: 'process_video_workflow' });
      console.log('[Credits] Deducted for process-video workflow');

      // Step 3: Start background workflow (follows exact script)
      processCompleteWorkflow(task.id).catch(console.error);

      res.json({ taskId: task.id, status: "processing" });
    } catch (error: any) {
      console.error("Error starting video processing:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to start processing" });
    }
  });

  // ========================================
  // SOCIAL POSTING ROUTES (Late.dev API)
  // ========================================

  // POST /api/social/post - Post a clip to social media
  app.post("/api/social/post", async (req, res) => {
    try {
      // Defensive check: Ensure userId is present (should be set by auth middleware)
      if (!req.userId) {
        console.error('[Social Post] CRITICAL: req.userId is missing despite passing auth middleware');
        return res.status(401).json({
          error: 'Authentication error',
          message: 'User ID not found in request. Please log out and log back in.',
        });
      }

      console.log(`[Social Post] Request from user: ${req.userId}`);

      // Validate input
      const validation = postToSocialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: validation.error.errors,
        });
      }

      const { projectId, videoUrl, mediaAssetId, platform, caption, scheduledFor } = validation.data;

      // Phase 9: Check credits for social post
      const creditCheck = await creditService.checkCredits(req.userId!, 'social_post');
      if (!creditCheck.hasEnough) {
        console.log('[Credits] Insufficient credits for social post:', req.userId);
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `You need ${creditCheck.required} credits for ${creditCheck.featureName}, but only have ${creditCheck.balance}`,
          required: creditCheck.required,
          balance: creditCheck.balance,
          featureKey: 'social_post',
        });
      }

      // Determine video source and extract URL
      let finalVideoUrl: string;
      let projectForPost: any = null;
      let taskForPost: any = null;

      if (projectId) {
        // **Klap Video Flow** - Use projectExport.srcUrl
        console.log(`[Social Post] Klap video - posting project ${projectId} to ${platform}`);

        // Get project to verify it exists and get associated task
        const project = await storage.getProject(projectId);
        if (!project) {
          console.log(`[Social Post] Project not found: ${projectId}`);
          return res.status(404).json({ error: "Project not found" });
        }

        // Verify ownership - ensure the project belongs to the authenticated user
        const task = await storage.getTask(project.taskId);
        if (!task || task.userId !== req.userId) {
          console.log(`[Social Post] Unauthorized access to project ${projectId}`);
          return res.status(404).json({ error: "Project not found" });
        }

        // Get the latest successful export for this project
        const exports = await storage.getExportsByTask(project.taskId);
        const projectExport = exports.find(
          (exp) => exp.projectId === projectId && exp.status === "ready"
        );

        if (!projectExport || !projectExport.srcUrl) {
          console.log(`[Social Post] No ready export found for project ${projectId}`);
          return res.status(400).json({
            error: "No ready export found for this project",
            details: "Please export the clip before posting to social media",
          });
        }

        finalVideoUrl = projectExport.srcUrl;
        projectForPost = project;
        taskForPost = task;

        console.log(`[Social Post] Using Klap export URL: ${finalVideoUrl.substring(0, 50)}...`);
      } else if (videoUrl) {
        // **UGC Video Flow** - Use direct videoUrl from media_assets
        console.log(`[Social Post] UGC video - posting direct URL to ${platform}`);
        finalVideoUrl = videoUrl;

        console.log(`[Social Post] Using UGC video URL: ${finalVideoUrl.substring(0, 50)}...`);
      } else {
        // This should never happen due to schema validation, but just in case
        console.error('[Social Post] Neither projectId nor videoUrl provided');
        return res.status(400).json({
          error: "Invalid request",
          details: "Either projectId or videoUrl must be provided",
        });
      }

      // Phase 2: Validate video URL format (applies to both Klap and UGC)
      if (!finalVideoUrl.startsWith('https://')) {
        console.error(`[Social Post] Invalid video URL format: ${finalVideoUrl}`);
        return res.status(400).json({
          error: 'Invalid video URL',
          details: 'Video URL must be HTTPS. The export may have failed or URL is malformed.'
        });
      }

      console.log('[Validation] ✓ Video URL format valid (HTTPS)');
      console.log('[Validation] Full URL:', finalVideoUrl);

      // Get user's Late.dev profile information
      const user = await storage.getUser(req.userId!);
      if (!user) {
        console.log(`[Social Post] User not found: ${req.userId}`);
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.lateProfileId) {
        console.log(`[Social Post] User ${req.userId} has no Late profile`);
        return res.status(400).json({
          error: "No Late.dev profile configured",
          details: "Your Late.dev profile is being created. Please try again in a moment.",
        });
      }

      // Get the account ID for the target platform
      // First, try to get connected accounts and find one for this platform
      let accountId: string | null = null;
      try {
        const accountsData = await lateService.getAccounts(user.lateProfileId);
        const platformAccount = accountsData.accounts?.find(
          (acc: any) => acc.platform === platform && acc.isActive
        );
        if (platformAccount) {
          accountId = platformAccount._id;
          console.log(`[Social Post] Found connected ${platform} account: ${accountId}`);
        }
      } catch (accountError) {
        console.warn(`[Social Post] Could not fetch accounts:`, accountError);
      }

      // Fall back to default Instagram account if no connected account found for Instagram
      if (!accountId && platform === 'instagram') {
        accountId = user.lateAccountId || process.env.INSTAGRAM_ACCOUNT_ID || '6900d2cd8bbca9c10cbfff74';
        console.log(`[Social Post] Using default Instagram account: ${accountId}`);
      }

      // Validate that we have an account for the platform
      if (!accountId) {
        console.error(`[Social Post] No ${platform} account available for user ${req.userId}`);
        return res.status(400).json({
          error: `${platform} account required`,
          details: `Please connect your ${platform} account in the Socials page before posting`
        });
      }

      console.log(`[Social Post] Using Late profile: ${user.lateProfileId}, platform: ${platform}, account: ${accountId}`);

      // Phase 2.5: AI Caption Generation Integration
      let finalCaption = caption || '';
      let captionSource: 'manual' | 'ai_auto' | 'ai_manual' = 'manual';
      let aiMetadata: any = null;

      // Auto-generate caption if empty and user has auto-generate enabled
      // Type-safe check: handles both boolean true and string 'true'
      const autoGenerateEnabled = user.captionAutoGenerate === true || user.captionAutoGenerate === 'true';

      if (!finalCaption && autoGenerateEnabled) {
        console.log('[Caption] Auto-generating caption (empty caption + auto-mode enabled)');
        console.log('[Caption] User auto-generate setting:', user.captionAutoGenerate, '(type:', typeof user.captionAutoGenerate, ')');

        try {
          const { openaiService } = await import("./services/openai.js");
          // Use project name for Klap videos, generic name for UGC videos
          const contentName = projectForPost?.name || 'UGC video ad';
          const result = await openaiService.generateCaption({
            projectName: contentName,
            userSystemPrompt: user.captionSystemPrompt || undefined,
          });

          // Validate generated caption is not empty
          if (result.caption && result.caption.trim().length > 0) {
            finalCaption = result.caption.trim();
            captionSource = 'ai_auto';
            aiMetadata = result.metadata;

            console.log(`[Caption] Auto-generated caption: "${finalCaption.substring(0, 50)}..."`);
            console.log('[Caption] Generated caption length:', finalCaption.length);
          } else {
            // OpenAI returned empty caption - use fallback
            console.warn('[Caption] OpenAI returned empty caption, using fallback');
            finalCaption = "Check out my latest clip! 🎥✨";
            captionSource = 'ai_auto';
            aiMetadata = { ...result.metadata, fallback: true };
            console.log('[Caption] Using fallback caption, length:', finalCaption.length);
          }
        } catch (captionError: any) {
          // Graceful fallback: if caption generation fails, use default caption
          console.error('[Caption] Failed to auto-generate caption, using fallback:', captionError.message);
          finalCaption = "Check out my latest clip! 🎥✨";
          captionSource = 'manual'; // Mark as manual since AI failed
          aiMetadata = null;
          console.log('[Caption] Error fallback caption length:', finalCaption.length);
        }
      } else if (finalCaption) {
        console.log('[Caption] Using manual caption provided by user');
        console.log('[Caption] Manual caption length:', finalCaption.length);
      } else {
        console.log('[Caption] No caption (auto-generate disabled)');
        console.log('[Caption] User auto-generate setting:', user.captionAutoGenerate);
      }

      // Create initial social post record (Phase 3: Include scheduling fields)
      // For UGC videos, projectId and taskId will be null, mediaAssetId will be set
      const initialStatus = scheduledFor ? 'scheduled' : 'posting';

      const socialPost = await storage.createSocialPost({
        projectId: projectId || null,
        taskId: taskForPost?.taskId || null,
        mediaAssetId: mediaAssetId || null, // Phase 4.7: UGC video reference
        userId: req.userId!, // ✅ FIX: Add required userId from authenticated session
        platform,
        caption: finalCaption,
        captionSource,
        aiCaptionMetadata: aiMetadata,
        status: initialStatus, // 'scheduled' if scheduledFor provided, otherwise 'posting'
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null, // Phase 3: Store scheduled time
        isScheduled: scheduledFor ? 'true' : 'false', // Phase 3: Flag for scheduled posts
        latePostId: null,
        platformPostUrl: null,
        errorMessage: null,
        lateResponse: null,
        publishedAt: null,
      });

      console.log(`[Social Post] Created social post record: ${socialPost.id} (caption source: ${captionSource}, scheduled: ${!!scheduledFor})`);

      // Phase 3: Handle scheduled vs immediate posting
      if (scheduledFor) {
        // Scheduled post: Create in Late.dev with scheduledFor timestamp
        console.log(`[Social Post] Scheduling post for ${scheduledFor} (UTC)`);

        // 🔍 DEBUG: Log Late API request payload
        console.log('[Late Debug] Request payload:', {
          videoUrl: finalVideoUrl.substring(0, 80) + '...',
          caption: finalCaption.substring(0, 50) + '...',
          contentType: 'reel',
          scheduledFor,
          profileId: user.lateProfileId,
          accountId,
        });

        try {
          // Use generic postToSocial method for all platforms
          const lateResponse = await lateService.postToSocial(
            {
              platform,
              videoUrl: finalVideoUrl,
              caption: finalCaption,
              scheduledFor, // Pass ISO 8601 UTC timestamp to Late.dev
            },
            user.lateProfileId!,  // User's Late profile ID
            accountId             // Platform account ID
          );

          // Update social post with Late.dev response (scheduled status)
          const updatedPost = await storage.updateSocialPost(socialPost.id, {
            status: 'scheduled',
            latePostId: lateResponse.post._id,
            lateResponse: lateResponse as any,
          });

          console.log(`[Social Post] Successfully scheduled post to ${platform} in Late.dev: ${lateResponse.post._id}`);

          res.json({
            success: true,
            post: updatedPost,
            message: `Post scheduled for ${new Date(scheduledFor).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
            scheduledFor,
          });
        } catch (lateError: any) {
          // Update social post with failure
          await storage.updateSocialPost(socialPost.id, {
            status: 'failed',
            errorMessage: lateError.message,
          });

          console.error("[Social Post] Late API scheduling error:", lateError);
          res.status(500).json({
            error: "Failed to schedule post",
            details: lateError.message,
          });
        }
      } else {
        // Immediate post: Post to platform right away
        // 🔍 DEBUG: Log Late API request payload
        console.log('[Late Debug] Request payload:', {
          platform,
          videoUrl: finalVideoUrl.substring(0, 80) + '...',
          caption: finalCaption.substring(0, 50) + '...',
          profileId: user.lateProfileId,
          accountId,
        });

        try {
          // Use generic postToSocial method for all platforms
          const lateResponse = await lateService.postToSocial(
            {
              platform,
              videoUrl: finalVideoUrl,
              caption: finalCaption,
            },
            user.lateProfileId!,  // User's Late profile ID
            accountId             // Platform account ID
          );

          // Extract platform-specific data
          const platformPost = lateResponse.post.platforms.find(
            (p) => p.platform === platform
          );

          const finalStatus = platformPost?.status === 'published' ? 'published' :
                             platformPost?.status === 'failed' ? 'failed' : 'posting';

          // Update social post with success
          const updatedPost = await storage.updateSocialPost(socialPost.id, {
            status: finalStatus,
            latePostId: lateResponse.post._id,
            platformPostUrl: platformPost?.platformPostUrl || null,
            lateResponse: lateResponse as any,
            publishedAt: finalStatus === 'published' ? new Date() : null,
            errorMessage: platformPost?.error || null,
          });

          console.log(`[Social Post] Successfully posted to ${platform}: ${platformPost?.platformPostUrl || 'pending'}`);

          // Deduct credits after successful Late.dev API call (Phase 9: XPAND Credits)
          await creditService.deductCredits(req.userId!, 'social_post', { postId: socialPost.id, platform });

          res.json({
            success: true,
            post: updatedPost,
            platformUrl: platformPost?.platformPostUrl,
            message: finalStatus === 'published'
              ? `Successfully posted to ${platform}!`
              : `Post is being processed by ${platform}`,
          });
        } catch (lateError: any) {
          // Update social post with failure
          await storage.updateSocialPost(socialPost.id, {
            status: 'failed',
            errorMessage: lateError.message,
          });

          console.error("[Social Post] Late API error:", lateError);
          res.status(500).json({
            error: "Failed to post to Instagram",
            details: lateError.message,
          });
        }
      } // End of if/else (scheduled vs immediate)
    } catch (error: any) {
      console.error("[Social Post] Error posting to social:", error);
      res.status(500).json({
        error: "Failed to create social post",
        details: error.message,
      });
    }
  });

  // GET /api/social/posts/:projectId - Get social posts for a project
  app.get("/api/social/posts/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      console.log(`[Social Post] Fetching posts for project ${projectId}`);

      // Verify ownership - ensure the project belongs to the authenticated user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const task = await storage.getTask(project.taskId);
      if (!task || task.userId !== req.userId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const posts = await storage.getSocialPostsByProject(projectId);

      res.json({
        posts,
        count: posts.length
      });
    } catch (error: any) {
      console.error("[Social Post] Error fetching social posts:", error);
      res.status(500).json({
        error: "Failed to fetch social posts",
        details: error.message,
      });
    }
  });

  // GET /api/social/posts/task/:taskId - Get all social posts for a task
  app.get("/api/social/posts/task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      console.log(`[Social Post] Fetching posts for task ${taskId}`);

      // Verify ownership - ensure the task belongs to the authenticated user
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (task.userId !== req.userId) {
        return res.status(404).json({ error: "Task not found" });
      }

      const posts = await storage.getSocialPostsByTask(taskId);

      res.json({
        posts,
        count: posts.length
      });
    } catch (error: any) {
      console.error("[Social Post] Error fetching social posts:", error);
      res.status(500).json({
        error: "Failed to fetch social posts",
        details: error.message,
      });
    }
  });

  // GET /api/analytics/posts - Get post analytics from Late.dev API
  app.get("/api/analytics/posts", requireAuth, async (req, res) => {
    try {
      console.log(`[Analytics] Fetching analytics for user ${req.userId}`);

      // Get user's Late.dev profile to filter analytics
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.userId as string),
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Fetch analytics from Late.dev API (all platforms)
      const analyticsData = await lateService.getAnalytics({
        profileId: user.lateProfileId || undefined,
        // Don't filter by platform - get all platforms
        limit: 50,
        sortBy: 'date',
        order: 'desc',
      });

      // Transform Late.dev response to match our frontend interface
      const posts = (analyticsData.posts || []).map((post: any) => ({
        id: post.postId || post._id,
        thumbnailUrl: post.mediaItems?.[0]?.thumbnailUrl || post.thumbnailUrl || null,
        caption: post.content || '',
        createdAt: post.publishedAt || post.createdAt,
        platformPostUrl: post.platformPostUrl || null,
        platform: post.platform || 'instagram',
        metrics: {
          views: post.analytics?.views || 0,
          likes: post.analytics?.likes || 0,
          comments: post.analytics?.comments || 0,
          shares: post.analytics?.shares || 0,
          impressions: post.analytics?.impressions || 0,
          reach: post.analytics?.reach || 0,
          clicks: post.analytics?.clicks || 0,
        },
      }));

      // Calculate summary totals
      const summary = posts.reduce(
        (acc: any, post: any) => ({
          views: acc.views + post.metrics.views,
          impressions: acc.impressions + post.metrics.impressions,
          reach: acc.reach + post.metrics.reach,
          likes: acc.likes + post.metrics.likes,
          comments: acc.comments + post.metrics.comments,
          shares: acc.shares + post.metrics.shares,
        }),
        { views: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0 }
      );

      console.log(`[Analytics] Returning ${posts.length} posts with summary metrics`);

      res.json({
        summary,
        posts,
      });
    } catch (error: any) {
      console.error("[Analytics] Error fetching analytics:", error);
      res.status(500).json({
        error: "Failed to fetch analytics",
        details: error.message,
      });
    }
  });

  // GET /api/social/scheduled - Get all scheduled posts for current user (Phase 7.3)
  app.get("/api/social/scheduled", requireAuth, async (req, res) => {
    try {
      console.log(`[Scheduled Posts] Fetching scheduled posts for user ${req.userId}`);

      // Query parameters for filtering
      const { status, limit = '50' } = req.query;

      // Build query
      let query = db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.userId, req.userId as string))
        .orderBy(desc(socialPosts.scheduledFor));

      // Apply status filter if provided
      if (status && typeof status === 'string') {
        query = query.where(eq(socialPosts.status, status));
      }

      // Apply limit
      const limitNum = parseInt(limit as string, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }

      const posts = await query;

      console.log(`[Scheduled Posts] Found ${posts.length} posts`);

      res.json({
        posts,
        count: posts.length
      });
    } catch (error: any) {
      console.error("[Scheduled Posts] Error fetching scheduled posts:", error);
      res.status(500).json({
        error: "Failed to fetch scheduled posts",
        details: error.message,
      });
    }
  });

  // ========================================
  // AI MEDIA GENERATION ENDPOINTS (Phase 4)
  // ========================================

  /**
   * POST /api/ai/generate-media
   *
   * Generate AI image or video
   */
  app.post("/api/ai/generate-media", requireAuth, async (req, res) => {
    try {
      console.log(`[AI Generate] Request from user: ${req.userId}`);

      // Validate input
      const validation = generateMediaSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: validation.error.errors,
        });
      }

      const { prompt, provider, type, referenceImageUrl, options } = validation.data;

      // Validate provider/type combination
      if (!validateProviderType(provider, type)) {
        return res.status(400).json({
          error: "Invalid provider/type combination",
          details: `Provider ${provider} does not support ${type} generation`,
        });
      }

      // Phase 9: Determine feature key based on provider/type
      let featureKey = 'media_flux'; // default
      if (provider === 'openai') {
        featureKey = 'media_4o';
      } else if (provider === 'kie-veo3' && type === 'video') {
        featureKey = 'media_veo3';
      } else if (provider === 'kie-sora2' && type === 'video') {
        featureKey = 'media_sora2';
      } else if (provider === 'kie-flux' && type === 'image') {
        featureKey = 'media_flux';
      }

      // Phase 9: Check credits
      const creditCheck = await creditService.checkCredits(req.userId!, featureKey);
      if (!creditCheck.hasEnough) {
        console.log('[AI Generate] Insufficient credits:', req.userId);
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `You need ${creditCheck.required} credits for ${creditCheck.featureName}, but only have ${creditCheck.balance}`,
          required: creditCheck.required,
          balance: creditCheck.balance,
          featureKey,
        });
      }

      console.log('[AI Generate] Starting generation:', { provider, type, prompt: prompt.substring(0, 50) });

      // Create media asset record
      const assetId = uuidv4();
      const mediaAsset = await storage.createMediaAsset({
        id: assetId,
        userId: req.userId!,
        provider,
        type,
        prompt,
        referenceImageUrl: referenceImageUrl || null,
        status: 'processing',
        taskId: null,
        resultUrl: null,
        resultUrls: null,
        errorMessage: null,
        retryCount: 0,
        metadata: options || null,
        apiResponse: null,
        completedAt: null,
      });

      console.log('[AI Generate] Created media asset:', assetId);

      // Start generation in background
      processMediaGeneration(assetId, {
        provider,
        type,
        prompt,
        referenceImageUrl,
        options,
      }).catch((error) => {
        console.error('[AI Generate] Background processing error:', error);
      });

      // Deduct credits after starting generation (Phase 9: XPAND Credits)
      await creditService.deductCredits(req.userId!, featureKey, { assetId, provider, type });

      res.json({
        success: true,
        assetId,
        status: 'processing',
        message: 'Media generation started. Check status with GET /api/ai/media/:id',
      });

    } catch (error: any) {
      console.error("[AI Generate] Error:", error);
      res.status(500).json({
        error: "Failed to start media generation",
        details: error.message,
      });
    }
  });

  /**
   * POST /api/ai/generate-ugc-preset
   *
   * Generate UGC Ad using preset templates (Phase 4)
   * Takes product brief and converts to prompt using preset templates
   * Supports multipart/form-data for file uploads
   */
  app.post("/api/ai/generate-ugc-preset", requireAuth, upload.single('productImage'), async (req, res) => {
    try {
      console.log(`[AI UGC Preset] Request from user: ${req.userId}`);
      console.log(`[AI UGC Preset] Has uploaded file:`, !!req.file);
      console.log(`[AI UGC Preset] Request body:`, JSON.stringify(req.body, null, 2));

      // Validate input (text fields from form body)
      const validation = generateUGCPresetSchema.safeParse(req.body);
      if (!validation.success) {
        console.error(`[AI UGC Preset] Validation failed:`, JSON.stringify(validation.error.errors, null, 2));
        return res.status(400).json({
          error: "Invalid input",
          details: validation.error.errors,
        });
      }

      const {
        productName,
        productFeatures,
        customerPersona,
        videoSetting,
        generationMode,
        duration,
        productImageUrl,
      } = validation.data;

      console.log(`[AI UGC Preset] Duration requested: ${duration}s for mode: ${generationMode}`);

      // ✅ SERVER-SIDE AUTHORITATIVE DURATION RESOLUTION
      // Mode C (sora2) only supports n_frames "10" or "15" - enforce this regardless of client
      let effectiveDuration: number;
      if (generationMode === 'sora2') {
        effectiveDuration = duration >= 15 ? 15 : 10;
      } else {
        effectiveDuration = duration;
      }
      console.log(`[ugc] resolved_duration mode=${generationMode} client=${duration} effective=${effectiveDuration}`);

      // Handle uploaded file: upload to KIE and get public URL
      let finalProductImageUrl = productImageUrl;
      if (req.file) {
        console.log(`[AI UGC Preset] File uploaded:`, {
          name: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
        });

        try {
          // Upload file buffer to KIE and get public URL
          const publicUrl = await kieService.uploadFileBuffer(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
          );
          console.log(`[AI UGC Preset] File uploaded to KIE successfully:`, publicUrl);
          finalProductImageUrl = publicUrl;
        } catch (uploadError: any) {
          console.error(`[AI UGC Preset] Failed to upload file to KIE:`, uploadError.message);
          return res.status(500).json({
            error: 'Failed to upload product image',
            details: uploadError.message,
          });
        }
      }

      // Dynamic Credit Pricing for UGC based on duration
      // Base costs (for ~10s):
      //   - nanobana+veo3 (Premium): 70 credits
      //   - veo3-only (Fast): 35 credits
      //   - sora2 (Budget): 18 credits
      // Per-second multipliers (for duration > 10s):
      //   - nanobana+veo3: 2.0 credits/sec
      //   - veo3-only: 1.5 credits/sec
      //   - sora2: 1.0 credits/sec

      const UGC_PRICING: Record<string, { base: number; multiplier: number; name: string }> = {
        'nanobana+veo3': { base: 70, multiplier: 2.0, name: 'UGC Premium (NanoBanana + Veo3)' },
        'veo3-only': { base: 35, multiplier: 1.5, name: 'UGC Fast (Veo3)' },
        'sora2': { base: 18, multiplier: 1.0, name: 'UGC Budget (Sora2)' },
      };

      const pricing = UGC_PRICING[generationMode] || UGC_PRICING['sora2']; // Default to cheapest if unknown
      const baseCost = pricing.base;
      const perSecondMultiplier = pricing.multiplier;

      // Calculate total credits based on duration
      let totalCredits: number;
      if (duration <= 10) {
        totalCredits = baseCost;
      } else {
        const extraSeconds = duration - 10;
        totalCredits = baseCost + Math.round(extraSeconds * perSecondMultiplier);
      }

      console.log('[AI UGC Preset] Dynamic pricing:', {
        mode: generationMode,
        duration,
        baseCost,
        perSecondMultiplier,
        totalCredits,
      });

      // Check if user has enough credits
      const userBalance = await creditService.getBalance(req.userId!);
      if (userBalance < totalCredits) {
        console.log('[AI UGC Preset] Insufficient credits:', {
          userId: req.userId,
          balance: userBalance,
          required: totalCredits,
        });
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `You need ${totalCredits} credits for ${pricing.name} (${duration}s), but only have ${userBalance}`,
          required: totalCredits,
          balance: userBalance,
          mode: generationMode,
          duration,
        });
      }

      // Convert form values to prompt variables (including duration for dynamic prompts)
      const promptVariables = {
        product: productName,
        features: productFeatures,
        icp: formatICPForPrompt(customerPersona),
        scene: formatSceneForPrompt(videoSetting),
        duration: effectiveDuration, // ✅ Use server-resolved duration for prompt text
      };

      // ✅ Debug: Log duration explicitly to verify it's being passed
      console.log(`[ugc] prompt_gen mode=${generationMode} duration=${effectiveDuration}s`);

      // Generate prompt using preset templates
      const generatedPrompt = generatePrompt(generationMode as GenerationMode, promptVariables);

      // ✅ Debug: Log first 150 chars to verify duration in prompt text
      console.log(`[ugc] prompt_preview: ${generatedPrompt.substring(0, 150)}...`);

      // Determine provider based on mode
      let provider: string;
      let type: 'image' | 'video';

      if (generationMode === 'nanobana+veo3') {
        // Mode A: Start with NanoBanana image (will chain to Veo3 later)
        provider = 'kie-flux-kontext'; // NanoBanana provider
        type = 'image';
      } else if (generationMode === 'veo3-only') {
        // Mode B: Direct Veo3 video
        provider = 'kie-veo3';
        type = 'video';
      } else {
        // Mode C: Sora 2 video
        provider = 'sora2'; // TODO: Add Sora provider to KIE service
        type = 'video';
      }

      // Create media asset record
      const assetId = uuidv4();
      await storage.createMediaAsset({
        id: assetId,
        userId: req.userId!,
        provider,
        type,
        prompt: generatedPrompt,
        referenceImageUrl: finalProductImageUrl || null,
        status: 'processing',
        taskId: null,
        resultUrl: null,
        resultUrls: null,
        errorMessage: null,
        retryCount: 0,
        metadata: {
          generationMode,
          duration: effectiveDuration, // ✅ Store server-resolved duration
          creditsPricing: {
            baseCost,
            perSecondMultiplier,
            totalCredits,
          },
          productBrief: {
            productName,
            productFeatures,
            customerPersona,
            videoSetting,
          },
        },
        apiResponse: null,
        completedAt: null,
        generationMode: generationMode, // Store in schema field (Phase 5 support)
        chainMetadata: generationMode === 'nanobana+veo3' ? { step: 'generating_image' } : null,
      });

      // ✅ LIFECYCLE LOG: Job created
      console.log(`[ugc] job_created id=${assetId} provider=${provider} mode=${generationMode}`);

      // Mode A: Use chain orchestration service
      if (generationMode === 'nanobana+veo3') {
        ugcChainService.startImageGeneration({
          assetId,
          promptVariables,
          productImageUrl: finalProductImageUrl,
          duration: effectiveDuration, // ✅ Use server-resolved duration for chain service
        }).then(() => {
          processChainWorkflow(assetId).catch((error) => {
            console.log(`[ugc] job_failed id=${assetId} reason=chain_error error=${error.message}`);
          });
        }).catch((error) => {
          console.log(`[ugc] job_failed id=${assetId} reason=start_error error=${error.message}`);
        });
      } else {
        // Mode B & C: Use standard generation process
        processMediaGeneration(assetId, {
          provider,
          type,
          prompt: generatedPrompt,
          referenceImageUrl: finalProductImageUrl,
          options: {
            duration: effectiveDuration, // ✅ Use server-resolved duration for provider
            model: generationMode === 'sora2' ? 'sora2' : 'veo3',
          },
        }).catch((error) => {
          console.log(`[ugc] job_failed id=${assetId} reason=process_error error=${error.message}`);
        });
      }

      // Deduct credits using dynamic pricing (Phase 9: XPAND Credits)
      await creditService.deductCreditsAmount(
        req.userId!,
        totalCredits,
        `UGC Ad: ${pricing.name} (${duration}s)`,
        {
          mode: generationMode,
          duration,
          baseCost,
          perSecondMultiplier,
          finalCost: totalCredits,
          assetId,
          productName,
        }
      );

      res.json({
        success: true,
        assetId,
        status: 'processing',
        message: 'UGC ad generation started with preset templates',
        creditsDeducted: totalCredits,
      });

    } catch (error: any) {
      console.error("[AI UGC Preset] Error:", error);
      res.status(500).json({
        error: "Failed to start UGC generation",
        details: error.message,
      });
    }
  });

  /**
   * GET /api/ai/media/:id
   *
   * Get media asset status and details
   */
  app.get("/api/ai/media/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const mediaAsset = await storage.getMediaAsset(id);
      if (!mediaAsset) {
        return res.status(404).json({ error: "Media asset not found" });
      }

      // Verify ownership
      if (mediaAsset.userId !== req.userId) {
        return res.status(404).json({ error: "Media asset not found" });
      }

      res.json({
        success: true,
        asset: mediaAsset,
      });

    } catch (error: any) {
      console.error("[AI Media Get] Error:", error);
      res.status(500).json({
        error: "Failed to fetch media asset",
        details: error.message,
      });
    }
  });

  /**
   * GET /api/ai/media
   *
   * List all user's media assets (gallery)
   */
  app.get("/api/ai/media", requireAuth, async (req, res) => {
    try {
      const mediaAssets = await storage.getMediaAssetsByUser(req.userId!);

      res.json({
        success: true,
        assets: mediaAssets,
        total: mediaAssets.length,
      });

    } catch (error: any) {
      console.error("[AI Media List] Error:", error);
      res.status(500).json({
        error: "Failed to fetch media assets",
        details: error.message,
      });
    }
  });

  /**
   * DELETE /api/ai/media/:id
   *
   * Soft delete a media asset (Dec 2025)
   * Sets deleted_at timestamp, asset won't appear in gallery
   */
  app.delete("/api/ai/media/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Verify asset exists
      const asset = await storage.getMediaAsset(id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Verify ownership
      if (asset.userId !== req.userId) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Soft delete
      const deleted = await storage.softDeleteMediaAsset(id, req.userId!);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete asset" });
      }

      console.log(`[UGC Delete] User ${req.userId} soft-deleted asset ${id}`);

      res.json({
        success: true,
        message: "Asset deleted successfully",
      });

    } catch (error: any) {
      console.error("[UGC Delete] Error:", error);
      res.status(500).json({
        error: "Failed to delete asset",
        details: error.message,
      });
    }
  });

  /**
   * POST /api/ai/media/:id/rating
   *
   * Rate a media asset 1-5 stars (Dec 2025)
   */
  app.post("/api/ai/media/:id/rating", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { rating } = req.body;

      // Validate rating
      if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res.status(400).json({
          error: "Invalid rating",
          message: "Rating must be an integer between 1 and 5",
        });
      }

      // Verify asset exists
      const asset = await storage.getMediaAsset(id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Verify ownership
      if (asset.userId !== req.userId) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Update rating
      const updated = await storage.rateMediaAsset(id, req.userId!, rating);
      if (!updated) {
        return res.status(500).json({ error: "Failed to update rating" });
      }

      console.log(`[UGC Rating] User ${req.userId} rated asset ${id} with ${rating} stars`);

      res.json({
        success: true,
        asset: updated,
      });

    } catch (error: any) {
      console.error("[UGC Rating] Error:", error);
      res.status(500).json({
        error: "Failed to update rating",
        details: error.message,
      });
    }
  });

  /**
   * POST /api/ai/media/use-for-video
   *
   * Convert an existing image asset to video generation
   * Takes an image from the gallery and generates a video using it as reference
   */
  app.post("/api/ai/media/use-for-video", requireAuth, async (req, res) => {
    try {
      const { sourceAssetId } = req.body;

      if (!sourceAssetId) {
        return res.status(400).json({ error: "sourceAssetId is required" });
      }

      // Fetch source asset
      const source = await storage.getMediaAsset(sourceAssetId);
      if (!source) {
        return res.status(404).json({ error: "Source asset not found" });
      }

      // Verify ownership
      if (source.userId !== req.userId) {
        return res.status(404).json({ error: "Source asset not found" });
      }

      // Ensure source is an image
      if (source.type !== 'image') {
        return res.status(400).json({ error: "Source must be an image asset" });
      }

      // Ensure source has a result URL
      const sourceUrl = source.resultUrl || (source as any).result_url;
      if (!sourceUrl) {
        return res.status(400).json({ error: "Source image has no result URL" });
      }

      // Phase 9: Check credits for video generation from image
      const creditCheck = await creditService.checkCredits(req.userId!, 'media_veo3');
      if (!creditCheck.hasEnough) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `You need ${creditCheck.required} credits for ${creditCheck.featureName}, but only have ${creditCheck.balance}`,
          required: creditCheck.required,
          balance: creditCheck.balance,
          featureKey: 'media_veo3',
        });
      }

      console.log(`[AI Use For Video] Converting image ${sourceAssetId} to video for user ${req.userId}`);

      // Create enhanced prompt based on original image prompt
      // Duration defaults to 10s for image-to-video conversion (Veo3 text-to-video)
      const defaultDuration = 10;
      const videoPrompt = source.prompt
        ? `${source.prompt}. Create a dynamic ${defaultDuration}-second UGC-style video showcasing this product.`
        : `Create an engaging ${defaultDuration}-second UGC-style product video based on this image.`;

      // Create new media asset record
      const assetId = uuidv4();
      await storage.createMediaAsset({
        id: assetId,
        userId: req.userId!,
        provider: 'kie-veo3',
        type: 'video',
        prompt: videoPrompt,
        referenceImageUrl: sourceUrl,
        status: 'processing',
        taskId: null,
        resultUrl: null,
        resultUrls: null,
        errorMessage: null,
        retryCount: 0,
        metadata: { sourceAssetId },
        apiResponse: null,
      });

      // Start video generation (background process will handle polling)
      processMediaGeneration(assetId, {
        provider: 'kie-veo3',
        type: 'video',
        prompt: videoPrompt,
        referenceImageUrl: sourceUrl,
        options: {
          duration: defaultDuration,
          model: 'veo3',
        },
      }).catch((err) => {
        console.error(`[AI Use For Video] Background generation failed for ${assetId}:`, err);
      });

      // Deduct credits after starting generation (Phase 9: XPAND Credits)
      await creditService.deductCredits(req.userId!, 'media_veo3', {
        assetId,
        sourceAssetId,
        type: 'image_to_video'
      });

      res.json({
        success: true,
        newAssetId: assetId,
        status: 'processing',
        message: 'Video generation started from image',
      });

    } catch (error: any) {
      console.error("[AI Use For Video] Error:", error);
      res.status(500).json({
        error: "Failed to start video generation",
        details: error.message,
      });
    }
  });

  // POST /api/ai/media/retry/:id - Retry failed media generation (Phase 2)
  app.post("/api/ai/media/retry/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Fetch asset
      const asset = await storage.getMediaAsset(id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Verify ownership
      if (asset.userId !== req.userId) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Only allow retry for failed assets
      if (asset.status !== 'error') {
        return res.status(400).json({
          error: "Can only retry failed generations",
          currentStatus: asset.status
        });
      }

      // Check retry limit (max 3 attempts)
      const currentRetryCount = asset.retryCount || 0;
      if (currentRetryCount >= 3) {
        return res.status(400).json({
          error: "Maximum retry attempts reached",
          message: "This generation has already been retried 3 times. Please create a new generation.",
          retryCount: currentRetryCount,
        });
      }

      console.log(`[AI Retry] Retrying ${asset.type} generation ${id} for user ${req.userId} (attempt ${currentRetryCount + 1}/3)`);

      // Reset asset to processing state
      await storage.updateMediaAsset(id, {
        status: 'processing',
        errorMessage: null,
        retryCount: currentRetryCount + 1,
      });

      // Restart generation process with original parameters
      processMediaGeneration(id, {
        provider: asset.provider,
        type: asset.type,
        prompt: asset.prompt,
        referenceImageUrl: asset.referenceImageUrl || undefined,
        options: asset.metadata || null,
      }).catch((err) => {
        console.error(`[AI Retry] Background retry failed for ${id}:`, err);
      });

      res.json({
        success: true,
        assetId: id,
        status: 'processing',
        retryCount: currentRetryCount + 1,
        message: `Retry attempt ${currentRetryCount + 1} of 3 started`,
      });

    } catch (error: any) {
      console.error("[AI Retry] Error:", error);
      res.status(500).json({
        error: "Failed to retry generation",
        details: error.message,
      });
    }
  });

  // ========================================
  // BACKGROUND PROCESSING: Media Generation (Phase 4)
  // ========================================

  /**
   * Background function to process chain workflow (Phase 5: Mode A)
   * Polls for image → analyzes with Vision → generates video → polls for video
   *
   * TIMEOUTS (per-step):
   * - Image generation: 3 minutes
   * - Image analysis: 2 minutes
   * - Video generation: 3 minutes
   * - Total chain: 10 minutes hard cap
   */
  async function processChainWorkflow(assetId: string): Promise<void> {
    const pollInterval = 15000; // 15 seconds (reduced from 30s for faster detection)
    const maxAttempts = 40; // 40 * 15s = 10 minutes max
    const startTime = Date.now();
    const timeoutMs = 10 * 60 * 1000; // 10 minutes hard cap for full chain
    let pollAttempts = 0;

    // ✅ LIFECYCLE LOG: Job polling started
    console.log(`[ugc] poll_start id=${assetId} mode=chain max_time=600s`);

    try {
      while (pollAttempts < maxAttempts) {
        // Check timeout
        const elapsed = Date.now() - startTime;
        const elapsedSeconds = Math.round(elapsed / 1000);

        if (elapsed > timeoutMs) {
          // ✅ LIFECYCLE LOG: Job timeout
          console.log(`[ugc] job_timeout id=${assetId} after=${elapsedSeconds}s reason=chain_timeout`);

          await ugcChainService.handleChainError(
            assetId,
            'error' as any,
            `Provider timeout after ${elapsedSeconds}s. Please try again.`
          );

          return;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        pollAttempts++;

        const asset = await storage.getMediaAsset(assetId);
        if (!asset) {
          console.log(`[ugc] job_failed id=${assetId} reason=asset_not_found`);
          return;
        }

        const chainMetadata = asset.chainMetadata as any;
        if (!chainMetadata) {
          console.log(`[ugc] job_failed id=${assetId} reason=no_chain_metadata`);
          await storage.updateMediaAsset(assetId, {
            status: 'error',
            errorMessage: 'Internal error: missing chain metadata',
          });
          return;
        }

        const step = chainMetadata.step;

        // ✅ LIFECYCLE LOG: Poll status
        console.log(`[ugc] poll_status id=${assetId} step=${step} elapsed=${elapsedSeconds}s attempt=${pollAttempts}/${maxAttempts}`);

        // Handle different chain steps
        // Per-step timeouts: 3 min image, 2 min analysis, 3 min video
        const STEP_TIMEOUT_MS = {
          generating_image: 3 * 60 * 1000,  // 3 minutes
          analyzing_image: 2 * 60 * 1000,   // 2 minutes
          generating_video: 3 * 60 * 1000,  // 3 minutes
        };

        if (step === 'generating_image') {
          const imageStartTime = chainMetadata.timestamps?.imageStarted;
          const imageElapsed = imageStartTime ? Date.now() - new Date(imageStartTime).getTime() : 0;

          if (imageElapsed > STEP_TIMEOUT_MS.generating_image) {
            console.log(`[ugc] step_timeout id=${assetId} step=generating_image after=${Math.round(imageElapsed/1000)}s`);

            // Attempt fallback to Veo3 instead of hard failure
            try {
              const productImageUrl = asset?.metadata && typeof asset.metadata === 'object' && 'productImageUrl' in asset.metadata
                ? (asset.metadata as any).productImageUrl
                : undefined;
              await ugcChainService.fallbackToVeo3(assetId, 'Image generation timeout', productImageUrl);
            } catch (fallbackError: any) {
              console.log(`[ugc] job_failed id=${assetId} reason=image_timeout_fallback_failed`);
              await ugcChainService.handleChainError(assetId, 'generating_image', `Image timeout + fallback failed`);
              return;
            }
          } else {
            // Poll for image completion
            try {
              const imageReady = await ugcChainService.checkImageStatus(assetId);
              if (imageReady) {
                console.log(`[ugc] step_complete id=${assetId} step=generating_image`);
              }
            } catch (err: any) {
              console.log(`[ugc] poll_error id=${assetId} step=generating_image error=${err.message}`);
            }
          }

        } else if (step === 'analyzing_image') {
          // ✅ NEW: Handle analyzing_image step (was missing!)
          const analysisStartTime = chainMetadata.timestamps?.imageCompleted; // Analysis starts when image completes
          const analysisElapsed = analysisStartTime ? Date.now() - new Date(analysisStartTime).getTime() : 0;

          if (analysisElapsed > STEP_TIMEOUT_MS.analyzing_image) {
            console.log(`[ugc] step_timeout id=${assetId} step=analyzing_image after=${Math.round(analysisElapsed/1000)}s`);
            await ugcChainService.handleChainError(assetId, 'analyzing_image', 'Image analysis timeout');
            return;
          }
          // Analysis is sync (OpenAI call), so if we're stuck here, it means the call hung
          // The ugcChainService.analyzeImage should have already moved to next step

        } else if (step === 'fallback_to_veo3') {
          // Fallback triggered - transition to video generation
          // The fallbackToVeo3 method already starts video generation
          // Just wait for next poll to detect generating_video state

        } else if (step === 'generating_video') {
          const videoStartTime = chainMetadata.timestamps?.videoStarted;
          const videoElapsed = videoStartTime ? Date.now() - new Date(videoStartTime).getTime() : 0;

          if (videoElapsed > STEP_TIMEOUT_MS.generating_video) {
            console.log(`[ugc] step_timeout id=${assetId} step=generating_video after=${Math.round(videoElapsed/1000)}s`);
            await ugcChainService.handleChainError(assetId, 'generating_video', 'Video generation timeout');
            return;
          }

          // Poll for video completion
          try {
            const videoReady = await ugcChainService.checkVideoStatus(assetId);
            if (videoReady) {
              // ✅ LIFECYCLE LOG: Job completed
              console.log(`[ugc] job_completed id=${assetId} elapsed=${elapsedSeconds}s`);
              return; // Chain complete
            }
          } catch (err: any) {
            console.log(`[ugc] poll_error id=${assetId} step=generating_video error=${err.message}`);
          }

        } else if (step === 'completed') {
          console.log(`[ugc] job_completed id=${assetId} elapsed=${elapsedSeconds}s (already)`);
          return;

        } else if (step === 'error') {
          console.log(`[ugc] job_failed id=${assetId} reason=${chainMetadata.error || 'unknown'}`);
          return;

        } else {
          // Unknown step - this shouldn't happen
          console.log(`[ugc] poll_unknown_step id=${assetId} step=${step}`);
        }

        // Continue polling
      }

      // Max attempts reached - fail the job
      console.log(`[ugc] job_timeout id=${assetId} after=${Math.round((Date.now() - startTime)/1000)}s reason=max_attempts`);
      await ugcChainService.handleChainError(assetId, 'error' as any, 'Provider timeout. Please try again.');

    } catch (error: any) {
      // ✅ LIFECYCLE LOG: Fatal error
      console.log(`[ugc] job_failed id=${assetId} reason=fatal_error error=${error.message}`);
      await ugcChainService.handleChainError(assetId, 'error' as any, error.message);
    }
  }

  /**
   * Background function to process media generation
   * Polls KIE API until complete with hard timeout
   *
   * TIMEOUT: 3 minutes for direct generation (Mode B/C)
   */
  async function processMediaGeneration(
    assetId: string,
    params: {
      provider: string;
      type: string;
      prompt: string;
      referenceImageUrl?: string;
      options?: any;
    }
  ): Promise<void> {
    // ✅ PHASE 5: Check if this is a chain workflow
    const asset = await storage.getMediaAsset(assetId);
    if (asset?.generationMode === 'nanobana+veo3') {
      return processChainWorkflow(assetId);
    }

    const maxAttempts = 24; // 24 * 15s = 6 minutes max (gives buffer)
    const pollInterval = 15000; // 15 seconds (faster detection)
    const timeoutMs = 3 * 60 * 1000; // 3 minutes hard timeout
    const startTime = Date.now();
    const maxRetries = 3;
    let retryCount = 0;

    // ✅ LIFECYCLE LOG: Job started
    console.log(`[ugc] job_created id=${assetId} provider=${params.provider} mode=direct`);

    try {
      // Step 1: Start generation
      let generationResult;
      let lastError: Error | null = null;

      // Retry loop for initial generation
      while (retryCount < maxRetries) {
        try {
          generationResult = await generateMedia(params);
          console.log('[Media Generation] Generation started:', {
            assetId,
            taskId: generationResult.taskId,
            status: generationResult.status,
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          retryCount++;
          console.error(`[Media Generation] Attempt ${retryCount}/${maxRetries} failed:`, error);

          if (retryCount < maxRetries) {
            const backoffDelay = retryCount * 2000; // 2s, 4s, 6s
            console.log(`[Media Generation] Retrying in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }

      // If all retries failed
      if (!generationResult) {
        throw lastError || new Error('Failed to start generation after retries');
      }

      // Update asset with taskId
      await storage.updateMediaAsset(assetId, {
        taskId: generationResult.taskId,
        status: generationResult.status,
        retryCount,
      });

      // If generation is already complete (e.g., Gemini Flash), update and return
      if (generationResult.status === 'ready' && generationResult.resultUrl) {
        await storage.updateMediaAsset(assetId, {
          status: 'ready',
          resultUrl: generationResult.resultUrl,
          completedAt: new Date(),
        });
        console.log('[Media Generation] Completed synchronously:', { assetId });
        return;
      }

      // ✅ FIX: Sora2 now uses polling WITH timeout failsafe
      // Previously: relied on webhooks only, which could hang forever if webhook fails
      // Now: poll with timeout, webhook can still update status early
      if (params.provider === 'sora2' || generationResult.provider === 'kie-sora2') {
        console.log(`[ugc] poll_start id=${assetId} provider=sora2 max_time=180s`);

        // Set a hard timeout for Sora2 jobs (3 minutes)
        const sora2TimeoutMs = 3 * 60 * 1000;
        let sora2PollAttempts = 0;
        const sora2MaxAttempts = 12; // 12 * 15s = 3 minutes

        while (sora2PollAttempts < sora2MaxAttempts) {
          const elapsed = Date.now() - startTime;
          const elapsedSeconds = Math.round(elapsed / 1000);

          if (elapsed > sora2TimeoutMs) {
            console.log(`[ugc] job_timeout id=${assetId} after=${elapsedSeconds}s reason=sora2_timeout`);
            await storage.updateMediaAsset(assetId, {
              status: 'error',
              errorMessage: 'Provider timeout. Please try again.',
            });
            return;
          }

          await new Promise(resolve => setTimeout(resolve, pollInterval));
          sora2PollAttempts++;

          // Check if webhook already updated the status
          const currentAsset = await storage.getMediaAsset(assetId);
          console.log(`[ugc] poll_status id=${assetId} status=${currentAsset?.status} elapsed=${elapsedSeconds}s`);

          if (currentAsset?.status === 'ready') {
            console.log(`[ugc] job_completed id=${assetId} elapsed=${elapsedSeconds}s`);
            return;
          }
          if (currentAsset?.status === 'error' || currentAsset?.status === 'failed') {
            console.log(`[ugc] job_failed id=${assetId} reason=${currentAsset?.errorMessage || 'unknown'}`);
            return;
          }

          // Also poll KIE directly in case webhook is delayed
          try {
            const statusResult = await checkMediaStatus(generationResult.taskId, 'kie-sora2' as any);
            if (statusResult.status === 'ready' && statusResult.resultUrl) {
              await storage.updateMediaAsset(assetId, {
                status: 'ready',
                resultUrl: statusResult.resultUrl,
                completedAt: new Date(),
              });
              console.log(`[ugc] job_completed id=${assetId} elapsed=${elapsedSeconds}s (via poll)`);
              return;
            }
            if (statusResult.status === 'failed') {
              await storage.updateMediaAsset(assetId, {
                status: 'error',
                errorMessage: statusResult.metadata?.errorMessage || 'Provider error',
              });
              console.log(`[ugc] job_failed id=${assetId} reason=sora2_provider_error`);
              return;
            }
          } catch (pollErr: any) {
            console.log(`[ugc] poll_error id=${assetId} error=${pollErr.message}`);
            // Continue polling, don't fail immediately
          }
        }

        // Max attempts reached
        console.log(`[ugc] job_timeout id=${assetId} after=${Math.round((Date.now() - startTime)/1000)}s reason=sora2_max_attempts`);
        await storage.updateMediaAsset(assetId, {
          status: 'error',
          errorMessage: 'Provider timeout. Please try again.',
        });
        return;
      }

      // Step 2: Poll for completion (Veo3)
      let pollAttempts = 0;
      console.log(`[ugc] poll_start id=${assetId} provider=${params.provider} max_time=180s`);

      while (pollAttempts < maxAttempts) {
        const elapsed = Date.now() - startTime;
        const elapsedSeconds = Math.round(elapsed / 1000);

        // Check timeout
        if (elapsed > timeoutMs) {
          console.log(`[ugc] job_timeout id=${assetId} after=${elapsedSeconds}s reason=veo3_timeout`);
          await storage.updateMediaAsset(assetId, {
            status: 'error',
            errorMessage: 'Provider timeout. Please try again.',
          });
          return;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        pollAttempts++;

        // ✅ LIFECYCLE LOG: Poll status
        console.log(`[ugc] poll_status id=${assetId} attempt=${pollAttempts}/${maxAttempts} elapsed=${elapsedSeconds}s`);

        try {
          const statusResult = await checkMediaStatus(
            generationResult.taskId,
            params.provider as any
          );

          // Handle completion
          if (statusResult.status === 'ready') {
            const resultUrls = statusResult.resultUrls || [];

            // Validate we have at least one URL
            if (resultUrls.length === 0) {
              // Ready but no URLs - continue polling
              continue;
            }

            const finalResultUrl = resultUrls[0];

            await storage.updateMediaAsset(assetId, {
              status: 'ready',
              resultUrl: finalResultUrl,
              completedAt: new Date(),
              resultUrls: resultUrls,
            });

            // ✅ LIFECYCLE LOG: Job completed
            console.log(`[ugc] job_completed id=${assetId} elapsed=${elapsedSeconds}s`);
            return;
          }

          if (statusResult.status === 'failed' || statusResult.status === 'error') {
            await storage.updateMediaAsset(assetId, {
              status: 'error',
              errorMessage: statusResult.metadata?.errorMessage || 'Provider error',
            });

            // ✅ LIFECYCLE LOG: Job failed
            console.log(`[ugc] job_failed id=${assetId} reason=provider_error`);
            return;
          }

          // Still processing - continue polling
        } catch (error: any) {
          console.log(`[ugc] poll_error id=${assetId} error=${error.message}`);

          // Don't fail immediately on polling errors, just log and continue
          // Only fail if we've exhausted all attempts
          if (pollAttempts >= maxAttempts) {
            throw error;
          }
        }
      }

      // Max polling attempts reached
      console.log(`[ugc] job_timeout id=${assetId} after=${Math.round((Date.now() - startTime)/1000)}s reason=max_attempts`);
      await storage.updateMediaAsset(assetId, {
        status: 'error',
        errorMessage: 'Provider timeout. Please try again.',
      });

    } catch (error: any) {
      // ✅ LIFECYCLE LOG: Fatal error
      console.log(`[ugc] job_failed id=${assetId} reason=fatal_error error=${error.message}`);

      // Update asset with error status
      try {
        await storage.updateMediaAsset(assetId, {
          status: 'error',
          errorMessage: error.message || 'Unknown error occurred',
        });
      } catch (updateError) {
        console.log(`[ugc] db_error id=${assetId} error=failed_to_update_status`);
      }
    }
  }

  // ========================================
  // AI CAPTION GENERATION ENDPOINTS (Phase 2)
  // ========================================

  // GET /api/user/caption-settings - Get user's caption generation settings
  app.get("/api/user/caption-settings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        systemPrompt: user.captionSystemPrompt || "Write an engaging Instagram caption for this video. Be creative, use relevant emojis, and include a call-to-action.",
        autoGenerate: user.captionAutoGenerate === "true",
      });
    } catch (error: any) {
      console.error("[Caption Settings] Error fetching settings:", error);
      res.status(500).json({
        error: "Failed to fetch caption settings",
        details: error.message,
      });
    }
  });

  // PUT /api/user/caption-settings - Update user's caption generation settings
  app.put("/api/user/caption-settings", requireAuth, async (req, res) => {
    try {
      const { updateCaptionSettingsSchema } = await import("./validators/caption.js");
      const validation = updateCaptionSettingsSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors,
        });
      }

      const { systemPrompt, autoGenerate } = validation.data;
      const updates: any = {};

      if (systemPrompt !== undefined) {
        updates.captionSystemPrompt = systemPrompt;
      }

      if (autoGenerate !== undefined) {
        updates.captionAutoGenerate = autoGenerate ? "true" : "false";
      }

      const updatedUser = await storage.updateUser(req.userId!, updates);

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`[Caption Settings] Updated for user ${req.userId}`);

      res.json({
        success: true,
        systemPrompt: updatedUser.captionSystemPrompt,
        autoGenerate: updatedUser.captionAutoGenerate === "true",
      });
    } catch (error: any) {
      console.error("[Caption Settings] Error updating settings:", error);
      res.status(500).json({
        error: "Failed to update caption settings",
        details: error.message,
      });
    }
  });

  // POST /api/caption/generate - Generate AI caption for a specific project
  app.post("/api/caption/generate", requireAuth, checkCredits('caption_generate'), async (req, res) => {
    try {
      const { generateCaptionSchema } = await import("./validators/caption.js");
      const validation = generateCaptionSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors,
        });
      }

      const { projectId, customPrompt } = validation.data;

      // Get the project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Verify ownership
      const task = await storage.getTask(project.taskId);
      if (!task || task.userId !== req.userId) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get user's caption settings
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`[Caption Generate] Generating caption for project ${projectId}`);

      // Generate caption using OpenAI
      const { openaiService } = await import("./services/openai.js");
      const result = await openaiService.generateCaption({
        projectName: project.name,
        customPrompt,
        userSystemPrompt: user.captionSystemPrompt || undefined,
      });

      // Deduct credits after successful caption generation (Phase 9: XPAND Credits)
      await deductCreditsFromRequest(req, { projectId, type: 'caption' });

      res.json({
        success: true,
        caption: result.caption,
        metadata: result.metadata,
      });
    } catch (error: any) {
      console.error("[Caption Generate] Error generating caption:", error);
      res.status(500).json({
        error: "Failed to generate caption",
        details: error.message,
      });
    }
  });

  // ========================================
  // XPAND CREDITS API ENDPOINTS (Phase 9)
  // ========================================

  // GET /api/credits - Get user's current credit balance and stats
  app.get('/api/credits', requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;

      // Get or initialize user credits
      let credits = await creditService.getUserCredits(userId);
      if (!credits) {
        credits = await creditService.initializeUserCredits(userId);
      }

      res.json({
        balance: credits.balance,
        lifetimePurchased: credits.lifetimePurchased,
        lifetimeUsed: credits.lifetimeUsed,
      });
    } catch (error: any) {
      console.error('[Credits] Error fetching balance:', error);
      res.status(500).json({ error: 'Failed to fetch credit balance', details: error.message });
    }
  });

  // GET /api/credits/history - Get user's credit transaction history
  app.get('/api/credits/history', requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const limit = parseInt(req.query.limit as string) || 50;

      const transactions = await creditService.getTransactionHistory(userId, limit);

      res.json({ transactions });
    } catch (error: any) {
      console.error('[Credits] Error fetching history:', error);
      res.status(500).json({ error: 'Failed to fetch transaction history', details: error.message });
    }
  });

  // GET /api/credits/packages - Get available credit packages for purchase
  app.get('/api/credits/packages', async (req, res) => {
    res.json({ packages: creditService.CREDIT_PACKAGES });
  });

  // POST /api/credits/purchase - Create Stripe checkout session for credit purchase
  app.post('/api/credits/purchase', requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { packageId } = req.body;

      if (!packageId) {
        return res.status(400).json({ error: 'packageId is required' });
      }

      // Validate package exists
      const creditPackage = creditService.getCreditPackage(packageId);
      if (!creditPackage) {
        return res.status(400).json({
          error: 'Invalid package',
          validPackages: creditService.CREDIT_PACKAGES.map(p => p.id),
        });
      }

      // Get user email
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(404).json({ error: 'User not found or missing email' });
      }

      // Build success/cancel URLs
      const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');
      const frontendUrl = process.env.FRONTEND_URL || origin || 'http://localhost:5000';
      const successUrl = `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontendUrl}/settings/billing`;

      console.log('[Credits Purchase] Creating checkout:', {
        userId,
        packageId,
        credits: creditPackage.credits,
        priceUsd: creditPackage.priceUsd,
      });

      // Create Stripe checkout session
      const session = await stripeService.createCreditCheckoutSession({
        userId,
        userEmail: user.email,
        packageId,
        successUrl,
        cancelUrl,
      });

      res.json({
        success: true,
        sessionId: session.sessionId,
        url: session.url,
        package: {
          id: creditPackage.id,
          name: creditPackage.name,
          credits: creditPackage.credits,
          priceUsd: creditPackage.priceUsd,
        },
      });
    } catch (error: any) {
      console.error('[Credits Purchase] Error:', error);
      res.status(500).json({
        error: 'Failed to create checkout session',
        details: error.message,
      });
    }
  });

  // GET /api/credits/pricing - Get feature credit costs
  app.get('/api/credits/pricing', async (req, res) => {
    try {
      const pricing = await creditService.getAllPricing();
      res.json({ pricing });
    } catch (error: any) {
      console.error('[Credits] Error fetching pricing:', error);
      res.status(500).json({ error: 'Failed to fetch pricing', details: error.message });
    }
  });

  // ========================================
  // ADMIN CREDITS API ENDPOINTS (Phase 9)
  // ========================================

  // Admin middleware (uses isAdminEmail helper defined at top of file)
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await storage.getUser(userId);
      if (!user || !isAdminEmail(user.email)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      next();
    } catch (error) {
      console.error('[Admin Auth] Error:', error);
      res.status(500).json({ error: 'Admin authentication failed' });
    }
  };

  // GET /api/admin/credits/pricing - Get all feature pricing (admin)
  app.get('/api/admin/credits/pricing', requireAuth, requireAdmin, async (req, res) => {
    try {
      const pricing = await creditService.getAllPricing();
      res.json({ pricing });
    } catch (error: any) {
      console.error('[Admin] Error fetching pricing:', error);
      res.status(500).json({ error: 'Failed to fetch pricing', details: error.message });
    }
  });

  // PUT /api/admin/credits/pricing/:featureKey - Update feature pricing (admin)
  app.put('/api/admin/credits/pricing/:featureKey', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { featureKey } = req.params;
      const { creditCost, baseCostUsd, isActive } = req.body;

      const updated = await creditService.updateFeaturePricing(featureKey, {
        creditCost,
        baseCostUsd,
        isActive,
      });

      if (!updated) {
        return res.status(404).json({ error: 'Feature not found' });
      }

      res.json({ success: true, pricing: updated });
    } catch (error: any) {
      console.error('[Admin] Error updating pricing:', error);
      res.status(500).json({ error: 'Failed to update pricing', details: error.message });
    }
  });

  // GET /api/admin/credits/settings - Get global credit settings (admin)
  app.get('/api/admin/credits/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await creditService.getGlobalSettings();
      res.json({ settings });
    } catch (error: any) {
      console.error('[Admin] Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
    }
  });

  // PUT /api/admin/credits/settings - Update global credit settings (admin)
  app.put('/api/admin/credits/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { markupFactor, pricePerCreditUsd } = req.body;

      if (markupFactor === undefined || pricePerCreditUsd === undefined) {
        return res.status(400).json({ error: 'markupFactor and pricePerCreditUsd are required' });
      }

      const settings = await creditService.updateGlobalSettings(markupFactor, pricePerCreditUsd);
      res.json({ success: true, settings });
    } catch (error: any) {
      console.error('[Admin] Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings', details: error.message });
    }
  });

  // POST /api/admin/credits/:userId - Add credits to a user (admin)
  app.post('/api/admin/credits/:userId', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { amount, reason } = req.body;

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Valid positive amount is required' });
      }

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'Reason is required' });
      }

      // Verify target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const transaction = await creditService.adminAddCredits(userId, amount, reason);
      const balance = await creditService.getBalance(userId);

      res.json({
        success: true,
        transaction,
        newBalance: balance,
      });
    } catch (error: any) {
      console.error('[Admin] Error adding credits:', error);
      res.status(500).json({ error: 'Failed to add credits', details: error.message });
    }
  });

  // GET /api/admin/credits/:userId/history - Get user's credit history (admin)
  app.get('/api/admin/credits/:userId/history', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      // Verify target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const transactions = await creditService.getTransactionHistory(userId, limit);
      const credits = await creditService.getUserCredits(userId);

      res.json({
        user: { id: targetUser.id, email: targetUser.email, fullName: targetUser.fullName },
        balance: credits?.balance ?? 0,
        transactions,
      });
    } catch (error: any) {
      console.error('[Admin] Error fetching user history:', error);
      res.status(500).json({ error: 'Failed to fetch user history', details: error.message });
    }
  });

  // ========================================
  // ADMIN STRIPE SETTINGS ENDPOINTS
  // ========================================

  // GET /api/admin/stripe - Get Stripe settings (admin)
  app.get('/api/admin/stripe', requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getStripeSettings();
      // Mask sensitive keys for display (only show last 4 chars)
      const maskedSettings = settings ? {
        id: settings.id,
        publishableKey: settings.publishableKey,
        secretKey: settings.secretKey ? `sk_****${settings.secretKey.slice(-4)}` : null,
        webhookSecret: settings.webhookSecret ? `whsec_****${settings.webhookSecret.slice(-4)}` : null,
        priceIdStarter: settings.priceIdStarter,
        priceIdBasic: settings.priceIdBasic,
        priceIdPro: settings.priceIdPro,
        priceIdBusiness: settings.priceIdBusiness,
      } : null;
      res.json({ settings: maskedSettings });
    } catch (error: any) {
      console.error('[Admin] Error fetching Stripe settings:', error);
      res.status(500).json({ error: 'Failed to fetch Stripe settings', details: error.message });
    }
  });

  // PUT /api/admin/stripe - Update Stripe settings (admin)
  app.put('/api/admin/stripe', requireAuth, requireAdmin, async (req, res) => {
    try {
      const {
        publishableKey,
        secretKey,
        webhookSecret,
        priceIdStarter,
        priceIdBasic,
        priceIdPro,
        priceIdBusiness,
      } = req.body;

      // Only update fields that are provided (not empty strings with masked values)
      const updates: any = {};
      if (publishableKey !== undefined && !publishableKey.includes('****')) {
        updates.publishableKey = publishableKey || null;
      }
      if (secretKey !== undefined && !secretKey.includes('****')) {
        updates.secretKey = secretKey || null;
      }
      if (webhookSecret !== undefined && !webhookSecret.includes('****')) {
        updates.webhookSecret = webhookSecret || null;
      }
      if (priceIdStarter !== undefined) {
        updates.priceIdStarter = priceIdStarter || null;
      }
      if (priceIdBasic !== undefined) {
        updates.priceIdBasic = priceIdBasic || null;
      }
      if (priceIdPro !== undefined) {
        updates.priceIdPro = priceIdPro || null;
      }
      if (priceIdBusiness !== undefined) {
        updates.priceIdBusiness = priceIdBusiness || null;
      }

      const updatedSettings = await storage.updateStripeSettings(updates);
      res.json({ success: true, settings: updatedSettings });
    } catch (error: any) {
      console.error('[Admin] Error updating Stripe settings:', error);
      res.status(500).json({ error: 'Failed to update Stripe settings', details: error.message });
    }
  });

  // ========================================
  // BRAND SETTINGS ENDPOINTS (Dec 2025)
  // ========================================

  // GET /api/admin/brand - Get brand settings (admin only)
  app.get('/api/admin/brand', requireAuth, requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getBrandSettings();
      res.json({
        appName: settings?.appName || 'Streamline',
      });
    } catch (error: any) {
      console.error('[Admin] Error fetching brand settings:', error);
      res.status(500).json({ error: 'Failed to fetch brand settings', details: error.message });
    }
  });

  // PUT /api/admin/brand - Update brand settings (admin only)
  app.put('/api/admin/brand', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { appName } = req.body;

      if (!appName || typeof appName !== 'string' || appName.trim().length === 0) {
        return res.status(400).json({ error: 'App name is required' });
      }

      if (appName.length > 50) {
        return res.status(400).json({ error: 'App name must be 50 characters or less' });
      }

      const updatedSettings = await storage.updateBrandSettings({ appName: appName.trim() });
      console.log(`[Admin] Brand settings updated: appName="${appName.trim()}"`);

      res.json({
        success: true,
        appName: updatedSettings?.appName || appName.trim(),
      });
    } catch (error: any) {
      console.error('[Admin] Error updating brand settings:', error);
      res.status(500).json({ error: 'Failed to update brand settings', details: error.message });
    }
  });

  // ========================================
  // STRIPE SUBSCRIPTION BILLING ENDPOINTS
  // ========================================

  // POST /api/stripe/create-checkout-session - Create Stripe checkout session for Pro upgrade
  app.post('/api/stripe/create-checkout-session', requireAuth, async (req, res) => {
    try {
      const userId = req.userId;

      // Mobile Debug: Log request headers and auth state
      const isMobile = /Mobile|Android|iPhone|iPad/i.test(req.headers['user-agent'] || '');
      console.log('[Stripe Checkout Mobile Debug]', {
        userId,
        isMobile,
        userAgent: req.headers['user-agent']?.substring(0, 100),
        hasAuthHeader: !!req.headers.authorization,
        authHeaderPrefix: req.headers.authorization?.substring(0, 20),
      });

      if (!userId) {
        console.error('[Stripe Checkout] CRITICAL: req.userId is null after auth middleware');
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log('[Stripe Checkout] Creating session for user:', userId);

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        console.error('[Stripe Checkout] CRITICAL: User not found in database:', userId);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('[Stripe Checkout] User retrieved:', {
        userId: user.id,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
      });

      // Check if user already has Pro subscription
      if (user.subscriptionStatus === 'pro') {
        console.log('[Stripe Checkout] User already has Pro subscription:', userId);
        return res.status(400).json({
          error: 'You already have an active Pro subscription',
        });
      }

      // Detect frontend URL for success/cancel redirects
      const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');
      const frontendUrl = process.env.FRONTEND_URL || origin || 'http://localhost:5000';

      const successUrl = `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontendUrl}/billing/cancel`;

      // Create Stripe Checkout Session
      const { sessionId, url } = await stripeService.createCheckoutSession({
        userId,
        userEmail: user.email,
        successUrl,
        cancelUrl,
      });

      console.log('[Stripe Checkout] Session created:', {
        userId,
        sessionId,
        redirectUrl: url.substring(0, 50) + '...',
      });

      res.json({
        success: true,
        sessionId,
        url,
      });
    } catch (error: any) {
      console.error('[Stripe Checkout] Error:', error);
      res.status(500).json({
        error: error.message || 'Failed to create checkout session',
      });
    }
  });

  // POST /api/stripe/webhook - Handle Stripe webhook events (PUBLIC endpoint)
  // IMPORTANT: Uses raw body for signature verification
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
      // Verify webhook signature
      const event = stripeService.verifyWebhookSignature(req.body, signature as string);

      console.log('[Stripe Webhook] Received event:', {
        eventId: event.id,
        eventType: event.type,
        created: new Date(event.created * 1000).toISOString(),
      });

      // Check idempotency - have we already processed this event?
      const existingEvent = await db
        .select()
        .from(stripeEvents)
        .where(eq(stripeEvents.eventId, event.id))
        .limit(1);

      if (existingEvent.length > 0) {
        console.log('[Stripe Webhook] Event already processed:', event.id);
        return res.json({ received: true, status: 'already_processed' });
      }

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutCompleted(session);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdated(subscription);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(subscription);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          await handlePaymentFailed(invoice);
          break;
        }

        default:
          console.log('[Stripe Webhook] Unhandled event type:', event.type);
      }

      // Mark event as processed (idempotency)
      await db.insert(stripeEvents).values({
        eventId: event.id,
        eventType: event.type,
        processedAt: new Date(),
      });

      console.log('[Stripe Webhook] Event processed successfully:', event.id);
      res.json({ received: true });
    } catch (error: any) {
      console.error('[Stripe Webhook] Error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/stripe/create-portal-session - Create Stripe Customer Portal session
  app.post('/api/stripe/create-portal-session', requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({
          error: 'No Stripe customer found. Please subscribe first.',
        });
      }

      // Detect frontend URL for return URL
      const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');
      const frontendUrl = process.env.FRONTEND_URL || origin || 'http://localhost:5000';
      const returnUrl = `${frontendUrl}/settings/billing`;

      const portalUrl = await stripeService.createPortalSession(
        user.stripeCustomerId,
        returnUrl
      );

      console.log('[Stripe Portal] Session created for user:', userId);

      res.json({
        success: true,
        url: portalUrl,
      });
    } catch (error: any) {
      console.error('[Stripe Portal] Error:', error);
      res.status(500).json({
        error: error.message || 'Failed to create portal session',
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// ========================================
// STRIPE WEBHOOK EVENT HANDLERS
// ========================================

/**
 * Handle successful checkout - grant credits (Phase 9: XPAND Credits)
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;

  if (!userId) {
    console.error('[Stripe Webhook] Missing client_reference_id in checkout session');
    return;
  }

  // Check if this is a credit purchase (Phase 9)
  const metadata = session.metadata || {};
  const isCreditPurchase = metadata.type === 'credit_purchase';

  console.log('[Stripe Webhook] Checkout completed:', {
    userId,
    customerId: session.customer,
    isCreditPurchase,
    metadata,
  });

  if (isCreditPurchase) {
    // Phase 9: Grant credits to user
    const credits = parseInt(metadata.credits || '0', 10);
    const packageId = metadata.packageId;

    if (credits <= 0) {
      console.error('[Stripe Webhook] Invalid credit amount in metadata:', metadata);
      return;
    }

    // Add credits to user
    const transaction = await creditService.addCredits(
      userId,
      credits,
      `Purchased ${packageId} credit pack`,
      session.id,
      { packageId, stripeSessionId: session.id }
    );

    // Update user's Stripe customer ID if not set
    if (session.customer) {
      await storage.updateUser(userId, {
        stripeCustomerId: session.customer as string,
      });
    }

    console.log('[Stripe Webhook] Credits granted:', {
      userId,
      credits,
      packageId,
      transactionId: transaction.id,
      newBalance: transaction.balanceAfter,
    });
  } else {
    // Legacy: Subscription checkout (kept for backwards compatibility)
    console.log('[Stripe Webhook] Legacy subscription checkout detected');

    await storage.updateUser(userId, {
      stripeCustomerId: session.customer as string,
      subscriptionStatus: 'pro',
      subscriptionEndsAt: null,
    });

    console.log('[Stripe Webhook] User upgraded to Pro (legacy):', userId);
  }
}

/**
 * Handle subscription updated (renewal, plan change, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in subscription metadata');
    return;
  }

  console.log('[Stripe Webhook] Subscription updated:', {
    userId,
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  });

  // Update subscription status and end date
  const subscriptionStatus = subscription.status === 'active' ? 'pro' : 'free';
  const subscriptionEndsAt = new Date(subscription.current_period_end * 1000);

  await storage.updateUser(userId, {
    subscriptionStatus,
    subscriptionEndsAt,
  });

  console.log('[Stripe Webhook] User subscription updated:', {
    userId,
    status: subscriptionStatus,
    endsAt: subscriptionEndsAt.toISOString(),
  });
}

/**
 * Handle subscription deleted (cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in subscription metadata');
    return;
  }

  console.log('[Stripe Webhook] Subscription deleted:', {
    userId,
    subscriptionId: subscription.id,
  });

  // Downgrade user to free tier
  await storage.updateUser(userId, {
    subscriptionStatus: 'free',
    subscriptionEndsAt: null,
  });

  console.log('[Stripe Webhook] User downgraded to free:', userId);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  console.log('[Stripe Webhook] Payment failed:', {
    customerId,
    invoiceId: invoice.id,
    amountDue: invoice.amount_due,
  });

  // Find user by Stripe Customer ID
  const allUsers = await db.query.users.findMany();
  const user = allUsers.find(u => u.stripeCustomerId === customerId);

  if (!user) {
    console.error('[Stripe Webhook] User not found for customer:', customerId);
    return;
  }

  // Mark subscription as past_due (Stripe will retry payment)
  await storage.updateUser(user.id, {
    subscriptionStatus: 'past_due',
  });

  console.log('[Stripe Webhook] User marked as past_due:', user.id);

  // TODO: Send email notification about failed payment
}

// Background processing functions
async function processVideoTask(taskId: string) {
  try {
    let attempts = 0;
    const maxAttempts = 60; // 30 minutes (30 second intervals)

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds

      const klapStatus = await klapService.getTaskStatus(taskId);

      await storage.updateTask(taskId, {
        status: klapStatus.status,
        outputId: klapStatus.output_id || null,
        errorMessage: klapStatus.error || null,
        klapResponse: klapStatus as any,
      });

      if (klapStatus.status === "ready") {
        if (klapStatus.output_id) {
          // Fetch task to get userId
          const task = await storage.getTask(taskId);
          if (!task) {
            throw new Error(`Task ${taskId} not found`);
          }

          await fetchAndStoreProjects(taskId, klapStatus.output_id, task.userId);

          // Check if auto-export was requested
          if (task && task.autoExportRequested === "true") {
            console.log(
              `Auto-export requested for task ${taskId}, starting pipeline...`,
            );
            runAutoExportPipeline(taskId, klapStatus.output_id).catch(
              console.error,
            );
          }
        }
        break;
      } else if (klapStatus.status === "error") {
        break;
      }

      attempts++;
    }
  } catch (error) {
    console.error("Error processing video task:", error);
    await storage.updateTask(taskId, {
      status: "error",
      errorMessage:
        error instanceof Error ? error.message : "Processing failed",
    });
  }
}

async function fetchAndStoreProjects(taskId: string, folderId: string, userId: string) {
  try {
    // Check if folder exists, create if not
    const existingFolder = await storage.getFolder(folderId);
    if (!existingFolder) {
      await storage.createFolder({
        id: folderId,
        taskId,
        userId,
      });
    }

    // Fetch projects from Klap
    const klapProjects = await klapService.getProjects(folderId, taskId);

    // Store projects
    for (const klapProject of klapProjects) {
      const existingProject = await storage.getProject(klapProject.id);
      if (!existingProject) {
        await storage.createProject({
          id: klapProject.id,
          folderId,
          taskId,
          userId,
          name: klapProject.name,
          viralityScore: klapProject.virality_score || null,
          previewUrl: `https://klap.app/player/${klapProject.id}`,
          klapResponse: klapProject as any,
        });
      }
    }
  } catch (error) {
    console.error("Error fetching and storing projects:", error);
    throw error;
  }
}

async function pollExportStatus(
  exportId: string,
  folderId: string,
  projectId: string,
  taskId: string,
) {
  try {
    let attempts = 0;
    const maxAttempts = 40; // 10 minutes (15 second intervals)

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

      const exportStatus = await klapService.getExportStatus(
        folderId,
        projectId,
        exportId,
        taskId,
      );

      await storage.updateExport(exportId, {
        status: exportStatus.status,
        srcUrl: exportStatus.src_url || null,
        errorMessage: exportStatus.error || null,
        klapResponse: exportStatus as any,
      });

      if (exportStatus.status === "ready" || exportStatus.status === "error") {
        break;
      }

      attempts++;
    }
  } catch (error) {
    console.error("Error polling export status:", error);
    await storage.updateExport(exportId, {
      status: "error",
      errorMessage:
        error instanceof Error ? error.message : "Export polling failed",
    });
  }
}

// Auto-export pipeline - exports all projects automatically after task completes
async function runAutoExportPipeline(taskId: string, folderId: string) {
  try {
    console.log(`[Auto-Export] Starting pipeline for task ${taskId}`);

    // Update task status
    await storage.updateTask(taskId, {
      autoExportStatus: "processing",
    });

    // Get all projects for this task
    const projects = await storage.getProjectsByTask(taskId);

    if (projects.length === 0) {
      console.log(`[Auto-Export] No projects found for task ${taskId}`);
      await storage.updateTask(taskId, {
        autoExportStatus: "ready",
        autoExportCompletedAt: new Date(),
      });
      return;
    }

    console.log(`[Auto-Export] Found ${projects.length} projects to export`);

    const exportResults = [];
    let successCount = 0;
    let errorCount = 0;

    // Export each project sequentially
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      console.log(
        `[Auto-Export] Exporting project ${i + 1}/${projects.length}: ${project.id}`,
      );

      try {
        // Check if export already exists
        const existingExports = await storage.getExportsByTask(taskId);
        const existingExport = existingExports.find(
          (e) => e.projectId === project.id,
        );

        if (existingExport) {
          console.log(
            `[Auto-Export] Export already exists for project ${project.id}, skipping`,
          );
          if (existingExport.status === "ready") successCount++;
          else if (existingExport.status === "error") errorCount++;
          continue;
        }

        // Create export
        const exportResponse = await klapService.createExport(
          project.folderId,
          project.id,
          taskId,
        );

        const exportData = await storage.createExport({
          id: exportResponse.id,
          projectId: project.id,
          folderId: project.folderId,
          taskId,
          userId: project.userId,
          status: exportResponse.status,
          srcUrl: exportResponse.src_url || null,
          errorMessage: exportResponse.error || null,
          klapResponse: exportResponse as any,
          isAutoExport: "true",
        });

        // Poll export status synchronously (wait for completion)
        await pollExportStatusSync(
          exportData.id,
          project.folderId,
          project.id,
          taskId,
        );

        // Check final status
        const finalExport = await storage.getExport(exportData.id);
        if (finalExport?.status === "ready") {
          successCount++;
          console.log(
            `[Auto-Export] Export ${i + 1}/${projects.length} completed successfully`,
          );
        } else {
          errorCount++;
          console.log(
            `[Auto-Export] Export ${i + 1}/${projects.length} failed`,
          );
        }

        exportResults.push({
          projectId: project.id,
          exportId: exportData.id,
          status: finalExport?.status,
        });
      } catch (error) {
        errorCount++;
        console.error(
          `[Auto-Export] Error exporting project ${project.id}:`,
          error,
        );
        exportResults.push({
          projectId: project.id,
          error: error instanceof Error ? error.message : "Export failed",
        });
      }
    }

    // Update final task status
    const finalStatus =
      errorCount === 0 ? "ready" : successCount > 0 ? "partial_error" : "error";
    const errorMessage =
      errorCount > 0
        ? `${errorCount} of ${projects.length} exports failed`
        : null;

    await storage.updateTask(taskId, {
      autoExportStatus: finalStatus,
      autoExportError: errorMessage,
      autoExportCompletedAt: new Date(),
    });

    console.log(
      `[Auto-Export] Pipeline complete for task ${taskId}: ${successCount} succeeded, ${errorCount} failed`,
    );
  } catch (error) {
    console.error(`[Auto-Export] Pipeline failed for task ${taskId}:`, error);
    await storage.updateTask(taskId, {
      autoExportStatus: "error",
      autoExportError:
        error instanceof Error ? error.message : "Auto-export pipeline failed",
      autoExportCompletedAt: new Date(),
    });
  }
}

// Synchronous export polling (waits for completion)
async function pollExportStatusSync(
  exportId: string,
  folderId: string,
  projectId: string,
  taskId: string,
) {
  try {
    let attempts = 0;
    const maxAttempts = 40; // 10 minutes (15 second intervals)

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

      const exportStatus = await klapService.getExportStatus(
        folderId,
        projectId,
        exportId,
        taskId,
      );

      await storage.updateExport(exportId, {
        status: exportStatus.status,
        srcUrl: exportStatus.src_url || null,
        errorMessage: exportStatus.error || null,
        klapResponse: exportStatus as any,
      });

      if (exportStatus.status === "ready" || exportStatus.status === "error") {
        return exportStatus;
      }

      attempts++;
    }

    // Timeout
    await storage.updateExport(exportId, {
      status: "error",
      errorMessage: "Export timeout after 10 minutes",
    });

    return { status: "error", error: "Export timeout" };
  } catch (error) {
    console.error("Error polling export status:", error);
    await storage.updateExport(exportId, {
      status: "error",
      errorMessage:
        error instanceof Error ? error.message : "Export polling failed",
    });
    throw error;
  }
}

// Complete workflow following exact script pattern
async function processCompleteWorkflow(taskId: string) {
  try {
    console.log(`[Workflow] Starting complete workflow for task ${taskId}`);

    // Step 1: Poll task until complete (following script pattern)
    let attempts = 0;
    const maxAttempts = 60; // 30 minutes

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 seconds

      const klapStatus = await klapService.getTaskStatus(taskId);

      await storage.updateTask(taskId, {
        status: klapStatus.status,
        outputId: klapStatus.output_id || null,
        errorMessage: klapStatus.error || null,
        klapResponse: klapStatus as any,
      });

      console.log(`[Workflow] Task ${taskId} status: ${klapStatus.status}`);

      if (klapStatus.status === "ready") {
        if (!klapStatus.output_id) {
          throw new Error("Task ready but no output_id");
        }

        const folderId = klapStatus.output_id;
        console.log(`[Workflow] Task complete. Folder ID: ${folderId}`);

        // Fetch task to get userId and check for email
        const task = await storage.getTask(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        // Send email notification if email was provided
        if (task.email) {
          try {
            const detailsUrl = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/details/${taskId}`;
            await fetch(
              "https://n8n-familyconnection.agentglu.agency/webhook/6c65c59a-8283-47ea-b773-df5bc536b197",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  email: task.email,
                  linkToVideoDetails: detailsUrl,
                }),
              },
            );
            console.log(`[Workflow] Email notification sent to ${task.email}`);
          } catch (emailError) {
            console.error(`[Workflow] Failed to send email notification:`, emailError);
          }
        }

        // Step 2: Get projects (following script)
        await fetchAndStoreProjects(taskId, folderId, task.userId);

        const projects = await storage.getProjectsByTask(taskId);

        if (projects.length === 0) {
          throw new Error("No projects found");
        }

        console.log(`[Workflow] Generated ${projects.length} projects`);

        // Step 3: Export first project (following script)
        const firstProject = projects[0];
        console.log(`[Workflow] Exporting first project: ${firstProject.id}`);

        await storage.updateTask(taskId, {
          autoExportStatus: "processing",
        });

        const exportResponse = await klapService.createExport(
          folderId,
          firstProject.id,
          taskId,
        );

        const exportData = await storage.createExport({
          id: exportResponse.id,
          projectId: firstProject.id,
          folderId,
          taskId,
          userId: task.userId,
          status: exportResponse.status,
          srcUrl: exportResponse.src_url || null,
          errorMessage: exportResponse.error || null,
          klapResponse: exportResponse as any,
          isAutoExport: "true",
        });

        console.log(`[Workflow] Export started: ${exportData.id}`);

        // Step 4: Poll export until complete (following script)
        const finalExport = await pollExportStatusSync(
          exportData.id,
          folderId,
          firstProject.id,
          taskId,
        );

        if (finalExport.status === "ready") {
          const srcUrl = "src_url" in finalExport ? finalExport.src_url : null;
          console.log(`[Workflow] Export complete! URL: ${srcUrl}`);

          await storage.updateTask(taskId, {
            autoExportStatus: "ready",
            autoExportCompletedAt: new Date(),
          });
        } else {
          throw new Error("Export failed");
        }

        break;
      } else if (klapStatus.status === "error") {
        throw new Error("Task processing failed");
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error("Task timeout after 30 minutes");
    }
  } catch (error) {
    console.error(`[Workflow] Error in complete workflow:`, error);
    await storage.updateTask(taskId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Workflow failed",
      autoExportStatus: "error",
      autoExportError:
        error instanceof Error ? error.message : "Workflow failed",
      autoExportCompletedAt: new Date(),
    });
  }
}
