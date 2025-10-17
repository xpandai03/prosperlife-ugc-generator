import { db } from "../db";
import { apiLogs, type InsertApiLog } from "@shared/schema";

const KLAP_API_URL = "https://api.klap.app/v2";
const KLAP_API_KEY = process.env.KLAP_API_KEY;

if (!KLAP_API_KEY) {
  throw new Error("KLAP_API_KEY must be set in environment variables");
}

interface KlapRequestOptions {
  method: "GET" | "POST";
  endpoint: string;
  body?: any;
  taskId?: string;
}

async function klapRequest<T = any>(options: KlapRequestOptions): Promise<T> {
  const { method, endpoint, body, taskId } = options;
  const url = `${KLAP_API_URL}${endpoint}`;

  let logEntry: InsertApiLog = {
    taskId: taskId || null,
    endpoint,
    method,
    requestBody: body || null,
    responseBody: null,
    statusCode: null,
    errorMessage: null,
  };

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KLAP_API_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    logEntry.statusCode = response.status;

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      logEntry.responseBody = errorData as any;
      logEntry.errorMessage =
        errorData.error || errorData.message || `HTTP ${response.status}`;

      await db.insert(apiLogs).values(logEntry);

      throw new Error(logEntry.errorMessage);
    }

    const data = await response.json();
    logEntry.responseBody = data as any;

    await db.insert(apiLogs).values(logEntry);

    return data;
  } catch (error: any) {
    if (!logEntry.errorMessage) {
      logEntry.errorMessage = error.message || "Request failed";
      await db.insert(apiLogs).values(logEntry);
    }
    throw error;
  }
}

export interface VideoToShortsResponse {
  id: string;
  status: "processing" | "complete" | "error";
  output_id?: string;
}

export interface TaskStatusResponse {
  id: string;
  status: "processing" | "complete" | "error";
  output_id?: string;
  error?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  folder_id: string;
  virality_score: number;
}

export interface ExportResponse {
  id: string;
  status: "processing" | "complete" | "error";
  src_url?: string;
  error?: string;
}

export const klapService = {
  async createVideoToShortsTask(
    sourceVideoUrl: string,
    taskId?: string,
  ): Promise<VideoToShortsResponse> {
    return klapRequest<VideoToShortsResponse>({
      method: "POST",
      endpoint: "/tasks/video-to-shorts",
      body: {
        source_video_url: sourceVideoUrl,
        language: "en",
        max_duration: 30,
        max_clip_count: 5,
        editing_options: {
          intro_title: false,
        },
      },
      taskId,
    });
  },

  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    return klapRequest<TaskStatusResponse>({
      method: "GET",
      endpoint: `/tasks/${taskId}`,
      taskId,
    });
  },

  async getProjects(
    folderId: string,
    taskId?: string,
  ): Promise<ProjectResponse[]> {
    return klapRequest<ProjectResponse[]>({
      method: "GET",
      endpoint: `/projects/${folderId}`,
      taskId,
    });
  },

  async createExport(
    folderId: string,
    projectId: string,
    taskId?: string,
  ): Promise<ExportResponse> {
    return klapRequest<ExportResponse>({
      method: "POST",
      endpoint: `/projects/${folderId}/${projectId}/exports`,
      body: {},
      taskId,
    });
  },

  async getExportStatus(
    folderId: string,
    projectId: string,
    exportId: string,
    taskId?: string,
  ): Promise<ExportResponse> {
    return klapRequest<ExportResponse>({
      method: "GET",
      endpoint: `/projects/${folderId}/${projectId}/exports/${exportId}`,
      taskId,
    });
  },
};
