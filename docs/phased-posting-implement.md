# Phased Implementation Plan: Social Posting Feature

**Project:** Streamline AI - Late.dev Social Posting Integration
**Author:** Development Team
**Version:** 1.0
**Last Updated:** 2025-10-28

---

## 📋 Executive Summary

This document outlines a phased approach to implementing social media posting capabilities for Streamline AI's generated video clips using the Late.dev API. The implementation will add Instagram posting as the initial platform while maintaining complete backward compatibility with the existing YouTube → Clipping → Email workflow.

**Key Principles:**
- ✅ Zero breaking changes to existing video processing pipeline
- ✅ Modular architecture for easy platform expansion
- ✅ Server-side API key management for security
- ✅ Comprehensive error handling and logging
- ✅ Database tracking for post history and analytics

---

## 🎯 Context

### Current System (Stable - Must Not Break)

**Workflow:**
```
User Input (YouTube URL + Email + Clip Parameters)
  ↓
Klap API Processing (Video → Multiple Clips)
  ↓
Database Storage (Tasks, Projects, Exports)
  ↓
Email Notification (When clips are ready)
  ↓
Download Page (localhost:8080/details/:taskId)
```

**Tech Stack:**
- **Backend:** Express.js, TypeScript, Drizzle ORM
- **Frontend:** React, Wouter (routing), Tanstack Query
- **Database:** PostgreSQL (Neon)
- **Current APIs:** Klap API (video processing)

**Existing Database Tables:**
- `users` - Admin user (id=1)
- `tasks` - Video processing jobs
- `projects` - Generated clips
- `exports` - Export jobs for clips
- `folders` - Klap folder structure

### Goal

Add **social media posting** capabilities starting with Instagram Reels, using Late.dev API integration.

**V1 Scope (This Plan):**
- Post generated clips to Instagram via Late.dev API
- UI: "Post to Social" button on clip detail page
- Backend: `/api/social/post` endpoint
- Database: Track posting history
- Platform: Instagram only (easily extensible)

**Future Scope (V2+):**
- Multi-platform (TikTok, YouTube Shorts, LinkedIn)
- User authentication and profile management
- OAuth connection flow per user
- Scheduled posting
- Analytics and engagement tracking

---

## 🏗️ Phase 1: Environment & API Validation

**Duration:** 2-3 hours
**Goal:** Validate Late.dev API connectivity and create foundation services

### Dependencies
- ✅ LATE_API_KEY in `.env` (already configured)
- ✅ Late.dev account with connected Instagram
- ✅ Instagram account ID: `6900d2cd8bbca9c10cbfff74`
- ✅ Base Profile ID: `6900d2bda131561e50bb26b1`

### Deliverables

#### 1.1 Create Late Service Wrapper
**File:** `server/services/late.ts`

```typescript
import fetch from 'node-fetch';

const LATE_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY;
const INSTAGRAM_ACCOUNT_ID = '6900d2cd8bbca9c10cbfff74';

export interface PostToInstagramParams {
  videoUrl: string;
  caption: string;
  contentType?: 'reel' | 'post' | 'story';
}

export interface LatePostResponse {
  post: {
    _id: string;
    status: string;
    platforms: Array<{
      platform: string;
      platformPostUrl?: string;
      status: string;
      error?: string;
    }>;
  };
}

export const lateService = {
  async postToInstagram(params: PostToInstagramParams): Promise<LatePostResponse> {
    const response = await fetch(`${LATE_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: params.caption,
        platforms: [
          {
            platform: 'instagram',
            accountId: INSTAGRAM_ACCOUNT_ID,
            platformSpecificData: {
              contentType: params.contentType || 'reel',
            },
          },
        ],
        mediaItems: [
          {
            type: 'video',
            url: params.videoUrl,
          },
        ],
        publishNow: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Late API Error: ${response.status} - ${error}`);
    }

    return await response.json();
  },

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${LATE_BASE_URL}/accounts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Late API connection test failed:', error);
      return false;
    }
  },
};
```

#### 1.2 Create Database Schema Extension
**File:** `shared/schema.ts` (append to existing)

```typescript
// Social Posts table - tracks all social media posts
export const socialPosts = pgTable("social_posts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: text("project_id").notNull().references(() => projects.id),
  taskId: text("task_id").notNull().references(() => tasks.id),
  platform: text("platform").notNull(), // instagram, tiktok, youtube, etc.
  latePostId: text("late_post_id"), // Late.dev post ID
  platformPostUrl: text("platform_post_url"), // Public URL on social platform
  caption: text("caption"),
  status: text("status").notNull(), // posting, published, failed
  errorMessage: text("error_message"),
  lateResponse: jsonb("late_response"), // Full Late API response
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  publishedAt: timestamp("published_at"),
});

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

export const insertSocialPostSchema = createInsertSchema(socialPosts, {
  createdAt: () => z.date().optional(),
  publishedAt: () => z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
```

#### 1.3 Storage Service Extension
**File:** `server/storage.ts` (add methods)

```typescript
async createSocialPost(post: InsertSocialPost): Promise<SocialPost> {
  const [result] = await db.insert(socialPosts).values(post).returning();
  return result;
},

async updateSocialPost(
  id: number,
  updates: Partial<Omit<SocialPost, 'id' | 'createdAt'>>
): Promise<SocialPost> {
  const [result] = await db
    .update(socialPosts)
    .set(updates)
    .where(eq(socialPosts.id, id))
    .returning();
  return result;
},

async getSocialPostsByProject(projectId: string): Promise<SocialPost[]> {
  return db.select().from(socialPosts).where(eq(socialPosts.projectId, projectId));
},

async getSocialPostsByTask(taskId: string): Promise<SocialPost[]> {
  return db.select().from(socialPosts).where(eq(socialPosts.taskId, taskId));
},
```

### Validation Steps

1. **Test Late API Connection**
```bash
# Create test script: server/test-late-api.ts
import { lateService } from './services/late';

async function testConnection() {
  console.log('Testing Late API connection...');
  const isConnected = await lateService.testConnection();
  console.log(`Connection ${isConnected ? 'successful' : 'failed'}`);
}

testConnection();
```

2. **Run Database Migration**
```bash
npm run db:push
```

3. **Verify Tables Created**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'social_posts';
```

### Success Criteria
- ✅ Late API test connection returns `true`
- ✅ `social_posts` table exists in database
- ✅ Storage methods compile without errors
- ✅ No errors in server startup logs

---

## 🔧 Phase 2: Backend Integration

**Duration:** 4-6 hours
**Goal:** Create robust API endpoints for social posting with validation and error handling

### Dependencies
- ✅ Phase 1 completed (Late service & database schema)
- ✅ Express server running
- ✅ Existing routes structure

### Deliverables

#### 2.1 Social Posting Routes
**File:** `server/routes.ts` (add to existing registerRoutes function)

```typescript
import { lateService } from "./services/late";
import { storage } from "./storage";

// POST /api/social/post - Post a clip to social media
app.post("/api/social/post", async (req, res) => {
  try {
    const { projectId, platform, caption } = req.body;

    // Validate input
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({
        error: "projectId is required and must be a string"
      });
    }

    if (!platform || platform !== 'instagram') {
      return res.status(400).json({
        error: "Only Instagram is supported in this version"
      });
    }

    // Get project to verify it exists and get export URL
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Get the latest successful export for this project
    const exports = await storage.getExportsByTask(project.taskId);
    const projectExport = exports.find(
      (exp) => exp.projectId === projectId && exp.status === "ready"
    );

    if (!projectExport || !projectExport.srcUrl) {
      return res.status(400).json({
        error: "No ready export found for this project. Please export the clip first."
      });
    }

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

    // Post to Instagram via Late API
    try {
      const lateResponse = await lateService.postToInstagram({
        videoUrl: projectExport.srcUrl,
        caption: caption || '',
        contentType: 'reel',
      });

      // Extract platform-specific data
      const instagramPost = lateResponse.post.platforms.find(
        (p) => p.platform === 'instagram'
      );

      // Update social post with success
      const updatedPost = await storage.updateSocialPost(socialPost.id, {
        status: instagramPost?.status === 'published' ? 'published' : 'posting',
        latePostId: lateResponse.post._id,
        platformPostUrl: instagramPost?.platformPostUrl || null,
        lateResponse: lateResponse as any,
        publishedAt: instagramPost?.status === 'published' ? new Date() : null,
        errorMessage: instagramPost?.error || null,
      });

      res.json({
        success: true,
        post: updatedPost,
        platformUrl: instagramPost?.platformPostUrl,
      });
    } catch (lateError: any) {
      // Update social post with failure
      await storage.updateSocialPost(socialPost.id, {
        status: 'failed',
        errorMessage: lateError.message,
      });

      console.error("Late API error:", lateError);
      res.status(500).json({
        error: "Failed to post to Instagram",
        details: lateError.message
      });
    }
  } catch (error: any) {
    console.error("Error posting to social:", error);
    res.status(500).json({
      error: "Failed to create social post",
      details: error.message
    });
  }
});

// GET /api/social/posts/:projectId - Get social posts for a project
app.get("/api/social/posts/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const posts = await storage.getSocialPostsByProject(projectId);
    res.json({ posts });
  } catch (error: any) {
    console.error("Error fetching social posts:", error);
    res.status(500).json({
      error: "Failed to fetch social posts",
      details: error.message
    });
  }
});

// GET /api/social/posts/task/:taskId - Get all social posts for a task
app.get("/api/social/posts/task/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const posts = await storage.getSocialPostsByTask(taskId);
    res.json({ posts });
  } catch (error: any) {
    console.error("Error fetching social posts:", error);
    res.status(500).json({
      error: "Failed to fetch social posts",
      details: error.message
    });
  }
});
```

#### 2.2 Input Validation Schema
**File:** `server/validators/social.ts` (create new)

```typescript
import { z } from "zod";

export const postToSocialSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  platform: z.enum(["instagram"], {
    errorMap: () => ({ message: "Only Instagram is supported in this version" }),
  }),
  caption: z.string().max(2200, "Instagram caption limit is 2200 characters").optional(),
});

export type PostToSocialInput = z.infer<typeof postToSocialSchema>;
```

### Validation Steps

1. **Test POST /api/social/post with valid data**
```bash
curl -X POST http://localhost:8080/api/social/post \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test_project_id",
    "platform": "instagram",
    "caption": "Test post from Streamline AI"
  }'
```

2. **Test with invalid data (should return 400)**
```bash
# Missing projectId
curl -X POST http://localhost:8080/api/social/post \
  -H "Content-Type: application/json" \
  -d '{"platform": "instagram"}'

# Invalid platform
curl -X POST http://localhost:8080/api/social/post \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test", "platform": "tiktok"}'
```

3. **Test GET endpoints**
```bash
# Get posts by project
curl http://localhost:8080/api/social/posts/test_project_id

# Get posts by task
curl http://localhost:8080/api/social/posts/task/test_task_id
```

### Success Criteria
- ✅ POST /api/social/post returns 200 with valid data
- ✅ Invalid requests return appropriate 400/404 errors
- ✅ Social post records are created in database
- ✅ Late API is called and responses are stored
- ✅ Platform URLs are extracted and returned
- ✅ Error handling logs failures correctly

---

## 🎨 Phase 3: Frontend UI Components

**Duration:** 4-6 hours
**Goal:** Create intuitive UI for posting clips to social media

### Dependencies
- ✅ Phase 2 completed (Backend API ready)
- ✅ Existing React components and UI library
- ✅ VideoDetailPage component exists

### Deliverables

#### 3.1 Post to Social Button Component
**File:** `client/src/components/PostToSocialButton.tsx` (create new)

```typescript
import { useState } from 'react';
import { Button } from './ui/button';
import { Upload, CheckCircle2, XCircle } from 'lucide-react';
import { PostClipModal } from './PostClipModal';

interface PostToSocialButtonProps {
  projectId: string;
  exportUrl: string | null;
  disabled?: boolean;
}

export function PostToSocialButton({
  projectId,
  exportUrl,
  disabled
}: PostToSocialButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    if (!exportUrl) {
      alert('Please export this clip before posting to social media.');
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled || !exportUrl}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Post to Instagram
      </Button>

      <PostClipModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        projectId={projectId}
        exportUrl={exportUrl}
      />
    </>
  );
}
```

#### 3.2 Post Clip Modal Component
**File:** `client/src/components/PostClipModal.tsx` (create new)

```typescript
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';

interface PostClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  exportUrl: string | null;
}

export function PostClipModal({
  isOpen,
  onClose,
  projectId,
  exportUrl
}: PostClipModalProps) {
  const [caption, setCaption] = useState('');
  const queryClient = useQueryClient();

  const postMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          platform: 'instagram',
          caption,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to post');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts', projectId] });
    },
  });

  const handlePost = () => {
    postMutation.mutate();
  };

  const handleClose = () => {
    if (!postMutation.isPending) {
      setCaption('');
      postMutation.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Post Clip to Instagram</DialogTitle>
          <DialogDescription>
            Your clip will be posted as a Reel to Instagram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {postMutation.isIdle && (
            <>
              <div className="space-y-2">
                <Label htmlFor="caption">Caption (optional)</Label>
                <Textarea
                  id="caption"
                  placeholder="Add a caption for your Reel..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={2200}
                  rows={4}
                  disabled={postMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  {caption.length} / 2200 characters
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  disabled={postMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePost}
                  disabled={postMutation.isPending || !exportUrl}
                  className="flex-1"
                >
                  {postMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    'Post to Instagram'
                  )}
                </Button>
              </div>
            </>
          )}

          {postMutation.isSuccess && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="space-y-2">
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Successfully posted to Instagram!
                </p>
                {postMutation.data.platformUrl && (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-green-700"
                    asChild
                  >
                    <a
                      href={postMutation.data.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      View on Instagram
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {postMutation.isError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">Failed to post</p>
                <p className="text-sm">
                  {postMutation.error instanceof Error
                    ? postMutation.error.message
                    : 'An unknown error occurred'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => postMutation.reset()}
                >
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {(postMutation.isSuccess || postMutation.isError) && (
          <Button onClick={handleClose} className="w-full">
            Close
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

#### 3.3 Update ShortCard Component
**File:** `client/src/components/ShortCard.tsx` (modify existing)

```typescript
// Add import
import { PostToSocialButton } from './PostToSocialButton';

// Inside the component's return, add button after Download button:
<PostToSocialButton
  projectId={project.id}
  exportUrl={exportData?.srcUrl || null}
  disabled={exportData?.status !== 'ready'}
/>
```

#### 3.4 Social Posts History Component (Optional)
**File:** `client/src/components/SocialPostsHistory.tsx` (create new)

```typescript
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SocialPostsHistoryProps {
  projectId: string;
}

export function SocialPostsHistory({ projectId }: SocialPostsHistoryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['social-posts', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/social/posts/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      return await response.json();
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading posts...</div>;
  }

  if (!data?.posts?.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Social Media Posts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.posts.map((post: any) => (
          <div
            key={post.id}
            className="flex items-center justify-between py-2 border-b last:border-0"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">{post.platform}</span>
                <Badge
                  variant={
                    post.status === 'published'
                      ? 'default'
                      : post.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {post.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </p>
            </div>

            {post.platformPostUrl && (
              <a
                href={post.platformPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

### Validation Steps

1. **Visual Testing**
   - Navigate to video details page
   - Verify "Post to Instagram" button appears on each clip card
   - Click button - modal should open
   - Enter caption and post
   - Verify success/error states display correctly

2. **Interaction Testing**
   - Test with clips that haven't been exported (button should be disabled)
   - Test with ready exports (button should be enabled)
   - Test caption character limit (should truncate at 2200)
   - Test canceling the modal
   - Test posting with and without caption

3. **Responsive Testing**
   - Test modal on mobile screen sizes
   - Verify button layout on small screens

### Success Criteria
- ✅ "Post to Instagram" button visible on clip cards
- ✅ Modal opens with caption input
- ✅ Posting flow works end-to-end
- ✅ Success state shows Instagram URL
- ✅ Error states display helpful messages
- ✅ Loading states prevent duplicate submissions
- ✅ UI is responsive on mobile

---

## 🧪 Phase 4: Testing & Polish

**Duration:** 2-3 hours
**Goal:** Comprehensive testing and refinement

### Test Cases

#### Integration Tests

**Test 1: Complete Happy Path**
```
1. Generate a clip via existing pipeline
2. Wait for clip to be ready and exported
3. Click "Post to Instagram" button
4. Enter caption
5. Submit
6. Verify:
   - POST /api/social/post returns 200
   - Database record created in social_posts
   - Instagram URL returned
   - Success message displayed
```

**Test 2: Error Handling - No Export**
```
1. Navigate to clip that hasn't been exported
2. Click "Post to Instagram" button
3. Verify: Button is disabled or shows error message
```

**Test 3: Error Handling - API Failure**
```
1. Temporarily invalidate LATE_API_KEY in .env
2. Try to post a clip
3. Verify:
   - Error message displayed in UI
   - Status recorded as 'failed' in database
   - User can retry
4. Restore valid API key
```

**Test 4: Caption Limits**
```
1. Enter caption > 2200 characters
2. Verify: Input is truncated or disabled at limit
3. Character counter updates correctly
```

**Test 5: Concurrent Requests**
```
1. Open two browser tabs
2. Post same clip from both tabs simultaneously
3. Verify: Both requests handled gracefully
```

#### Edge Cases

**Test 6: Invalid Project ID**
```bash
curl -X POST http://localhost:8080/api/social/post \
  -H "Content-Type: application/json" \
  -d '{"projectId": "nonexistent", "platform": "instagram"}'
# Expected: 404 Not Found
```

**Test 7: Expired Export URL**
```
1. Post clip with expired Klap export URL
2. Verify: Late API error is caught and displayed
```

**Test 8: Network Timeout**
```
1. Simulate slow network (Chrome DevTools)
2. Submit post
3. Verify: Loading state persists, timeout handled
```

### Polish Checklist

#### UX Improvements
- [ ] Add tooltip explaining Instagram Reel format
- [ ] Show preview of caption with hashtags highlighted
- [ ] Add success animation (confetti or checkmark)
- [ ] Improve loading state with progress indicator
- [ ] Add keyboard shortcuts (Escape to close modal)

#### Accessibility
- [ ] Modal is keyboard navigable
- [ ] Focus trap in modal
- [ ] ARIA labels on all interactive elements
- [ ] Screen reader announces success/error states
- [ ] Color-blind friendly status indicators

#### Performance
- [ ] Debounce caption input if needed
- [ ] Lazy load PostClipModal component
- [ ] Optimize re-renders with React.memo if needed
- [ ] Add request caching for social posts history

#### Error Messages
- [ ] Clear, actionable error messages
- [ ] Log errors to console for debugging
- [ ] Provide "Contact Support" link for persistent failures
- [ ] Rate limiting feedback if applicable

### Validation Steps

Run full test suite:
```bash
# Backend API tests
npm run test:api

# Frontend component tests
npm run test:ui

# E2E tests (if configured)
npm run test:e2e
```

### Success Criteria
- ✅ All test cases pass
- ✅ No console errors or warnings
- ✅ Error handling is graceful and informative
- ✅ UX polish items completed
- ✅ Performance is acceptable (< 3s for post submission)
- ✅ Accessibility requirements met

---

## 📚 Phase 5: Documentation & Future Planning

**Duration:** 1-2 hours
**Goal:** Document implementation and plan next steps

### Deliverables

#### 5.1 API Documentation
**File:** `docs/api/social-posting.md` (create new)

```markdown
# Social Posting API

## POST /api/social/post

Post a generated clip to social media.

**Request Body:**
- `projectId` (string, required): ID of the project/clip to post
- `platform` (string, required): Platform to post to (currently only 'instagram')
- `caption` (string, optional): Caption for the post (max 2200 chars)

**Response:**
- `success` (boolean): Whether the post was created
- `post` (object): Social post record from database
- `platformUrl` (string): Public URL on social platform

**Status Codes:**
- 200: Success
- 400: Invalid input or export not ready
- 404: Project not found
- 500: Server or API error

**Example:**
```bash
curl -X POST http://localhost:8080/api/social/post \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "abc123",
    "platform": "instagram",
    "caption": "Check out this amazing clip!"
  }'
```

## GET /api/social/posts/:projectId

Get all social posts for a specific project.

**Response:**
- `posts` (array): List of social post records

## GET /api/social/posts/task/:taskId

Get all social posts for all projects in a task.

**Response:**
- `posts` (array): List of social post records
```

#### 5.2 User Guide
**File:** `docs/user-guide/social-posting.md` (create new)

```markdown
# Social Posting User Guide

## How to Post Clips to Instagram

1. **Generate your clips:**
   - Submit a YouTube video URL as usual
   - Wait for clips to be generated and exported

2. **Post to Instagram:**
   - Navigate to the video details page
   - Find the clip you want to post
   - Ensure the clip is exported (green "Ready" badge)
   - Click "Post to Instagram" button

3. **Add caption (optional):**
   - Enter a caption (max 2200 characters)
   - Hashtags and emojis are supported
   - Click "Post to Instagram"

4. **View on Instagram:**
   - After posting, click "View on Instagram" link
   - Your clip will appear as a Reel on your account

## Troubleshooting

**"No export found" error:**
- Ensure the clip has been exported
- Click "Export" button and wait for it to complete

**"Failed to post" error:**
- Check your internet connection
- Verify Instagram account is connected
- Contact support if issue persists

**Clip doesn't appear on Instagram:**
- Instagram may take a few minutes to process
- Check your Instagram account directly
- View post history on the details page
```

#### 5.3 Future Enhancements Roadmap
**File:** `docs/roadmap/social-posting-v2.md` (create new)

```markdown
# Social Posting V2+ Roadmap

## Planned Features

### Multi-Platform Support
**Priority:** High
**Estimated Effort:** 3-4 weeks

- TikTok integration
- YouTube Shorts
- LinkedIn
- Twitter/X
- Facebook

**Implementation:**
- Extend Late service with platform-specific methods
- Update UI to show platform selector
- Add platform-specific validation
- Platform-specific caption limits and requirements

### User Authentication & Profiles
**Priority:** High
**Estimated Effort:** 4-6 weeks

- User sign-up and login
- Late.dev profile per user
- OAuth connection flow
- Manage multiple social accounts per user

**Implementation:**
- Add authentication middleware (Passport.js)
- User management endpoints
- Late.dev profile creation per user
- OAuth redirect handling
- Account connection UI

### Scheduled Posting
**Priority:** Medium
**Estimated Effort:** 2-3 weeks

- Schedule posts for future time
- Queue management
- Time zone handling
- Edit/cancel scheduled posts

**Implementation:**
- Use Late.dev queue API
- Add scheduling UI component
- Background job processing
- Notification system for scheduled posts

### Analytics & Insights
**Priority:** Medium
**Estimated Effort:** 3-4 weeks

- View counts
- Engagement metrics (likes, comments, shares)
- Performance comparisons
- Best time to post recommendations

**Implementation:**
- Polling for post metrics
- Analytics dashboard
- Data visualization components
- Machine learning for recommendations

### Content Management
**Priority:** Low
**Estimated Effort:** 2 weeks

- Edit posts after publishing
- Delete posts
- Repost to additional platforms
- Cross-post automation

**Implementation:**
- Platform API updates
- Bulk operations
- Content versioning

### Advanced Features
**Priority:** Low
**Estimated Effort:** Varies

- AI-generated captions
- Hashtag recommendations
- Thumbnail customization
- Collaboration features (team posting)
- Content calendar view
- A/B testing for captions

## Technical Debt

### Immediate
- Add comprehensive error logging
- Implement rate limiting
- Add request retry logic
- Optimize database queries

### Short-term
- Add caching layer (Redis)
- Implement webhook handlers for Late.dev
- Add monitoring and alerts
- Performance profiling

### Long-term
- Microservices architecture
- Event-driven architecture
- Scalability improvements
- Load testing
```

### Validation Steps

1. **Documentation Review**
   - [ ] All API endpoints documented
   - [ ] Code examples are accurate
   - [ ] User guide is clear and complete
   - [ ] Roadmap is realistic and prioritized

2. **Knowledge Transfer**
   - [ ] Team walkthrough scheduled
   - [ ] Demo prepared
   - [ ] Questions documented

### Success Criteria
- ✅ All documentation files created
- ✅ API endpoints fully documented with examples
- ✅ User guide covers all common scenarios
- ✅ Roadmap prioritized and estimated
- ✅ Technical debt identified

---

## 🔒 Security Considerations

### Implemented
- ✅ LATE_API_KEY stored server-side only
- ✅ Input validation on all API endpoints
- ✅ Error messages don't expose sensitive data
- ✅ HTTPS for all external API calls

### Recommended
- [ ] Add rate limiting per IP/user
- [ ] Implement CSRF protection
- [ ] Add request signing
- [ ] Log security events
- [ ] Regular security audits

---

## 📊 Metrics & Monitoring

### Key Metrics to Track

**Usage Metrics:**
- Total posts created
- Posts by platform
- Success vs failure rate
- Average time to post

**Performance Metrics:**
- API response times
- Late.dev API latency
- Database query performance
- Frontend render times

**Business Metrics:**
- User engagement with feature
- Conversion from clip generation to posting
- Platform popularity

### Monitoring Setup

**Recommended Tools:**
- Application logging (Winston/Pino)
- Error tracking (Sentry)
- Performance monitoring (New Relic/DataDog)
- Uptime monitoring (Pingdom)

**Alerts:**
- API error rate > 5%
- Response time > 5 seconds
- Late.dev API unavailable
- Database connection failures

---

## ✅ Definition of Done

### Overall Project Completion Criteria

- [x] Phase 1: Environment & API validation complete
- [x] Phase 2: Backend API endpoints working
- [x] Phase 3: Frontend UI functional and polished
- [x] Phase 4: All tests passing
- [x] Phase 5: Documentation complete

### Feature Completeness

- [ ] User can post clips to Instagram from UI
- [ ] Posts appear on Instagram as Reels
- [ ] Success/error states are clear
- [ ] Post history is tracked in database
- [ ] No breaking changes to existing pipeline
- [ ] Code is reviewed and approved
- [ ] Documentation is complete and accurate

### Non-Functional Requirements

- [ ] Performance acceptable (< 3s post time)
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Mobile responsive
- [ ] Error handling comprehensive
- [ ] Logging implemented
- [ ] Security best practices followed

---

## 🚀 Deployment Plan

### Pre-Deployment Checklist

- [ ] All tests passing in staging
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Rollback plan documented
- [ ] Team notified of deployment

### Deployment Steps

1. **Database Migration**
```bash
npm run db:push
# Verify social_posts table exists
```

2. **Environment Variables**
```bash
# Verify in production .env:
LATE_API_KEY=sk_...
LATE_BASE_PROFILE_ID=...
```

3. **Deploy Backend**
```bash
git push origin main
# Wait for build to complete
# Verify server health check
```

4. **Deploy Frontend**
```bash
# Vite build automatically deployed with backend
# Verify client loads correctly
```

5. **Smoke Test**
- [ ] Generate a clip
- [ ] Post to Instagram
- [ ] Verify on Instagram
- [ ] Check database records

### Rollback Plan

If issues occur:
```bash
# Revert to previous commit
git revert <commit-hash>
git push origin main

# Or disable feature flag
# Set ENABLE_SOCIAL_POSTING=false in .env
```

---

## 🤝 Support & Troubleshooting

### Common Issues

**Issue:** "Late API Error: 401"
- **Cause:** Invalid or expired API key
- **Solution:** Verify LATE_API_KEY in .env

**Issue:** "No export found"
- **Cause:** Clip hasn't been exported yet
- **Solution:** Export clip first, then post

**Issue:** "Failed to post to Instagram"
- **Cause:** Late.dev API issue or network problem
- **Solution:** Check Late.dev status, retry after a few minutes

### Getting Help

- **Documentation:** Check `docs/` folder
- **Issues:** Create GitHub issue with logs and steps to reproduce
- **Support:** Contact development team via Slack

---

## 📝 Change Log

### Version 1.0 (Current)
- Initial implementation
- Instagram posting support
- Basic UI components
- Database schema for social posts

### Planned Updates
- See `docs/roadmap/social-posting-v2.md`

---

**End of Implementation Plan**

This document will be updated as the project evolves. For questions or suggestions, please open an issue or contact the development team.
