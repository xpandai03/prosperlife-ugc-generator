# Video Conversion Fix - userId NULL Constraint Violation

**Date:** October 28, 2025
**Issue:** `null value in column "user_id" of relation "folders" violates not-null constraint`
**Status:** ✅ FIXED

---

## Problem Summary

After Phase 4 UUID migration, video processing failed with database constraint violations. Background workflows lost user context, causing NULL userId values when creating folders, projects, and exports.

### Root Cause

**Before Phase 4:**
- Tables used `user_id INTEGER` with default value (likely 1)
- No strict NOT NULL enforcement

**After Phase 4:**
- Schema changed to `userId: uuid("user_id").notNull()`
- No default value
- Database enforces NOT NULL constraint
- Background workflows run outside HTTP request context → no `req.userId` available

### Error Flow

```
1. POST /api/videos → Creates task with req.userId ✅
2. Starts background workflow → processCompleteWorkflow(taskId) ❌ No userId parameter
3. Workflow tries to create folder → storage.createFolder({ id, taskId }) ❌ Missing userId
4. Database error → "null value in column user_id violates not-null constraint" 💥
```

---

## Files Modified

**Only one file changed:** `server/routes.ts`

### Changes Made

1. **Updated `fetchAndStoreProjects()` signature** (line 733)
   - Added `userId: string` parameter
   - Pass userId when creating folders and projects

2. **Fixed folder creation** (line 738-742)
   - Added `userId` to folder creation object

3. **Fixed project creation** (line 752-761)
   - Added `userId` to project creation object

4. **Fixed `processVideoTask()` function** (line 703-709)
   - Fetch task to get userId before calling `fetchAndStoreProjects()`

5. **Fixed `processCompleteWorkflow()` function** (line 1041-1070)
   - Fetch task at beginning to get userId
   - Pass userId to `fetchAndStoreProjects()`
   - Add userId to export creation (line 1099)

6. **Fixed GET /api/videos/:id endpoint** (line 320)
   - Pass task.userId to `fetchAndStoreProjects()`

7. **Fixed POST /api/videos/:id/export endpoint** (line 406)
   - Add `userId: req.userId!` to export creation

8. **Fixed `runAutoExportPipeline()` function** (line 882)
   - Use `project.userId` for export creation

---

## Testing Instructions

### 1. Local Testing (Development)

#### Step 1: Start Development Server

```bash
cd /Users/raunekpratap/Desktop/Streamline-replit-copy
npm run dev
```

Server should start on port 5000.

#### Step 2: Get Authentication Token

1. **Option A: Use existing user**
   - Log in to your frontend at http://localhost:5000
   - Open browser DevTools → Application → Local Storage
   - Copy the Supabase auth token

2. **Option B: Create test user via Supabase**
   ```sql
   -- In Supabase SQL Editor
   INSERT INTO auth.users (id, email, encrypted_password)
   VALUES (
     gen_random_uuid(),
     'test@example.com',
     crypt('test123', gen_salt('bf'))
   );
   ```

3. **Get token programmatically:**
   ```bash
   curl -X POST https://hfnmgonoxkjaqlelnqwc.supabase.co/auth/v1/token \
     -H "apikey: YOUR_SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "test123",
       "grant_type": "password"
     }'
   ```

#### Step 3: Submit Test Video

```bash
export AUTH_TOKEN="your-jwt-token-here"

curl -X POST http://localhost:5000/api/videos \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceVideoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "autoExport": true
  }'
```

**Expected Response:**
```json
{
  "taskId": "klap_task_xxx",
  "status": "processing"
}
```

#### Step 4: Monitor Logs

Watch server logs for:

```
[Workflow] Starting complete workflow for task klap_task_xxx
[Workflow] Task complete. Folder ID: folder_xxx
[Workflow] Generated 5 projects
[Workflow] Exporting first project: project_xxx
[Workflow] Export complete! URL: https://...
```

**✅ Success indicators:**
- No "null value in column user_id" errors
- Folders, projects, and exports created successfully
- Workflow completes without errors

**❌ Failure indicators:**
- Database constraint violation errors
- Workflow crashes or hangs
- Missing userId in logs

#### Step 5: Verify Database

```sql
-- Check folders have user_id
SELECT id, task_id, user_id, created_at
FROM folders
ORDER BY created_at DESC
LIMIT 5;

-- Check projects have user_id
SELECT id, task_id, user_id, name
FROM projects
ORDER BY created_at DESC
LIMIT 5;

-- Check exports have user_id
SELECT id, task_id, user_id, status, src_url
FROM exports
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** All records should have populated `user_id` (UUID format)

---

### 2. Production Testing (Render)

#### Step 1: Deploy to Render

```bash
# Commit changes
git add server/routes.ts docs/video-conversion-fix.md
git commit -m "Fix: Add userId to background workflow operations

- Update fetchAndStoreProjects to accept userId parameter
- Add userId to folder, project, and export creation
- Fetch task in background workflows to propagate userId
- Fixes 'null value in column user_id' constraint violation

Resolves video processing failures after Phase 4 UUID migration"

# Push to main
git push origin main
```

Render will automatically deploy (check dashboard for status).

#### Step 2: Test via Production Frontend

1. Go to https://launchready-streamline-mvp.onrender.com
2. Log in with test account
3. Submit a video URL for processing
4. Monitor the task status page

#### Step 3: Check Render Logs

In Render Dashboard → Logs:

```
Search for: [Workflow]
```

**Look for:**
- `[Workflow] Starting complete workflow`
- `[Workflow] Task complete. Folder ID:`
- `[Workflow] Generated X projects`
- `[Workflow] Export complete!`

**Should NOT see:**
- `null value in column "user_id"`
- `constraint violation`
- Workflow error messages

#### Step 4: Verify Production Database

In Supabase Dashboard → SQL Editor:

```sql
-- Check recent folders
SELECT id, task_id, user_id, created_at
FROM folders
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check recent projects
SELECT id, task_id, user_id, name
FROM projects
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check recent exports
SELECT id, task_id, user_id, status
FROM exports
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Expected:** All have valid UUID user_id values

---

### 3. Edge Case Testing

#### Test Case 1: Multiple Concurrent Videos

```bash
# Submit 3 videos simultaneously
for i in {1..3}; do
  curl -X POST http://localhost:5000/api/videos \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "sourceVideoUrl": "https://www.youtube.com/watch?v=VIDEO_'$i'",
      "autoExport": true
    }' &
done
wait
```

**Expected:** All 3 workflows complete successfully with correct userId

#### Test Case 2: Manual Export After Auto-Export

1. Submit video with `autoExport: false`
2. Wait for task to complete
3. Manually trigger export via UI or API
4. Verify export has correct userId

```bash
# Manual export
curl -X POST http://localhost:5000/api/videos/TASK_ID/export \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "PROJECT_ID"}'
```

#### Test Case 3: Different Users

1. Create 2 test users
2. Submit videos from both users
3. Verify each user's data is properly isolated
4. Check that userId matches the authenticated user

```sql
-- Verify isolation
SELECT u.email, COUNT(t.*) as task_count
FROM users u
LEFT JOIN tasks t ON t.user_id = u.id
GROUP BY u.id, u.email;
```

---

## Troubleshooting

### Problem: Still seeing "null value in column user_id"

**Check 1: Is task created with userId?**
```sql
SELECT id, user_id, status FROM tasks ORDER BY created_at DESC LIMIT 5;
```
- If NULL → Auth middleware not working
- If populated → Issue in background workflow

**Check 2: Are logs showing userId propagation?**
```
Search logs for: "Task ${taskId} not found"
```
- If found → Task fetch failing in workflow
- If not found → userId not being passed

**Check 3: Is the fix deployed?**
```bash
# Check deployed code
grep -n "fetchAndStoreProjects.*userId" server/routes.ts
```
- Should show updated function signature
- Should show 3 parameters, not 2

### Problem: Video processing hangs/times out

**Check 1: Klap API connectivity**
```bash
curl -X GET https://klap-api-url/status
```

**Check 2: Task stuck in "processing"**
```sql
SELECT id, status, error_message, updated_at
FROM tasks
WHERE status = 'processing'
AND updated_at < NOW() - INTERVAL '30 minutes';
```

**Check 3: Background workflow errors**
```
Search Render logs for: [Workflow] Error
```

### Problem: Exports created but no userId

**This should not happen after fix, but if it does:**

1. Check which endpoint created the export:
   ```sql
   SELECT id, task_id, user_id, is_auto_export, created_at
   FROM exports
   WHERE user_id IS NULL;
   ```

2. If `is_auto_export = 'true'` → Issue in processCompleteWorkflow
3. If `is_auto_export = 'false'` → Issue in manual export endpoint

4. Manually fix NULL userId (emergency only):
   ```sql
   UPDATE exports e
   SET user_id = t.user_id
   FROM tasks t
   WHERE e.task_id = t.id
   AND e.user_id IS NULL;
   ```

---

## Rollback Plan (Emergency)

If this fix causes issues:

### Option 1: Revert Commit

```bash
git revert HEAD
git push origin main
```

### Option 2: Make userId Nullable (Temporary)

**NOT RECOMMENDED** - Breaks multi-tenancy model

```sql
-- Emergency fix only
ALTER TABLE folders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE exports ALTER COLUMN user_id DROP NOT NULL;
```

Then update records:
```sql
UPDATE folders SET user_id = (
  SELECT user_id FROM tasks WHERE tasks.id = folders.task_id
) WHERE user_id IS NULL;

UPDATE projects SET user_id = (
  SELECT user_id FROM tasks WHERE tasks.id = projects.task_id
) WHERE user_id IS NULL;

UPDATE exports SET user_id = (
  SELECT user_id FROM tasks WHERE tasks.id = exports.task_id
) WHERE user_id IS NULL;
```

---

## Success Criteria

✅ Video submission creates task with userId
✅ Background workflow fetches and propagates userId
✅ Folders created with valid userId
✅ Projects created with valid userId
✅ Exports created with valid userId
✅ Manual exports have userId
✅ Auto-exports have userId
✅ No constraint violation errors
✅ Multi-tenant isolation maintained
✅ Production deployment successful

---

## Related Documentation

- [Phase 4 Implementation](./phased-auth-implementation.md)
- [UUID Migration Guide](./phase4-uuid-migration.md)
- [Build Logs](./28-oct-buildlogs.md)

---

## Questions?

If you encounter issues not covered in this document:

1. Check Render logs: https://dashboard.render.com
2. Check Supabase logs: https://supabase.com/dashboard
3. Review this fix: `git show HEAD`
4. Search for similar errors in commit history
