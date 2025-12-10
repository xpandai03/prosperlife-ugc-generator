// Blueprint reference: javascript_database integration
import {
  users,
  tasks,
  folders,
  projects,
  exports,
  socialPosts,
  mediaAssets,
  stripeSettings,
  type User,
  type InsertUser,
  type Task,
  type InsertTask,
  type Folder,
  type InsertFolder,
  type Project,
  type InsertProject,
  type Export,
  type InsertExport,
  type SocialPost,
  type InsertSocialPost,
  type MediaAsset,
  type InsertMediaAsset,
  type StripeSettings,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserIdByEmail(email: string, newId: string): Promise<User | undefined>;

  // Tasks
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(userId: string): Promise<Task[]>;
  
  // Folders
  createFolder(folder: InsertFolder): Promise<Folder>;
  getFolder(id: string): Promise<Folder | undefined>;
  
  // Projects
  createProject(project: InsertProject): Promise<Project>;
  getProjectsByTask(taskId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  
  // Exports
  createExport(exportData: InsertExport): Promise<Export>;
  updateExport(id: string, updates: Partial<InsertExport>): Promise<Export | undefined>;
  getExport(id: string): Promise<Export | undefined>;
  getExportsByTask(taskId: string): Promise<Export[]>;

  // Social Posts
  createSocialPost(post: InsertSocialPost): Promise<SocialPost>;
  updateSocialPost(id: number, updates: Partial<Omit<SocialPost, 'id' | 'createdAt'>>): Promise<SocialPost | undefined>;
  getSocialPost(id: number): Promise<SocialPost | undefined>;
  getSocialPostsByProject(projectId: string): Promise<SocialPost[]>;
  getSocialPostsByTask(taskId: string): Promise<SocialPost[]>;

  // Media Assets (Phase 4)
  createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset>;
  getMediaAsset(id: string): Promise<MediaAsset | undefined>;
  updateMediaAsset(id: string, updates: Partial<Omit<MediaAsset, 'id' | 'createdAt'>>): Promise<MediaAsset | undefined>;
  getMediaAssetsByUser(userId: string): Promise<MediaAsset[]>;

  // Stripe Settings (White-label)
  getStripeSettings(): Promise<StripeSettings | undefined>;
  updateStripeSettings(updates: Partial<Omit<StripeSettings, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StripeSettings | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    console.log('[Storage.getUser] User ID:', id);
    console.log('[Storage.getUser] Raw DB result:', JSON.stringify(user, null, 2));
    console.log('[Storage.getUser] subscriptionStatus:', user?.subscriptionStatus);
    return user || undefined;
  }

  /**
   * Find user by email (for email-based reconciliation)
   * Used when Supabase auth ID doesn't match Neon DB user ID
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    console.log('[Storage.getUserByEmail] Email:', email);
    console.log('[Storage.getUserByEmail] Found user:', user ? user.id : 'not found');
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  /**
   * Update user ID by email (for reconciling Supabase auth ID with Neon DB)
   * This handles the case where user exists with same email but different ID
   */
  async updateUserIdByEmail(email: string, newId: string): Promise<User | undefined> {
    console.log('[Storage.updateUserIdByEmail] Updating user ID', {
      email,
      newId,
    });

    const [user] = await db
      .update(users)
      .set({ id: newId, updatedAt: new Date() })
      .where(eq(users.email, email))
      .returning();

    console.log('[Storage.updateUserIdByEmail] Update result:', user ? 'success' : 'failed');
    return user || undefined;
  }

  // Tasks
  async createTask(insertTask: InsertTask & { id?: string }): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask as any).returning();
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return task || undefined;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getAllTasks(userId: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  // Folders
  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const [folder] = await db.insert(folders).values(insertFolder).returning();
    return folder;
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder || undefined;
  }

  // Projects
  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async getProjectsByTask(taskId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.taskId, taskId));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  // Exports
  async createExport(insertExport: InsertExport & { id?: string }): Promise<Export> {
    const [exportData] = await db.insert(exports).values(insertExport as any).returning();
    return exportData;
  }

  async updateExport(id: string, updates: Partial<InsertExport>): Promise<Export | undefined> {
    const [exportData] = await db
      .update(exports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(exports.id, id))
      .returning();
    return exportData || undefined;
  }

  async getExport(id: string): Promise<Export | undefined> {
    const [exportData] = await db.select().from(exports).where(eq(exports.id, id));
    return exportData || undefined;
  }

  async getExportsByTask(taskId: string): Promise<Export[]> {
    return db
      .select()
      .from(exports)
      .innerJoin(projects, eq(exports.projectId, projects.id))
      .where(eq(projects.taskId, taskId))
      .then(results => results.map(r => r.exports));
  }

  // Social Posts
  async createSocialPost(insertSocialPost: InsertSocialPost): Promise<SocialPost> {
    const [socialPost] = await db
      .insert(socialPosts)
      .values(insertSocialPost)
      .returning();
    return socialPost;
  }

  async updateSocialPost(
    id: number,
    updates: Partial<Omit<SocialPost, 'id' | 'createdAt'>>
  ): Promise<SocialPost | undefined> {
    const [socialPost] = await db
      .update(socialPosts)
      .set(updates)
      .where(eq(socialPosts.id, id))
      .returning();
    return socialPost || undefined;
  }

  async getSocialPost(id: number): Promise<SocialPost | undefined> {
    const [socialPost] = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.id, id));
    return socialPost || undefined;
  }

  async getSocialPostsByProject(projectId: string): Promise<SocialPost[]> {
    return db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.projectId, projectId))
      .orderBy(desc(socialPosts.createdAt));
  }

  async getSocialPostsByTask(taskId: string): Promise<SocialPost[]> {
    return db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.taskId, taskId))
      .orderBy(desc(socialPosts.createdAt));
  }

  // Media Assets (Phase 4)
  async createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset> {
    const [created] = await db.insert(mediaAssets).values(asset).returning();
    return created;
  }

  async getMediaAsset(id: string): Promise<MediaAsset | undefined> {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    return asset || undefined;
  }

  async updateMediaAsset(id: string, updates: Partial<Omit<MediaAsset, 'id' | 'createdAt'>>): Promise<MediaAsset | undefined> {
    const [updated] = await db
      .update(mediaAssets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mediaAssets.id, id))
      .returning();
    return updated || undefined;
  }

  async getMediaAssetsByUser(userId: string): Promise<MediaAsset[]> {
    return db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, userId))
      .orderBy(desc(mediaAssets.createdAt));
  }

  async getMediaAssetByTaskId(taskId: string): Promise<MediaAsset | undefined> {
    const results = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.taskId, taskId))
      .limit(1);
    return results[0];
  }

  // Stripe Settings (White-label)
  async getStripeSettings(): Promise<StripeSettings | undefined> {
    const [settings] = await db.select().from(stripeSettings).limit(1);
    return settings || undefined;
  }

  async updateStripeSettings(updates: Partial<Omit<StripeSettings, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StripeSettings | undefined> {
    // Get the existing settings or create one
    let existingSettings = await this.getStripeSettings();

    if (!existingSettings) {
      // Create a new settings row
      const [created] = await db
        .insert(stripeSettings)
        .values({ ...updates, updatedAt: new Date() })
        .returning();
      return created || undefined;
    }

    // Update existing settings
    const [updated] = await db
      .update(stripeSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stripeSettings.id, existingSettings.id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
