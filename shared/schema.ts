import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - default admin user with id 1
export const users = pgTable("users", {
  id: integer("id").primaryKey(),
  username: text("username").notNull().unique(),
});

// Tasks table - stores Klap video-to-shorts task data
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), // Klap task ID
  userId: integer("user_id").notNull().references(() => users.id),
  sourceVideoUrl: text("source_video_url").notNull(),
  email: text("email"), // Email for completion notifications
  status: text("status").notNull(), // processing, ready, error
  outputId: text("output_id"), // folder_id when ready
  errorMessage: text("error_message"),
  klapResponse: jsonb("klap_response"), // Full Klap API response
  autoExportRequested: text("auto_export_requested").default(sql`'false'`).notNull(), // false, true
  autoExportStatus: text("auto_export_status"), // pending, processing, ready, partial_error, error
  autoExportError: text("auto_export_error"),
  autoExportCompletedAt: timestamp("auto_export_completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Folders table - stores folder information from Klap
export const folders = pgTable("folders", {
  id: text("id").primaryKey(), // Klap folder ID
  taskId: text("task_id").notNull().references(() => tasks.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Projects table - stores generated shorts/clips
export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // Klap project ID
  folderId: text("folder_id").notNull().references(() => folders.id),
  taskId: text("task_id").notNull().references(() => tasks.id),
  name: text("name").notNull(),
  viralityScore: integer("virality_score"),
  previewUrl: text("preview_url"),
  klapResponse: jsonb("klap_response"), // Full Klap API response for this project
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Exports table - stores export job data
export const exports = pgTable("exports", {
  id: text("id").primaryKey(), // Klap export ID
  projectId: text("project_id").notNull().references(() => projects.id),
  folderId: text("folder_id").notNull(),
  taskId: text("task_id").notNull().references(() => tasks.id), // Link to task for easier querying
  status: text("status").notNull(), // processing, ready, error
  srcUrl: text("src_url"), // Download URL when ready
  errorMessage: text("error_message"),
  klapResponse: jsonb("klap_response"), // Full Klap API response
  isAutoExport: text("is_auto_export").default("false").notNull(), // true if auto-triggered, false if manual
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// API Logs table - stores all Klap API request/response data
export const apiLogs = pgTable("api_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  taskId: text("task_id"), // Link to task if applicable
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  folder: one(folders, {
    fields: [tasks.outputId],
    references: [folders.id],
  }),
  projects: many(projects),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  task: one(tasks, {
    fields: [folders.taskId],
    references: [tasks.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  folder: one(folders, {
    fields: [projects.folderId],
    references: [folders.id],
  }),
  task: one(tasks, {
    fields: [projects.taskId],
    references: [tasks.id],
  }),
  exports: many(exports),
}));

export const exportsRelations = relations(exports, ({ one }) => ({
  project: one(projects, {
    fields: [exports.projectId],
    references: [projects.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users);
export const insertTaskSchema = createInsertSchema(tasks, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertFolderSchema = createInsertSchema(folders).omit({
  createdAt: true,
});
export const insertProjectSchema = createInsertSchema(projects).omit({
  createdAt: true,
});
export const insertExportSchema = createInsertSchema(exports, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertApiLogSchema = createInsertSchema(apiLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Export = typeof exports.$inferSelect;
export type InsertExport = z.infer<typeof insertExportSchema>;

export type ApiLog = typeof apiLogs.$inferSelect;
export type InsertApiLog = z.infer<typeof insertApiLogSchema>;
