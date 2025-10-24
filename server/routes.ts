import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { klapService } from "./services/klap";
import { z } from "zod";

const DEFAULT_USER_ID = 1; // Admin user

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
  // Ensure default admin user exists
  app.use(async (req, res, next) => {
    try {
      const user = await storage.getUser(DEFAULT_USER_ID);
      if (!user) {
        await storage.createUser({
          id: DEFAULT_USER_ID,
          username: "admin",
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // POST /api/videos - Create video processing task and start processing
  app.post("/api/videos", async (req, res) => {
    try {
      const { sourceVideoUrl, autoExport } = createVideoSchema.parse(req.body);

      // Create initial task record
      const klapResponse =
        await klapService.createVideoToShortsTask(sourceVideoUrl);

      const task = await storage.createTask({
        id: klapResponse.id,
        userId: DEFAULT_USER_ID,
        sourceVideoUrl,
        status: klapResponse.status,
        outputId: klapResponse.output_id || null,
        errorMessage: null,
        klapResponse: klapResponse as any,
        autoExportRequested: autoExport ? "true" : "false",
        autoExportStatus: autoExport ? "pending" : null,
      });

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
            const klapResponse = await klapService.createVideoToShortsTask(url);

            const task = await storage.createTask({
              id: klapResponse.id,
              userId: DEFAULT_USER_ID,
              sourceVideoUrl: url,
              status: klapResponse.status,
              outputId: klapResponse.output_id || null,
              errorMessage: null,
              klapResponse: klapResponse as any,
              autoExportRequested: autoExport ? "true" : "false",
              autoExportStatus: autoExport ? "pending" : null,
            });

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

      // TODO: Use targetClipCount and minimumDuration parameters when Klap API supports them
      console.log('Process video advanced called with:', {
        url,
        email,
        targetClipCount,
        minimumDuration
      });

      // Step 1: Create task via Klap API
      const klapTask = await klapService.createVideoToShortsTask(url);

      // Step 2: Save task in database
      const task = await storage.createTask({
        id: klapTask.id,
        userId: DEFAULT_USER_ID,
        sourceVideoUrl: url,
        email: email || null,
        status: klapTask.status,
        outputId: null,
        errorMessage: null,
        klapResponse: klapTask as any,
        autoExportRequested: "true",
        autoExportStatus: "pending",
      });

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
      const tasks = await storage.getAllTasks(DEFAULT_USER_ID);
      res.json(tasks);
    } catch (error: any) {
      console.error("Error fetching videos:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch videos" });
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
            await fetchAndStoreProjects(taskId, klapStatus.output_id);
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

      // Step 1: Create task via Klap API
      const klapTask = await klapService.createVideoToShortsTask(url);

      // Step 2: Save task in database
      const task = await storage.createTask({
        id: klapTask.id,
        userId: DEFAULT_USER_ID,
        sourceVideoUrl: url,
        email: email || null,
        status: klapTask.status,
        outputId: null,
        errorMessage: null,
        klapResponse: klapTask as any,
        autoExportRequested: "true",
        autoExportStatus: "pending",
      });

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
          await fetchAndStoreProjects(taskId, klapStatus.output_id);

          // Check if auto-export was requested
          const task = await storage.getTask(taskId);
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

async function fetchAndStoreProjects(taskId: string, folderId: string) {
  try {
    // Check if folder exists, create if not
    const existingFolder = await storage.getFolder(folderId);
    if (!existingFolder) {
      await storage.createFolder({
        id: folderId,
        taskId,
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

        // Send email notification if email was provided
        const task = await storage.getTask(taskId);
        if (task && task.email) {
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
        await fetchAndStoreProjects(taskId, folderId);

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
