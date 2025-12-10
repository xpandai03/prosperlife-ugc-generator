import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, uuid, numeric, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - synced with Supabase auth.users
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  lateProfileId: text("late_profile_id"),
  lateAccountId: text("late_account_id"),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionStatus: text("subscription_status").default("free"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  // AI Caption Settings (Phase 2)
  captionSystemPrompt: text("caption_system_prompt").default(
    "Write an engaging Instagram caption for this video. Be creative, use relevant emojis, and include a call-to-action."
  ),
  captionAutoGenerate: text("caption_auto_generate").default("true").notNull(), // "true" or "false" string for compatibility
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Tasks table - stores Klap video-to-shorts task data
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), // Klap task ID
  userId: uuid("user_id").notNull().references(() => users.id),
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
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Projects table - stores generated shorts/clips
export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // Klap project ID
  folderId: text("folder_id").notNull().references(() => folders.id),
  taskId: text("task_id").notNull().references(() => tasks.id),
  userId: uuid("user_id").notNull().references(() => users.id),
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
  userId: uuid("user_id").notNull().references(() => users.id),
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
  userId: uuid("user_id").references(() => users.id), // Optional - for admin tracking
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Social Posts table - tracks all social media posts via Late.dev API
export const socialPosts = pgTable("social_posts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  // Klap video references (nullable for UGC posts)
  projectId: text("project_id").references(() => projects.id),
  taskId: text("task_id").references(() => tasks.id),
  // UGC video reference (nullable for Klap posts) - Phase 4.7
  mediaAssetId: text("media_asset_id").references(() => mediaAssets.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  platform: text("platform").notNull(), // instagram, tiktok, youtube, etc.
  latePostId: text("late_post_id"), // Late.dev post ID
  platformPostUrl: text("platform_post_url"), // Public URL on social platform
  caption: text("caption"),
  // AI Caption Metadata (Phase 2)
  captionSource: text("caption_source"), // "manual", "ai_auto", "ai_manual"
  aiCaptionMetadata: jsonb("ai_caption_metadata"), // {model, tokensUsed, generatedAt, promptUsed}
  // Scheduled Posting (Phase 3)
  scheduledFor: timestamp("scheduled_for"), // UTC timestamp for scheduled posts
  isScheduled: text("is_scheduled").default("false").notNull(), // "true" or "false"
  status: text("status").notNull(), // draft, scheduled, posting, published, failed
  errorMessage: text("error_message"),
  lateResponse: jsonb("late_response"), // Full Late API response
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  publishedAt: timestamp("published_at"),
});

// User Usage table - tracks monthly usage for free tier limits
export const userUsage = pgTable("user_usage", {
  userId: uuid("user_id").notNull().references(() => users.id),
  month: text("month").notNull(), // Format: YYYY-MM
  videosCreated: integer("videos_created").notNull().default(0),
  postsCreated: integer("posts_created").notNull().default(0),
  mediaGenerationsCreated: integer("media_generations_created").notNull().default(0), // Phase 4
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  pk: { name: "user_usage_pkey", columns: [table.userId, table.month] },
}));

// Stripe Events table - tracks processed webhook events for idempotency
export const stripeEvents = pgTable("stripe_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at").notNull().default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// ============================================
// XPAND CREDITS SYSTEM (Phase 9)
// ============================================

// Global Credit Settings - stores markup factor and price per credit
export const globalCreditSettings = pgTable("global_credit_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  markupFactor: numeric("markup_factor", { precision: 5, scale: 2 }).notNull().default("1.40"), // 40% markup
  pricePerCreditUsd: numeric("price_per_credit_usd", { precision: 10, scale: 4 }).notNull().default("0.0200"), // $0.02 per credit
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Credit Pricing - defines credit cost per feature
export const creditPricing = pgTable("credit_pricing", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  featureKey: text("feature_key").notNull().unique(), // e.g., 'ugc_veo3_quality', 'klap_video_input'
  featureName: text("feature_name").notNull(), // Display name for UI
  baseCostUsd: numeric("base_cost_usd", { precision: 10, scale: 4 }).notNull(), // Your actual cost
  creditCost: integer("credit_cost").notNull(), // Credits to charge user
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// User Credits - tracks credit balance per user
export const userCredits = pgTable("user_credits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  balance: integer("balance").notNull().default(0),
  lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
  lifetimeUsed: integer("lifetime_used").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Credit Transactions - audit log of all credit changes
export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer("amount").notNull(), // positive = add, negative = deduct
  balanceAfter: integer("balance_after").notNull(),
  featureKey: text("feature_key"), // null for purchases
  description: text("description").notNull(),
  stripePaymentId: text("stripe_payment_id"), // null for deductions
  metadata: jsonb("metadata"), // additional info (e.g., asset IDs, etc.)
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Stripe Settings - white-label Stripe configuration
export const stripeSettings = pgTable("stripe_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  publishableKey: text("publishable_key"), // pk_live_... or pk_test_...
  secretKey: text("secret_key"), // sk_live_... or sk_test_...
  webhookSecret: text("webhook_secret"), // whsec_...
  // Credit package price IDs (Updated Dec 2025)
  priceIdStarter: text("price_id_starter"), // 500 credits - $9.99
  priceIdBasic: text("price_id_basic"), // 1,500 credits - $24.99
  priceIdPro: text("price_id_pro"), // 5,000 credits - $69.99
  priceIdAgency: text("price_id_agency"), // 12,000 credits - $149.99
  priceIdEnterprise: text("price_id_enterprise"), // 30,000 credits - $349.99
  // Legacy field (deprecated, kept for backwards compat)
  priceIdBusiness: text("price_id_business"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// ============================================
// END XPAND CREDITS SYSTEM
// ============================================

// Media Assets table - tracks AI-generated media (Phase 4)
export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Provider and type
  provider: text("provider").notNull(), // 'kie-veo3' | 'kie-4o-image' | 'kie-flux-kontext' | 'gemini-flash'
  type: text("type").notNull(), // 'image' | 'video'

  // Input data
  prompt: text("prompt").notNull(),
  referenceImageUrl: text("reference_image_url"),

  // Generation tracking
  status: text("status").notNull(), // 'processing' | 'ready' | 'error'
  taskId: text("task_id"),

  // Output data
  resultUrl: text("result_url"),
  resultUrls: jsonb("result_urls"),

  // Error tracking
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),

  // Metadata
  metadata: jsonb("metadata"),
  apiResponse: jsonb("api_response"),

  // UGC Chain Support (Phase 5)
  generationMode: text("generation_mode"), // 'nanobana+veo3' | 'veo3-only' | 'sora2'
  chainMetadata: jsonb("chain_metadata"), // Stores: { step, nanoImageUrl, imageAnalysis, videoPrompt, timestamps }

  // User Feedback (Dec 2025)
  rating: integer("rating"), // 1-5 stars rating, CHECK constraint in DB

  // Soft Delete (Dec 2025)
  deletedAt: timestamp("deleted_at"), // Soft delete timestamp

  // Timestamps
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
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
  socialPosts: many(socialPosts),
}));

export const exportsRelations = relations(exports, ({ one }) => ({
  project: one(projects, {
    fields: [exports.projectId],
    references: [projects.id],
  }),
}));

export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  project: one(projects, {
    fields: [socialPosts.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [socialPosts.taskId],
    references: [tasks.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  user: one(users, {
    fields: [mediaAssets.userId],
    references: [users.id],
  }),
}));

// Credit system relations
export const userCreditsRelations = relations(userCredits, ({ one }) => ({
  user: one(users, {
    fields: [userCredits.userId],
    references: [users.id],
  }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
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

export const insertSocialPostSchema = createInsertSchema(socialPosts, {
  createdAt: () => z.date().optional(),
  publishedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertUserUsageSchema = createInsertSchema(userUsage, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertStripeEventSchema = createInsertSchema(stripeEvents, {
  createdAt: () => z.date().optional(),
  processedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssets, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

// Credit system insert schemas
export const insertGlobalCreditSettingsSchema = createInsertSchema(globalCreditSettings, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditPricingSchema = createInsertSchema(creditPricing, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCreditsSchema = createInsertSchema(userCredits, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions, {
  createdAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertStripeSettingsSchema = createInsertSchema(stripeSettings, {
  createdAt: () => z.date().optional(),
  updatedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;

export type UserUsage = typeof userUsage.$inferSelect;
export type InsertUserUsage = z.infer<typeof insertUserUsageSchema>;

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type InsertStripeEvent = z.infer<typeof insertStripeEventSchema>;

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;

// Credit system types
export type GlobalCreditSettings = typeof globalCreditSettings.$inferSelect;
export type InsertGlobalCreditSettings = z.infer<typeof insertGlobalCreditSettingsSchema>;

export type CreditPricing = typeof creditPricing.$inferSelect;
export type InsertCreditPricing = z.infer<typeof insertCreditPricingSchema>;

export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;

export type StripeSettings = typeof stripeSettings.$inferSelect;
export type InsertStripeSettings = z.infer<typeof insertStripeSettingsSchema>;
