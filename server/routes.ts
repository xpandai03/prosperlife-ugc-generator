import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { klapService } from "./services/klap";
import { lateService } from "./services/late";
import { postToSocialSchema } from "./validators/social";
import { supabaseAdmin } from "./services/supabaseAuth";
import { requireAuth } from "./middleware/auth";
import { checkVideoLimit, checkPostLimit, incrementVideoUsage, incrementPostUsage, getCurrentUsage, FREE_VIDEO_LIMIT, FREE_POST_LIMIT } from "./services/usageLimits";
import { z } from "zod";

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

  // Apply authentication middleware to all /api/* routes (except /api/auth/* above)
  app.use("/api/*", requireAuth);

  // POST /api/videos - Create video processing task and start processing
  app.post("/api/videos", async (req, res) => {
    try {
      const { sourceVideoUrl, autoExport } = createVideoSchema.parse(req.body);

      // Check usage limit (Phase 6: Free tier limits)
      const canCreateVideo = await checkVideoLimit(req.userId!);
      if (!canCreateVideo) {
        console.log('[Usage Limits] Video limit reached for user:', req.userId);
        return res.status(403).json({
          error: 'Monthly video limit reached',
          message: 'Free plan allows 3 videos per month. Upgrade to Pro for unlimited videos.',
          limit: FREE_VIDEO_LIMIT,
        });
      }

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

      // Increment usage counter (Phase 6: Track video creation)
      await incrementVideoUsage(req.userId!);

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

      const results = await Promise.allSettled(
        urls.map(async (url) => {
          try {
            // Check usage limit for each video (Phase 6: Free tier limits)
            const canCreateVideo = await checkVideoLimit(req.userId!);
            if (!canCreateVideo) {
              console.log('[Usage Limits] Video limit reached for user (bulk):', req.userId);
              return {
                url,
                success: false,
                error: 'Monthly video limit reached. Free plan allows 3 videos per month.',
              };
            }

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

            // Increment usage counter (Phase 6: Track video creation)
            await incrementVideoUsage(req.userId!);
            console.log('[Usage Limits] Usage incremented for bulk video:', url);

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

  // POST /api/process-video-advanced - Process video with custom parameters
  app.post("/api/process-video-advanced", async (req, res) => {
    try {
      const { url, email, targetClipCount, minimumDuration } = processVideoAdvancedSchema.parse(req.body);

      console.log('Process video advanced called with:', {
        url,
        email,
        targetClipCount,
        minimumDuration
      });

      // Check usage limit (Phase 6: Free tier limits)
      const canCreateVideo = await checkVideoLimit(req.userId!);
      if (!canCreateVideo) {
        console.log('[Usage Limits] Video limit reached for user:', req.userId);
        return res.status(403).json({
          error: 'Monthly video limit reached',
          message: 'Free plan allows 3 videos per month. Upgrade to Pro for unlimited videos.',
          limit: FREE_VIDEO_LIMIT,
        });
      }

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

      // Increment usage counter (Phase 6: Track video creation)
      await incrementVideoUsage(req.userId!);
      console.log('[Usage Limits] Usage incremented for process-video-advanced');

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

      // Validate platform
      const supportedPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'threads', 'pinterest', 'reddit', 'bluesky'];
      if (!supportedPlatforms.includes(platform.toLowerCase())) {
        return res.status(400).json({
          error: 'Unsupported platform',
          message: `Platform "${platform}" is not supported. Supported platforms: ${supportedPlatforms.join(', ')}`,
        });
      }

      // Get user's Late.dev profile ID
      let user = await storage.getUser(userId);

      // Create Late.dev profile if user doesn't have one
      if (!user?.lateProfileId) {
        console.log('[OAuth] User has no Late profile, creating one:', userId);

        try {
          // Create Late.dev profile
          const { profileId } = await lateService.createProfile(
            user!.email,
            user!.fullName || user!.email.split('@')[0]
          );

          // Update user with profile ID
          await storage.updateUser(userId, { lateProfileId: profileId });

          // Reload user
          user = await storage.getUser(userId);

          console.log('[OAuth] Late profile created:', { userId, profileId });
        } catch (profileError: any) {
          // Handle "profile already exists" error - fetch existing profile
          if (profileError.message && profileError.message.includes('already exists')) {
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

      // Generate Late.dev OAuth URL
      const connectUrl = lateService.generateConnectUrl(
        user.lateProfileId,
        platform.toLowerCase(),
        redirectUrl
      );

      console.log('[OAuth] Connect URL generated:', { userId, platform, profileId: user.lateProfileId });

      res.json({
        success: true,
        connectUrl,
        platform,
        profileId: user.lateProfileId,
      });
    } catch (error: any) {
      console.error('[OAuth] Error generating connect URL:', error);
      res.status(500).json({
        error: 'Failed to generate connect URL',
        details: error.message,
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
  app.post("/api/process-video", async (req, res) => {
    try {
      const { url, email } = z.object({
        url: z.string().url(),
        email: z.string().email().optional()
      }).parse(req.body);

      // Check usage limit (Phase 6: Free tier limits)
      const canCreateVideo = await checkVideoLimit(req.userId!);
      if (!canCreateVideo) {
        console.log('[Usage Limits] Video limit reached for user:', req.userId);
        return res.status(403).json({
          error: 'Monthly video limit reached',
          message: 'Free plan allows 3 videos per month. Upgrade to Pro for unlimited videos.',
          limit: FREE_VIDEO_LIMIT,
        });
      }

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

      // Increment usage counter (Phase 6: Track video creation)
      await incrementVideoUsage(req.userId!);
      console.log('[Usage Limits] Usage incremented for process-video');

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
      // Validate input
      const validation = postToSocialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: validation.error.errors,
        });
      }

      const { projectId, platform, caption } = validation.data;

      // Check usage limit (Phase 6: Free tier limits)
      const canCreatePost = await checkPostLimit(req.userId!);
      if (!canCreatePost) {
        console.log('[Usage Limits] Post limit reached for user:', req.userId);
        return res.status(403).json({
          error: 'Monthly post limit reached',
          message: 'Free plan allows 3 social posts per month. Upgrade to Pro for unlimited posting.',
          limit: FREE_POST_LIMIT,
        });
      }

      console.log(`[Social Post] Request to post project ${projectId} to ${platform}`);

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

      console.log(`[Social Post] Using export URL: ${projectExport.srcUrl.substring(0, 50)}...`);

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

      // For now, use the default Instagram account ID until users can connect their own
      // In the future, this will come from user.lateAccountId
      const accountId = user.lateAccountId || process.env.INSTAGRAM_ACCOUNT_ID || '6900d2cd8bbca9c10cbfff74';

      console.log(`[Social Post] Using Late profile: ${user.lateProfileId}, account: ${accountId}`);

      // Create initial social post record
      const socialPost = await storage.createSocialPost({
        projectId,
        taskId: project.taskId,
        platform,
        caption: caption || '',
        status: 'posting',
        latePostId: null,
        platformPostUrl: null,
        errorMessage: null,
        lateResponse: null,
        publishedAt: null,
      });

      console.log(`[Social Post] Created social post record: ${socialPost.id}`);

      // Post to Instagram via Late API using user's profile
      try {
        const lateResponse = await lateService.postToInstagram(
          {
            videoUrl: projectExport.srcUrl,
            caption: caption || '',
            contentType: 'reel',
          },
          user.lateProfileId,  // User's Late profile ID
          accountId            // Instagram account ID
        );

        // Extract platform-specific data
        const instagramPost = lateResponse.post.platforms.find(
          (p) => p.platform === 'instagram'
        );

        const finalStatus = instagramPost?.status === 'published' ? 'published' :
                           instagramPost?.status === 'failed' ? 'failed' : 'posting';

        // Update social post with success
        const updatedPost = await storage.updateSocialPost(socialPost.id, {
          status: finalStatus,
          latePostId: lateResponse.post._id,
          platformPostUrl: instagramPost?.platformPostUrl || null,
          lateResponse: lateResponse as any,
          publishedAt: finalStatus === 'published' ? new Date() : null,
          errorMessage: instagramPost?.error || null,
        });

        console.log(`[Social Post] Successfully posted to Instagram: ${instagramPost?.platformPostUrl || 'pending'}`);

        // Increment usage counter (Phase 6: Track social post creation)
        await incrementPostUsage(req.userId!);

        res.json({
          success: true,
          post: updatedPost,
          platformUrl: instagramPost?.platformPostUrl,
          message: finalStatus === 'published'
            ? "Successfully posted to Instagram!"
            : "Post is being processed by Instagram",
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

  const httpServer = createServer(app);
  return httpServer;
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
