import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { klapService } from "./services/klap";
import { z } from "zod";

const DEFAULT_USER_ID = 1; // Admin user

// Validation schemas
const createVideoSchema = z.object({
  sourceVideoUrl: z.string().url(),
});

const createBulkVideoSchema = z.object({
  urls: z.array(z.string().url()).min(1, "At least one URL is required"),
});

const exportVideoSchema = z.object({
  projectId: z.string(),
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
      const { sourceVideoUrl } = createVideoSchema.parse(req.body);

      // Create initial task record
      const klapResponse = await klapService.createVideoToShortsTask(sourceVideoUrl);
      
      const task = await storage.createTask({
        id: klapResponse.id,
        userId: DEFAULT_USER_ID,
        sourceVideoUrl,
        status: klapResponse.status,
        outputId: klapResponse.output_id || null,
        errorMessage: null,
        klapResponse: klapResponse as any,
      });

      // Start background processing
      processVideoTask(task.id).catch(console.error);

      res.json({ taskId: task.id, status: task.status });
    } catch (error: any) {
      console.error("Error creating video task:", error);
      res.status(400).json({ error: error.message || "Failed to create video task" });
    }
  });

  // POST /api/videos/bulk - Create multiple video processing tasks
  app.post("/api/videos/bulk", async (req, res) => {
    try {
      const { urls } = createBulkVideoSchema.parse(req.body);

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
            });

            // Start background processing
            processVideoTask(task.id).catch(console.error);

            return { taskId: task.id, status: task.status, url, success: true };
          } catch (error: any) {
            console.error(`Error creating task for ${url}:`, error);
            return { url, success: false, error: error.message || "Failed to create task" };
          }
        })
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
        total: urls.length 
      });
    } catch (error: any) {
      console.error("Error creating bulk video tasks:", error);
      res.status(400).json({ error: error.message || "Failed to create bulk video tasks" });
    }
  });

  // GET /api/videos - Get all video tasks for the user
  app.get("/api/videos", async (req, res) => {
    try {
      const tasks = await storage.getAllTasks(DEFAULT_USER_ID);
      res.json(tasks);
    } catch (error: any) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ error: error.message || "Failed to fetch videos" });
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

          // If completed, fetch and store projects
          if (klapStatus.status === "complete" && klapStatus.output_id) {
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
            const project = projects.find(p => p.id === exp.projectId);
            if (project) {
              const exportStatus = await klapService.getExportStatus(
                exp.folderId,
                exp.projectId,
                exp.id,
                taskId
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
      res.status(500).json({ error: error.message || "Failed to fetch video details" });
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
        taskId
      );

      const exportData = await storage.createExport({
        id: exportResponse.id,
        projectId,
        folderId: project.folderId,
        status: exportResponse.status,
        srcUrl: exportResponse.src_url || null,
        errorMessage: exportResponse.error || null,
        klapResponse: exportResponse as any,
      });

      // Start polling export status
      pollExportStatus(exportData.id, project.folderId, projectId, taskId).catch(console.error);

      res.json(exportData);
    } catch (error: any) {
      console.error("Error creating export:", error);
      res.status(400).json({ error: error.message || "Failed to create export" });
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
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

      const klapStatus = await klapService.getTaskStatus(taskId);
      
      await storage.updateTask(taskId, {
        status: klapStatus.status,
        outputId: klapStatus.output_id || null,
        errorMessage: klapStatus.error || null,
        klapResponse: klapStatus as any,
      });

      if (klapStatus.status === "complete") {
        if (klapStatus.output_id) {
          await fetchAndStoreProjects(taskId, klapStatus.output_id);
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
      errorMessage: error instanceof Error ? error.message : "Processing failed",
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

async function pollExportStatus(exportId: string, folderId: string, projectId: string, taskId: string) {
  try {
    let attempts = 0;
    const maxAttempts = 40; // 10 minutes (15 second intervals)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds

      const exportStatus = await klapService.getExportStatus(folderId, projectId, exportId, taskId);
      
      await storage.updateExport(exportId, {
        status: exportStatus.status,
        srcUrl: exportStatus.src_url || null,
        errorMessage: exportStatus.error || null,
        klapResponse: exportStatus as any,
      });

      if (exportStatus.status === "complete" || exportStatus.status === "error") {
        break;
      }

      attempts++;
    }
  } catch (error) {
    console.error("Error polling export status:", error);
    await storage.updateExport(exportId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Export polling failed",
    });
  }
}
