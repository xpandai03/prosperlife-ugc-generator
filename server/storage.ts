// Blueprint reference: javascript_database integration
import {
  users,
  tasks,
  folders,
  projects,
  exports,
  socialPosts,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tasks
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(userId: number): Promise<Task[]>;
  
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
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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

  async getAllTasks(userId: number): Promise<Task[]> {
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
}

export const storage = new DatabaseStorage();
