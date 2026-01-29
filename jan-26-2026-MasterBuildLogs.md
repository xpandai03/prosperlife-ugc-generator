**🔹 Claude Alignment Prompt (NO CODE, NO PLAN YET)**
-----------------------------------------------------

> **Important:** This is an alignment and context-ingestion prompt only.

> Do NOT propose code changes yet.

> Do NOT write an implementation plan yet.

> First acknowledge understanding and restate the system in your own words.

* * * * *

### **Prompt**

You are acting as a senior product + systems engineer embedded inside an existing web app called **Streamline**.

Your task right now is **NOT** to implement anything and **NOT** to propose code changes yet.

Your task is to **fully understand and align** on a new feature we are about to build, including:

-   the product intent

-   the architectural direction

-   the constraints

-   what this feature *is* and *is not*

After you confirm understanding, I will explicitly ask you to switch to Plan Mode later.

* * * * *

**Context: What Streamline Is**
-------------------------------

Streamline is an AI-powered video automation web app that already supports:

-   short-form video generation

-   video clipping

-   AI-generated voiceovers

-   automated posting / scheduling

-   background jobs and render workflows

Streamline is already capable of generating and distributing video content.

This new feature will **reuse existing infrastructure wherever possible**.

* * * * *

**The New Feature (High-Level)**
--------------------------------

We are introducing a new feature inside Streamline called (working name):

**Content Engine**

This is NOT:

-   a generic video editor

-   a YouTube automation gimmick

-   a SaaS polished flow (yet)

This IS:

-   a programmable content pipeline

-   designed for long-form, faceless or semi-faceless video creation

-   optimized for automation first, quality second (with a premium path)

* * * * *

**Core Insight**
----------------

We have identified that modern AI video systems fall into **two distinct renderer categories**:

### **1\. Automation Renderers (fast, cheap, scalable)**

Examples:

-   JSON-based video renderers

-   image + voice + subtitle pipelines

-   template-driven video generation

These are best for:

-   faceless long-form content

-   motivational / narration channels

-   volume and low marginal cost

### **2\. Code-Based Renderers (premium, programmable)**

Examples:

-   Claude Code + Remotion

-   video-as-code via React components

-   programmatic animations and demos

These are best for:

-   explainers

-   product demos

-   authority / sales content

They are **not** meant to run hourly or at massive scale.

* * * * *

**Key Architectural Decision**
------------------------------

We are **not** building separate features for each renderer.

Instead, we are building a **renderer-agnostic content engine**.

At the center of this engine is a single canonical object:

### **SceneSpec (very important)**

Every video --- regardless of renderer --- is represented as a structured scene specification:

-   video metadata (title, description, tags)

-   target duration

-   ordered scenes

-   each scene has:

    -   voiceover text

    -   visual intent / prompt

    -   optional timing or style hints

Renderers simply **consume SceneSpec and output a video**.

* * * * *

**What This Feature Does (Conceptually)**
-----------------------------------------

1.  User sets direction once:

    -   niche

    -   tone

    -   cadence

    -   preferred renderer (fast vs premium)

2.  System generates SceneSpecs automatically on a schedule or trigger

3.  SceneSpecs are passed to a renderer:

    -   Automation Renderer (default)

    -   Claude + Remotion Renderer (premium / on-demand)

4.  Resulting videos flow through existing Streamline:

    -   rendering

    -   storage

    -   posting

    -   scheduling

    -   error handling

* * * * *

**What This Feature Explicitly Does NOT Do (for now)**
------------------------------------------------------

-   No advanced analytics

-   No public SaaS onboarding

-   No support for dozens of niches

-   No perfect autonomy

-   No heavy UI work

-   No code changes yet

This is an **internal engine + pilot-ready feature**, not a polished product.

* * * * *

**Constraints You Must Respect**
--------------------------------

-   Prefer reuse over new systems

-   Favor simple abstractions

-   Avoid over-engineering

-   Optimize for:

    -   fast validation

    -   revenue-backed development

    -   future extensibility

* * * * *

**Your Instructions (for this message only)**
---------------------------------------------

1.  **Do NOT write code**

2.  **Do NOT write an implementation plan yet**

3.  First, respond with:

    -   your understanding of the feature

    -   a concise restatement in your own words

    -   any clarifying questions that block alignment

Once alignment is confirmed, I will ask you to switch into **Plan Mode**.
My Understanding
Streamline is your existing video automation platform (the codebase I'm in). It already handles the "last mile" of video content: generation, storage, posting, scheduling, and background job orchestration.
Content Engine is a new upstream layer you want to add. It's not a product feature in the traditional sense—it's a programmable content pipeline that feeds into Streamline's existing infrastructure.
The Core Abstraction: SceneSpec
The key insight is that all video content—regardless of how it's rendered—can be represented as a single canonical object called SceneSpec:
Metadata (title, description, tags)
Target duration
Ordered list of scenes, where each scene contains:
Voiceover text
Visual intent (prompt or directive)
Optional timing/style hints
This is the contract. Renderers are just consumers of this contract.
Two Renderer Paths (Same Input)
Renderer Type	Characteristics	Use Case
Automation	JSON/template-based, fast, cheap	Faceless long-form, motivational, volume plays
Code-Based	Claude + Remotion, programmable, premium	Explainers, demos, authority content
Both take SceneSpec in, video out. The user chooses their path based on intent and budget.
The Flow
User configures once: niche, tone, cadence, renderer preference
System generates SceneSpecs: on schedule or trigger (the "brain")
Renderer consumes SceneSpec: produces video asset
Existing Streamline takes over: storage, posting, scheduling, error handling
You're essentially building a content factory that plugs into your existing distribution machinery.
What This Is NOT
Not a video editor
Not a polished SaaS onboarding flow
Not trying to support every niche
Not fully autonomous (yet)
Not UI-heavy
It's an internal engine for pilot validation—revenue-backed, extensible later.
Clarifying Questions Before Alignment
SceneSpec generation: What creates the SceneSpec from user direction? I assume an LLM call that takes (niche + tone + cadence) and outputs structured scenes—correct?
Automation Renderer: Does Streamline already have a JSON/template video renderer, or is that net-new? (I saw KIE, Veo3, Sora2 in the codebase—are any of these the automation path, or is this a different pipeline?)
Code-Based Renderer: Is Claude + Remotion a future/premium track, or do you want both renderer paths functional from day one?
Pilot scope: Are we targeting one niche for initial validation? Manual trigger only, or scheduled from the start?
Storage: Does SceneSpec persist to the database as a first-class entity, or is it ephemeral (generated → rendered → discarded)?
Existing infra reuse: Which specific parts of Streamline do you want Content Engine to plug into? (e.g., the job queue, the video storage layer, the social posting system)
Once you clarify these, I'll be fully aligned and ready for Plan Mode on your signal.

**🔹 Claude Plan + Execution Mode Prompt**
------------------------------------------

> **IMPORTANT:**

> You are now switching into **Plan + Execution Mode**, but you must still **NOT write code yet**.

> Your task is to design the cleanest, most systematic implementation plan based on the aligned context below.

* * * * *

### **Prompt**

You are acting as a senior systems architect and product engineer embedded inside the **Streamline** codebase.

You are now fully aligned on the Content Engine concept and constraints.

Your task is to produce a **clean, phased implementation plan** that is:

-   minimal

-   systematic

-   reuse-first

-   pilot-ready

-   extensible

This plan will later be translated into concrete coding tasks.

* * * * *

**Locked Assumptions (Do Not Question These)**
----------------------------------------------

-   SceneSpec is the canonical abstraction and is **persisted**

-   SceneSpec is generated via an LLM call

-   Automation Renderer is the default path and should reuse existing Streamline pipelines

-   Claude + Remotion is a **planned but optional** premium renderer

-   Start with one niche, manual trigger first

-   Content Engine plugs into existing Streamline infra (jobs, storage, posting)

-   No SaaS polish, no analytics, no heavy UI

* * * * *

**Your Responsibilities in This Response**
------------------------------------------

### **1\. High-Level Architecture**

Explain:

-   where Content Engine sits in the Streamline system

-   how data flows from direction → SceneSpec → renderer → existing pipeline

### **2\. Core Data Models (Conceptual)**

Define:

-   SceneSpec (fields, lifecycle)

-   any minimal supporting entities (ChannelConfig, RenderJob, etc.)

No ORM or schema code yet --- just conceptual models.

* * * * *

### **3\. Renderer Abstraction Design**

Describe:

-   how renderers are abstracted

-   how Automation Renderer consumes SceneSpec

-   how Code-Based Renderer would plug in later without refactoring

* * * * *

### **4\. Execution Phases (Very Important)**

Break the work into **clear phases**, e.g.:

-   Phase 0: prep / refactors (if any)

-   Phase 1: SceneSpec generation

-   Phase 2: Automation Renderer integration

-   Phase 3: Job orchestration + storage

-   Phase 4: Premium renderer hook (design only)

Each phase should include:

-   goal

-   scope

-   success criteria

* * * * *

### **5\. What NOT to Build**

Explicitly list:

-   features to defer

-   assumptions to avoid

-   anti-patterns to watch for

* * * * *

### **6\. Risks & Simplifications**

Call out:

-   technical risks

-   where to intentionally cut corners for V1

-   what must stay clean vs what can be hacky

* * * * *

### **Output Format**

-   Use clear headings

-   Be concise but precise

-   Think like you are writing for a senior engineer who will implement this immediately after

* * * * *

### **Final Rule**

Do **not** write code.

Do **not** reference future prompts.

Do **not** over-optimize.

Produce the **best possible implementation plan** given the constraints.

* * * * *
All phases are complete. Here's a summary of what was implemented:
Content Engine Implementation Summary
Phase 0: Database Schema
Schema additions in shared/schema.ts:
channelConfigs table (user content direction settings)
sceneSpecs table (canonical content specifications)
Added sceneSpecId to mediaAssets for reverse lookup
Migration file: db/migrations/0013_content_engine.sql
Phase 1: SceneSpec Generation
Prompt templates: server/prompts/content-engine.ts
SceneSpec generator service: server/services/sceneSpecGenerator.ts
Storage operations: Added CRUD for ChannelConfig and SceneSpec
API endpoints:
POST /api/content-engine/configs - Create config
GET /api/content-engine/configs - List configs
GET /api/content-engine/configs/:id - Get config
PUT /api/content-engine/configs/:id - Update config
DELETE /api/content-engine/configs/:id - Delete config
POST /api/content-engine/generate-spec - Generate SceneSpec from config
GET /api/content-engine/specs - List specs
GET /api/content-engine/specs/:id - Get spec
PUT /api/content-engine/specs/:id - Update spec
DELETE /api/content-engine/specs/:id - Delete spec
POST /api/content-engine/specs/:id/approve - Approve for rendering
Phase 2: Automation Renderer
Base renderer interface: server/services/renderers/base.ts
Automation renderer: server/services/renderers/automation.ts
Transforms SceneSpec to KIE-compatible prompts
Uses existing Veo3/Sora2 pipeline
Background polling for completion
Links result to MediaAsset
Render endpoint: POST /api/content-engine/render/:id
Phase 3: End-to-End Flow
Content Engine UI page: client/src/pages/ContentEnginePage.tsx
Channel config management (create, list, delete)
SceneSpec generation and viewing
Render triggering with status display
Scene detail modal
Navigation: Added "Engine" link to navbar
Route: /content-engine in App.tsx
Phase 4: Premium Renderer Design
Placeholder service: server/services/renderers/codeBased.ts
Design document: docs/code-based-renderer-design.md
Key Files Created/Modified
New files:├── db/migrations/0013_content_engine.sql├── server/prompts/content-engine.ts├── server/services/sceneSpecGenerator.ts├── server/services/renderers/base.ts├── server/services/renderers/automation.ts├── server/services/renderers/codeBased.ts├── client/src/pages/ContentEnginePage.tsx└── docs/code-based-renderer-design.mdModified files:├── shared/schema.ts (added tables, types, relations)├── server/storage.ts (added CRUD operations)├── server/routes.ts (added Content Engine endpoints)├── client/src/App.tsx (added route)└── client/src/components/ui/mini-navbar.tsx (added nav link)
To use the Content Engine:
Run the database migration: db/migrations/0013_content_engine.sql
Navigate to /content-engine in the app
Create a Channel Config with niche, tone, and duration settings
Click "Generate Spec" to create a SceneSpec via LLM
Review the generated scenes and click "Render" to produce a video
can we push and deploy to git so i can test on railway app?

git status
	server/services/renderers/
	server/services/sceneSpecGenerator.ts

no changes added to commit (use "git add" and/or "git commit -a")
git log --oneline -3
26d1519 Fix: Enforce duration + 9:16 vertical + framing for UGC videos
038fc05 Fix: Close video modal after delete confirmation
5fe2b12 Fix: Stabilize UGC video generation with provider fallback

**🔹 CLEAR Debugging Prompt --- Content Engine Unauthorized Error**
-----------------------------------------------------------------

### **C --- Context**

We just deployed a new feature called **Content Engine** inside an existing app (**Streamline**) and are testing it in production on Railway.

The Content Engine page loads correctly at:

```
/content-engine
```

The UI renders, routing works, and authentication is generally working elsewhere in the app.

This feature introduces **Channel Configs** and **Scene Specs**, with new API endpoints under:

```
/api/content-engine/*
```

* * * * *

### **L --- Latest Action (What I Did)**

1.  Navigated to /content-engine

2.  Clicked **"New Config"**

3.  Filled out the form:

    -   Name: Productivity Channel

    -   Niche: business

    -   Tone: motivational

    -   Cadence: daily

    -   Default Duration: 60 seconds

4.  Clicked **"Create Config"**

* * * * *

### **E --- Error Observed**

#### **Frontend**

-   A red toast appears saying:

```
Error
Unauthorized
```

-   The modal does not close

-   No Channel Config is created

#### **Backend Logs**

-   The request hits the backend

-   The backend responds with **401 Unauthorized**

-   No database insert occurs

This is NOT a validation error --- it is an auth failure.

* * * * *

### **A --- Assumptions / Known Facts**

-   I am logged in (navbar shows authenticated user)

-   Other authenticated parts of the app work

-   This error only happens when hitting **Content Engine endpoints**

-   The page loads, but the **POST request fails**

-   Likely causes include:

    -   missing auth middleware on new routes

    -   incorrect auth context extraction (req.user)

    -   mismatch between frontend fetch and backend auth expectations

    -   route not included in protected router

    -   incorrect HTTP method or path mismatch

* * * * *

### **R --- Request (What I Want You To Do)**

Please **systematically debug** this issue.

Specifically:

1.  Identify **why POST /api/content-engine/configs is returning 401**

2.  Trace:

    -   frontend request

    -   auth headers / cookies

    -   backend route handler

    -   auth middleware

3.  Determine whether:

    -   the route is missing auth middleware

    -   the route is using the wrong auth helper

    -   the frontend request is not including credentials

4.  Propose the **minimal fix** required to make Channel Config creation succeed

5.  Explain **why this error happens** (root cause), not just the fix

* * * * *

### **Important Constraints**

-   Do NOT refactor unrelated auth logic

-   Do NOT weaken security

-   Prefer **consistency with existing Streamline routes**

-   Assume this is an integration bug, not a missing feature

* * * * *

### **Deliverable**

Your response should include:

1.  Root cause explanation

2.  Exact file(s) to inspect

3.  Minimal fix proposal

4.  Why this fix is correct and safe

Do **not** implement code yet unless explicitly asked.

* * * * *

If you paste this into Claude, it should give you a **clean, methodical diagnosis** instead of guessing.
### **C --- Context**

We are testing a newly implemented feature called **Content Engine** inside the Streamline app, deployed to **Railway (production environment)**.

The frontend page /content-engine loads correctly.

Authentication is now working.

API requests reach the backend.

We are attempting to create a **Channel Config**, which should insert into a new table:

```
channel_configs
```

This table was added in a recent migration:

```
db/migrations/0013_content_engine.sql
```

* * * * *

### **L --- Latest Action**

1.  Navigated to /content-engine

2.  Clicked **New Config**

3.  Filled out the form:

    -   Name: Motivational Channel

    -   Niche: business motivation

    -   Tone: motivational

    -   Cadence: daily

    -   Default Duration: 60 seconds

4.  Clicked **Create Config**

* * * * *

### **E --- Error Observed**

#### **Frontend**

-   Red toast:

```
Error
Failed to create channel config
```

#### **Backend Logs (important)**

```
[Content Engine] Error creating config:
error: relation "channel_configs" does not exist
code: '42P01'
routine: 'parserOpenTable'
```

Additional context:

-   User is authenticated

-   Storage.getUser succeeds

-   subscriptionStatus is free

-   The failure occurs **during DB insert**, not auth or validation

Request log:

```
POST /api/content-engine/configs 500
```

* * * * *

### **A --- Analysis / Known Facts**

-   The error relation "channel_configs" does not exist is a **Postgres error**

-   This means:

    -   The application code expects the table

    -   The database does NOT have the table

-   The table *was defined* in shared/schema.ts

-   A migration file **exists**:

```
db/migrations/0013_content_engine.sql
```

-   This error is occurring on **Railway**, not locally

Likely causes:

1.  Migration was never run on Railway

2.  Railway is pointing to a different database than expected

3.  Migration ran locally but not in production

4.  Migration runner is not wired into deploy flow

This is **not** a code bug.

* * * * *

### **R --- Request (What You Should Do)**

Please do the following **systematically**:

1.  Confirm why the channel_configs table does not exist in the Railway database

2.  Identify:

    -   how migrations are normally applied in Streamline

    -   whether Railway auto-runs migrations or requires manual execution

3.  Provide **exact steps** to:

    -   safely apply 0013_content_engine.sql to the Railway DB

    -   verify the table exists afterward

4.  Confirm whether any other Content Engine tables are also missing:

    -   scene_specs

5.  Explain how to prevent this issue for future migrations (lightweight recommendation)

* * * * *

### **Important Constraints**

-   Do NOT change application code

-   Do NOT add runtime table creation logic

-   Assume schema + migration files are correct

-   This is an environment / deployment issue, not a logic issue

* * * * *

### **Deliverable Format**

Your response should include:

1.  Root cause (why this happened)

2.  Verification steps (how to confirm)

3.  Fix steps (exact commands / UI actions)

4.  Post-fix validation checklist

Do NOT implement code.

Do NOT suggest refactors.

* * * * *

### **Extra Signal (for you)**

This error happens **after** auth and user resolution.

The fix should involve **running or re-running the migration**, not touching routes or services.

* * * * *
Let me investigate how migrations are handled in this project.
Root Cause Analysis
Why This Happened
Migrations are manual in this project - The db/migrations/*.sql files are not automatically executed on deploy
No migration runner in deploy pipeline - Looking at render.yaml, the start command is just npm run start with no migration step
The migration file exists but was never run on Railway - 0013_content_engine.sql was committed but not applied to production
This is expected behavior for this project - migrations require manual execution against the production database.
Tables That Need to Be Created
Both Content Engine tables are missing:
channel_configs - user content direction settings
scene_specs - canonical content specifications
Plus one column addition:
media_assets.scene_spec_id - for reverse lookup
Fix Steps
Option A: Railway Console (Recommended)
Open Railway Dashboard
Go to your Railway project
Click on the PostgreSQL database service (likely named streamline-db)
Open the Query Tab
Click "Data" or "Query" tab in the database service
Run the migration SQL
Copy the entire contents of db/migrations/0013_content_engine.sql:
-- Content Engine Migration (Jan 2026)-- Creates channel_configs and scene_specs tables for the Content Engine feature-- Channel Configs table - user's content direction settingsCREATE TABLE IF NOT EXISTS channel_configs (  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  name TEXT NOT NULL,  niche TEXT NOT NULL,  tone TEXT NOT NULL,  cadence TEXT,  renderer_preference TEXT NOT NULL DEFAULT 'automation',  default_duration INTEGER NOT NULL DEFAULT 60,  extra_directives JSONB,  is_active BOOLEAN NOT NULL DEFAULT true,  created_at TIMESTAMP NOT NULL DEFAULT now(),  updated_at TIMESTAMP NOT NULL DEFAULT now());-- Scene Specs table - canonical content specification objectCREATE TABLE IF NOT EXISTS scene_specs (  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  channel_config_id UUID NOT NULL REFERENCES channel_configs(id) ON DELETE CASCADE,  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  status TEXT NOT NULL DEFAULT 'draft',  title TEXT NOT NULL,  description TEXT,  tags JSONB,  target_duration INTEGER NOT NULL,  scenes JSONB NOT NULL,  renderer_type TEXT NOT NULL DEFAULT 'automation',  media_asset_id TEXT REFERENCES media_assets(id),  metadata JSONB,  error_message TEXT,  created_at TIMESTAMP NOT NULL DEFAULT now(),  updated_at TIMESTAMP NOT NULL DEFAULT now(),  rendered_at TIMESTAMP);-- Indexes for common queriesCREATE INDEX IF NOT EXISTS idx_channel_configs_user_id ON channel_configs(user_id);CREATE INDEX IF NOT EXISTS idx_channel_configs_is_active ON channel_configs(is_active);CREATE INDEX IF NOT EXISTS idx_scene_specs_user_id ON scene_specs(user_id);CREATE INDEX IF NOT EXISTS idx_scene_specs_channel_config_id ON scene_specs(channel_config_id);CREATE INDEX IF NOT EXISTS idx_scene_specs_status ON scene_specs(status);CREATE INDEX IF NOT EXISTS idx_scene_specs_media_asset_id ON scene_specs(media_asset_id);-- Add sceneSpecId to media_assets for reverse lookup (optional, but useful)ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS scene_spec_id UUID REFERENCES scene_specs(id);CREATE INDEX IF NOT EXISTS idx_media_assets_scene_spec_id ON media_assets(scene_spec_id);
Execute the query
Option B: psql Command Line
If you have the Railway database connection string:
psql "YOUR_RAILWAY_DATABASE_URL" -f db/migrations/0013_content_engine.sql
Or connect and paste:
psql "YOUR_RAILWAY_DATABASE_URL"# Then paste the SQL and press Enter
Post-Fix Validation Checklist
After running the migration, verify:
1. Check tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('channel_configs', 'scene_specs');
Expected: Both tables listed
2. Check column was added
SELECT column_name FROM information_schema.columns WHERE table_name = 'media_assets' AND column_name = 'scene_spec_id';
Expected: scene_spec_id listed
3. Test in app
Navigate to /content-engine
Click "New Config"
Fill out form and click "Create Config"
Should succeed with green toast "Config created"
Future Prevention (Lightweight Recommendation)
For future migrations, consider one of these approaches:
Document in PR/commit - Add a note that migration needs manual run on Railway
Add to deploy checklist - Keep a simple checklist of post-deploy steps
Use db:push - Drizzle's push command syncs schema automatically (but less controlled)
The current manual approach is fine for a small team - just needs a reminder step.
can u do all of this for me and push to railway again?

I can't directly access your Railway database from here - I don't have the connection credentials, and it's a security boundary I can't cross.
However, here's what you can do quickly:
Quick Steps (2 minutes)
1. Get your Railway Database URL
In Railway Dashboard:
Click on your PostgreSQL service
Go to "Variables" or "Connect" tab
Copy the DATABASE_URL (looks like postgresql://user:password@host:port/database)
2. Run the migration
Once you have the URL, you can run this command in your terminal:
psql "YOUR_DATABASE_URL_HERE" -f "db/migrations/0013_content_engine.sql"
Or if you don't have psql installed, you can:
Go to Railway Dashboard → Your Postgres service → "Data" tab
There's usually a Query interface
Paste the SQL from


**🔹 CLEAR Prompt --- Fix Content Engine Render Output + Duration**
-----------------------------------------------------------------

### **C --- Context**

We have successfully implemented a new feature called **Content Engine** inside an existing app (**Streamline**).

Content Engine:

-   generates **SceneSpecs** (structured scene-based video plans)

-   renders them using the existing **KIE (Veo3/Sora2) pipeline**

-   persists results as media_assets

-   tracks linkage via scene_spec_id

This feature is **intentionally reusing existing infrastructure** (KIE service, MediaAsset storage, polling).

* * * * *

### **L --- Latest Behavior (What's Wrong)**

When a SceneSpec finishes rendering:

1.  Clicking **"View Video"** on a Scene Spec:

    -   Redirects the user to **Prosper UGC / AI Studio**

    -   Shows the video under **UGC Ads**

2.  The rendered video:

    -   Is only **8 seconds long**

    -   Appears to be clamped by **UGC Ad constraints**

    -   Ignores the SceneSpec target duration (60s)

This is **not the intended behavior**.

* * * * *

### **E --- Expected Behavior**

For Content Engine renders:

#### **Viewing**

-   Clicking **"View Video"** should:

    -   Open a **Content Engine--specific viewer**

    -   Or route to something like:

```
/content-engine/specs/:id/video
```

-   -

    -   Display the rendered video directly (simple <video> is fine)

It should **not** redirect into Prosper UGC or AI Studio.

* * * * *

#### **Classification**

-   Content Engine videos should:

    -   Be distinguishable from UGC Ads

    -   Not appear in the UGC Ads gallery by default

-   We already have scene_spec_id on media_assets --- this should be used.

* * * * *

#### **Duration (Very Important)**

-   Content Engine videos are **NOT ads**

-   They are **long-form or mid-form content**

-   Expected durations:

    -   Default: **30--90 seconds**

    -   SceneSpec controls total duration

-   Content Engine renders must:

    -   **bypass UGC duration clamps**

    -   **ignore ad presets**

    -   respect SceneSpec target duration

8 seconds is explicitly incorrect.

* * * * *

### **A --- Analysis / Constraints**

-   The current behavior happens because:

    -   Content Engine reuses the **UGC render pipeline**

    -   That pipeline enforces:

        -   ad presets

        -   duration clamps (e.g. 8s fast mode)

-   This is expected given reuse --- but now needs differentiation.

Constraints:

-   ❌ Do NOT rebuild the renderer

-   ❌ Do NOT fork MediaAsset table

-   ❌ Do NOT break Prosper UGC flows

-   ❌ Do NOT duplicate KIE integration

-   ✅ Prefer small, explicit flags or metadata

-   ✅ Prefer reuse with conditional behavior

* * * * *

### **R --- Request (What To Do)**

Please propose a **minimal, clean fix** that:

1.  **Distinguishes Content Engine renders** from UGC Ads

    -   via scene_spec_id, source, or equivalent metadata

2.  **Routes "View Video" correctly**

    -   Content Engine → Content Engine viewer

    -   UGC Ads → existing AI Studio

3.  **Removes duration clamps for Content Engine**

    -   SceneSpec duration must be honored

    -   No 8-second limits

4.  **Keeps UGC behavior unchanged**

* * * * *

### **Deliverables**

Your response should include:

1.  Root cause explanation (why this happens today)

2.  Minimal design changes (conceptual)

3.  Exact files / layers to modify

4.  How to detect "content_engine mode" safely

5.  How to respect SceneSpec duration without breaking ads

Do **not** implement code yet unless explicitly asked.

* * * * *

### **Extra Clarification**

Think of this as:

> "Same engine, different mode."

UGC = ad mode

Content Engine = content mode

We want **one pipeline, two behaviors**, selected explicitly.

* * * * *
Let me analyze the current implementation to understand where the constraints are applied.
Root Cause Analysis
Issue 1: Duration (8 seconds instead of 60)
Why this happens:
The automation renderer has provider hard limits in server/services/renderers/automation.ts:
const DURATION_LIMITS = {  veo3: { min: 6, max: 20 },   // Max 20 seconds  sora2: { min: 6, max: 15 },  // Max 15 seconds};
These are provider API constraints, not arbitrary clamps:
Veo3: Supports 6-20 seconds max per generation
Sora2: Supports 6-15 seconds max (via n_frames 10/15)
A 60-second SceneSpec gets clamped to 20s for Veo3. The 8-second result is likely what the provider returned for that specific prompt (they don't guarantee exact duration).
Reality check: Single-call generation cannot produce 60-90 second videos with current providers. This is an API limitation, not a code bug.
Issue 2: "View Video" redirects to AI Studio
Why this happens:
In ContentEnginePage.tsx line ~490:
onClick={() => window.location.href = '/ai-studio'}
Hardcoded redirect instead of inline viewing or dedicated route.
Issue 3: Content Engine videos appear in UGC gallery
Why this happens:
storage.getMediaAssetsByUser() returns ALL assets with no filtering:
async getMediaAssetsByUser(userId: string): Promise<MediaAsset[]> {  return db.select().from(mediaAssets)    .where(and(      eq(mediaAssets.userId, userId),      isNull(mediaAssets.deletedAt)    ))  // No filter for sceneSpecId}
Content Engine assets have sceneSpecId set, but it's not used to separate them from UGC ads.
Minimal Design Changes
1. Detect "Content Engine mode" safely
Already in place: sceneSpecId field on mediaAssets table.
sceneSpecId IS NULL → UGC AdsceneSpecId IS NOT NULL → Content Engine
No new fields needed.
2. Separate galleries
File: server/storage.ts
Add parameter to getMediaAssetsByUser:
async getMediaAssetsByUser(userId: string, options?: {   excludeContentEngine?: boolean;  contentEngineOnly?: boolean; }): Promise<MediaAsset[]>
File: server/routes.ts (GET /api/ai/media)
Pass excludeContentEngine: true for UGC gallery.
3. Fix "View Video" routing
File: client/src/pages/ContentEnginePage.tsx
Replace redirect with inline video player or modal:
// Instead of: onClick={() => window.location.href = '/ai-studio'}// Show video directly using spec.mediaAssetId to fetch the resultUrl
4. Handle duration expectations
Option A (Recommended for now): Accept provider limits, adjust UI
Update ChannelConfig.defaultDuration max to 20 (Veo3 limit)
Show user-friendly message: "Max 20 seconds per video (provider limit)"
Update Content Engine UI to reflect actual capabilities
Option B (Future): Multi-segment rendering
For durations >20s, generate multiple segments
Stitch together server-side (requires ffmpeg or similar)
Significantly more complex
Files to Modify
File	Change
server/storage.ts	Add filtering options to getMediaAssetsByUser
server/routes.ts	Pass filter to UGC gallery endpoint
client/src/pages/ContentEnginePage.tsx	Inline video player instead of redirect
client/src/pages/ContentEnginePage.tsx	Update duration selector max to 20
server/services/renderers/automation.ts	(optional) Add warning log when clamping
Summary
Issue	Root Cause	Fix Complexity
8s duration	Provider API limit (max 20s)	Low - Update UI expectations
Wrong redirect	Hardcoded /ai-studio	Low - Inline player
Mixed gallery	No filtering by sceneSpecId	Low - Add filter param
Would you like me to implement these fixes?
implement it

storage.ts
+1
-1
  updateMediaAsset(id: string, updates: Partial<Omit<MediaAsset, 'id' | 'createdAt'>>): Promise<MediaAsset | undefined>;  getMediaAssetsByUser(userId: string): Promise<MediaAsset[]>;  softDeleteMediaAsset(assetId: string, userId: string): Promise<MediaAsset | undefined>;
  getMediaAssetsByUser(userId: string): Promise<MediaAsset[]>;  updateMediaAsset(id: string, updates: Partial<Omit<MediaAsset, 'id' | 'createdAt'>>): Promise<MediaAsset | undefined>;  getMediaAssetsByUser(userId: string, options?: { excludeContentEngine?: boolean; contentEngineOnly?: boolean }): Promise<MediaAsset[]>;  softDeleteMediaAsset(assetId: string, userId: string): Promise<MediaAsset | undefined>;
**🔹 ALIGNMENT PROMPT FOR CLAUDE (NO CODE)**
--------------------------------------------

> **Important:**

> This is an alignment + architectural reasoning prompt.

> Do NOT write code.

> Do NOT propose refactors yet.

> First confirm understanding, then reason.

* * * * *

### **Prompt**

You are embedded as a senior architect inside the **Streamline** codebase.

Your task is **not** to implement anything yet.

Your task is to:

-   realign the Content Engine feature with its **intended long-form vision**

-   audit whether **Remotion** is present or not

-   explain **how Remotion would actually be used in this app** (conceptually)

-   identify what parts of the current system stay vs are bootstrap-only

* * * * *

**🔒 Locked Product Decision (Very Important)**
-----------------------------------------------

**Content Engine v1 is LONG-FORM ONLY.**

That means:

-   Primary output: **3--10 minute videos**

-   Short-form (8--60s) is **derivative**, not primary

-   Ad / UGC constraints (8s, 20s) are NOT valid here

If anything in the system clamps duration to seconds, that is a mismatch.

* * * * *

**Current Reality (What Exists Today)**
---------------------------------------

### **What Works**

-   ChannelConfig abstraction (niche, tone, cadence)

-   SceneSpec abstraction (ordered scenes with narration + visuals)

-   Persistence + orchestration (statuses, retries)

-   Rendering pipeline via **KIE / Veo3**

-   MediaAsset storage

### **What Is Currently Wrong for This Feature**

-   Renderer being used is **UGC / Ad-oriented**

-   Duration is clamped (8s / 20s)

-   Output routed to Prosper UGC

-   No Remotion usage yet

This happened intentionally as a bootstrap shortcut.

* * * * *

**What We Need to Align On**
----------------------------

### **1\. Renderer Ownership**

Content Engine should:

-   NOT use the UGC / Ad renderer

-   NOT inherit ad presets

-   NOT inherit duration clamps

Content Engine **should use Remotion** as its primary renderer.

* * * * *

### **2\. Your First Task: Audit Remotion Presence**

Please determine:

-   Is remotion installed in this repo?

-   If yes:

    -   where is it referenced?

    -   is it currently unused?

-   If no:

    -   confirm it is absent

    -   note how it would normally be installed (e.g. npm install remotion)

Do NOT install anything yet --- just report findings.

* * * * *

### **3\. Conceptual Question (Critical)**

Explain, at a **system design level**, how Remotion would be used **inside Streamline**.

Specifically:

-   Would Remotion run:

    -   inside the Node app?

    -   as a background worker?

    -   as a separate render service?

-   How would a SceneSpec map to:

    -   Remotion compositions

    -   timelines

    -   scene durations

-   How would rendering be triggered?

-   Where would the output MP4 be stored?

-   How would status updates flow back?

No code --- just architecture.

* * * * *

### **4\. What Stays vs What Changes**

Please clearly separate:

#### **Things that STAY**

-   SceneSpec

-   ChannelConfig

-   status lifecycle

-   MediaAsset storage

-   UI shell

#### **Things that CHANGE**

-   renderer selection

-   duration handling

-   viewer routing

-   ad-specific constraints

Be explicit.

* * * * *

### **5\. Constraints You Must Respect**

-   Do NOT break Prosper UGC or Ads

-   Do NOT remove KIE (it stays for short-form)

-   Do NOT fork the database

-   Prefer **mode-based behavior** (e.g. content_engine vs ugc)

-   Optimize for clarity over cleverness

* * * * *

### **6\. Output Format**

Please respond with:

1.  Restatement of the corrected vision (in your own words)

2.  Remotion audit results (present or not)

3.  Conceptual Remotion integration architecture

4.  Clear boundary between Content Engine vs UGC

5.  Open questions that must be answered before implementation

Do NOT write code.

Do NOT enter Plan Mode yet.

* * * * *

**Why this matters (meta)**
---------------------------

You are not being asked to "add Remotion."

You are being asked to **redefine Content Engine as a long-form system** and explain how Remotion fits *without breaking everything else*.

* * * * *
**🔹 CLEAR FRAMEWORK --- PLAN MODE PROMPT (NO CODE)**
---------------------------------------------------

> **Mode switch:** You are now in **PLAN MODE**.

> Do NOT write implementation code yet.

> Your job is to produce a **clean, minimal, staged implementation plan**.

* * * * *

### **C --- Context (Locked)**

We are implementing **Content Engine v1** inside the existing Streamline app.

**Content Engine v1 is LONG-FORM ONLY.**

-   Primary output: **3--10 minute videos**

-   Short-form is derivative and out of scope for v1

-   Content Engine must **NOT** use the UGC / Ad renderer

-   Content Engine must **NOT** inherit duration clamps (8s / 20s)

-   **Remotion is the primary renderer**

-   KIE / Veo3 stays for UGC Ads only

We already have:

-   ChannelConfig

-   SceneSpec (canonical)

-   Status lifecycle

-   MediaAsset storage

-   Renderer interface (placeholder)

-   Working orchestration

* * * * *

### **L --- Locked Architectural Decisions**

You must assume the following decisions are final:

#### **Renderer Strategy**

-   **Renderer A (UGC):** KIE / Veo3 → unchanged

-   **Renderer B (Content Engine):** Remotion → new primary renderer

#### **Duration**

-   Content Engine videos:

    -   Minimum: **3 minutes**

    -   Typical: **5 minutes**

    -   Max (v1): **10 minutes**

-   SceneSpec targetDuration (in seconds) is authoritative

#### **Media Classification**

-   A MediaAsset with sceneSpecId != null is **Content Engine media**

-   Content Engine media:

    -   does NOT appear in Prosper UGC gallery

    -   has its own viewer / route

#### **Rendering Infrastructure (Decision)**

Use **Remotion in a separate render worker** (Docker or Lambda-style).

-   Node API:

    -   generates Remotion code (via Claude)

    -   sends job to render worker

    -   polls for status

-   Render worker:

    -   runs npx remotion render

    -   uploads MP4 to S3

    -   returns URL

* * * * *

### **E --- Explicit Questions You Must Resolve in the Plan**

You must choose **one clear answer** for each below and plan accordingly:

1.  **Render Infra**

    -   Choose: Docker-based Remotion render service (recommended for v1)

    -   Explain why (timeouts, simplicity, control)

2.  **Voiceover Strategy**

    -   Choose ONE:

        -   A) Pre-generate TTS audio before Remotion render

        -   B) Generate TTS inside render step

    -   Justify choice for reliability and cost

3.  **Visual Asset Strategy**

    -   Choose ONE for v1:

        -   A) Stock video URLs (Pexels, etc.)

        -   B) Static images + motion

    -   Do NOT include Midjourney or async image gen in v1

4.  **Credits / Cost Model (Conceptual)**

    -   Define:

        -   credit cost for a 5-minute render

        -   how to prevent accidental rerenders

5.  **Viewer UX**

    -   Define:

        -   route for viewing Content Engine videos

        -   minimal UI (no polish)

* * * * *

### **A --- Plan Requirements**

Your plan must be:

-   Incremental (staged)

-   Minimal (no gold-plating)

-   Safe (does not break UGC)

-   Realistic for a solo builder

You must explicitly separate:

-   **Phase 0** --- Prep / install

-   **Phase 1** --- Remotion renderer wiring

-   **Phase 2** --- Render worker

-   **Phase 3** --- Viewer + routing

-   **Phase 4** --- Guardrails + limits

Each phase must include:

-   Goal

-   Files/modules touched

-   Clear success criteria

* * * * *

### **R --- Required Output Format**

Your response must include **only**:

1.  **One-paragraph confirmation of alignment**

2.  **Chosen answers** to the open questions (bullet list)

3.  **Phased implementation plan** (numbered, detailed)

4.  **Explicit non-goals for v1**

5.  **Risks + mitigations**

Do **not** write code.

Do **not** propose alternatives.

Do **not** defer decisions back to the user.

* * * * *

### **Final Instruction**

Assume this plan will be handed directly to an execution agent (Cursor / Replit Agent).

Clarity > cleverness.

Stability > speed.

Proceed.

* * * * *
Content Engine v1 - Remotion Integration Plan
Alignment Confirmation
Content Engine v1 is a long-form video generation system (3-10 minutes) using Remotion as its primary renderer. It operates independently from the existing UGC/Ad system (KIE/Veo3), which remains unchanged. The architecture leverages the existing SceneSpec/ChannelConfig abstractions, MediaAsset storage, and status lifecycle patterns. The Remotion renderer will run in a separate Docker-based render worker, with the Node API handling code generation, job dispatch, and status polling.

---

Chosen Answers to Open Questions
Render Infrastructure: Docker-based Remotion render service
Rationale: No timeout limits (Lambda has 15-minute cap), full control over dependencies, predictable costs, simpler debugging, can run locally for development
Voiceover Strategy: Pre-generate TTS audio before Remotion render (Option A)
Rationale: Separates concerns (TTS failure does not waste render credits), audio can be validated/previewed before expensive render step, enables caching of audio files, Remotion simply references audio URL
Service: ElevenLabs API (high quality, reasonable cost at ~$0.30/1000 chars)
Visual Asset Strategy: Stock video URLs from Pexels API (Option A)
Rationale: Free tier (15K requests/month), instant availability, no async generation, reliable CDN URLs, adequate for faceless content
No Midjourney/DALL-E in v1 (adds async complexity)
Credits/Cost Model:
5-minute video: 150 credits (TTS: ~30 credits, Render: ~100 credits, Storage: ~20 credits)
Prevention: Confirmation dialog before render, render button disabled during processing, refund policy for failures
Viewer UX:
Route: /content-engine/video/:mediaAssetId
UI: Minimal page with video player, title, duration, download button, back link
---

Phased Implementation Plan
Phase 0: Prep and Install
Goal: Set up Remotion, TTS service, and stock footage integration without breaking existing functionality.

Files to create/modify:

package.json - Add dependencies: remotion, @remotion/cli, @remotion/renderer, @remotion/bundler
server/services/tts.ts - New TTS service (ElevenLabs wrapper)
server/services/stockFootage.ts - New Pexels API wrapper
.env.example - Add ELEVENLABS_API_KEY, PEXELS_API_KEY
Tasks:

Install Remotion packages (not used yet, just available)
Create TTS service with generateAudio(text: string): Promise<string> returning audio URL
Create stock footage service with searchVideos(query: string, count: number): Promise<string[]> returning video URLs
Add API keys to environment
Success criteria:

npm run build succeeds with new dependencies
TTS service can generate audio URL from text (manual test)
Stock footage service returns Pexels video URLs (manual test)
Existing UGC/Content Engine functionality unchanged
---

Phase 1: Remotion Renderer Wiring
Goal: Implement the Remotion renderer that generates code from SceneSpec and prepares render jobs.

Files to create/modify:

server/services/renderers/remotion.ts - New Remotion renderer implementing IRenderer
server/services/renderers/base.ts - Extend RenderOptions for Remotion
server/prompts/remotion-codegen.ts - Claude prompt templates for Remotion code generation
server/routes.ts - Update render endpoint to route to Remotion renderer
Renderer flow:

SceneSpec → Pre-generate TTS audio → Fetch stock footage URLs → Claude generates Remotion code → Validate code → Queue render job
Key implementation details:

TTS Pre-generation: For each scene, call TTS service with voiceoverText, store resulting audio URLs
Stock Footage Fetch: For each scene, call Pexels with visualIntent keywords, store video URLs
Claude Code Generation: Send SceneSpec + audio URLs + footage URLs to Claude with Remotion-specific prompt
Code Validation: Parse generated code, check for dangerous imports, validate structure
Job Dispatch: Create render job record, send code bundle to render worker
Success criteria:

Remotion renderer returns valid Remotion code for a test SceneSpec
Generated code includes correct audio/footage URLs
Code validation catches malformed output
Render job is queued (not yet executed)
---

Phase 2: Docker Render Worker
Goal: Create a standalone Docker service that receives Remotion code, renders video, and uploads result.

Files to create:

render-worker/Dockerfile - Docker image with Remotion, ffmpeg, Node 20
render-worker/package.json - Minimal deps: remotion, express, aws-sdk
render-worker/index.ts - Express server with /render endpoint
render-worker/render.ts - Remotion render execution logic
docker-compose.yml - Local development setup
Worker API:

POST /render
Body: { jobId, code, outputConfig: { fps, width, height, durationInFrames } }
Response: { jobId, status: "queued" }

GET /status/:jobId
Response: { jobId, status: "rendering" | "complete" | "failed", resultUrl?, error? }
Render flow inside worker:

Receive code bundle
Write code to temp directory
Run npx remotion render with output config
Upload resulting MP4 to KIE file storage (reuse existing pattern)
Return result URL
Polling pattern (in main app):

Reuse existing pollForCompletion pattern from automation renderer
Poll worker /status/:jobId every 30 seconds
Max 30 attempts (15 minutes total for 10-min video)
Success criteria:

Docker container builds and runs locally
Worker accepts render job, executes Remotion, returns MP4 URL
Main app can poll worker and receive completion status
MediaAsset is created with correct sceneSpecId and resultUrl
---

Phase 3: Viewer and Routing
Goal: Create dedicated viewer for Content Engine videos, update routing logic.

Files to create/modify:

client/src/pages/ContentEngineVideoPage.tsx - New video viewer page
client/src/App.tsx - Add route /content-engine/video/:id
client/src/pages/ContentEnginePage.tsx - Update "View Video" to use new route
server/routes.ts - Add GET /api/content-engine/video/:id endpoint
Viewer page features:

Full-width video player with controls
Video title (from SceneSpec)
Duration and creation date
Download button (direct link to resultUrl)
Back to Content Engine button
Routing updates:

Content Engine "View Video" → /content-engine/video/:mediaAssetId
UGC gallery → unchanged (AI Studio)
Success criteria:

New video page loads and plays Content Engine videos
"View Video" button navigates to correct page
UGC videos remain in AI Studio (no cross-contamination)
---

Phase 4: Guardrails and Limits
Goal: Add credit checks, duration limits, and safety measures.

Files to modify:

server/services/usageLimits.ts - Add Content Engine credit costs
server/routes.ts - Add credit check before render
shared/schema.ts - Update duration constraints
client/src/pages/ContentEnginePage.tsx - Add confirmation dialog, update duration selector
Guardrails to implement:

Duration limits:
Minimum: 180 seconds (3 minutes)
Maximum: 600 seconds (10 minutes)
UI selector: 3, 5, 7, 10 minute options
Credit costs (conceptual, adjust based on actual costs):
Per-minute base: 30 credits
3-minute video: 90 credits
5-minute video: 150 credits
10-minute video: 300 credits
Rate limiting:
Max 3 concurrent renders per user
Max 10 renders per day per user
Confirmation dialog:
Shows estimated credits, duration, cannot be undone
User must confirm before render starts
Success criteria:

Renders blocked if insufficient credits
Duration selector shows only valid long-form options
Confirmation dialog appears before render
Rate limits enforced
---

Non-Goals for v1
Short-form derivative clips (clipping from long-form)
Custom visual assets (Midjourney, DALL-E, user uploads)
Real-time preview of Remotion compositions
User-editable Remotion code
Multi-language TTS
Background music / sound effects
Analytics or performance dashboards
Public API access
Mobile-optimized viewer
Batch rendering
Scheduled renders
---

Risks and Mitigations
| Risk | Impact | Mitigation |

|------|--------|------------|

| Claude generates invalid Remotion code | Render fails, credits wasted | Code validation step, retry with modified prompt (max 2 retries), refund on persistent failure |

| Docker render worker timeout on long videos | 10-min video exceeds resources | Set memory limit (4GB), time limit (20 min), fail gracefully with error message |

| ElevenLabs rate limit / cost spike | TTS fails, unexpected bills | Implement caching (same text = same audio), set monthly budget cap, fallback to cheaper TTS |

| Pexels API rate limit | Stock footage unavailable | Cache popular queries, fallback to static placeholder footage |

| Render worker unavailable | All renders fail | Health check endpoint, alert on downtime, queue jobs for retry |

| Large MP4 files (10 min = ~200MB) | Storage costs, slow uploads | Compress with ffmpeg, use KIE file upload (existing pattern) |

| User triggers multiple renders accidentally | Credits drained | Confirmation dialog, disable button during render, show pending status prominently |

---

Architecture Diagram
```mermaid

flowchart TB

subgraph client [Frontend]

CEPage[ContentEnginePage]

VideoPage[ContentEngineVideoPage]

end

subgraph server [Node API Server]

Routes[routes.ts]

RemotionRenderer[remotion.ts]

TTSService[tts.ts]

StockService[stockFootage.ts]

Storage[storage.ts]

end

subgraph external [External Services]

Claude[Claude API]

ElevenLabs[ElevenLabs TTS]

Pexels[Pexels API]

KIEStorage[KIE File Storage]

end

subgraph worker [Docker Render Worker]

RenderAPI[Express API]

RemotionCLI[Remotion CLI]

end

subgraph db [Database]

SceneSpecs[(scene_specs)]

MediaAssets[(media_assets)]

end

CEPage -->|POST /render/:id| Routes

Routes --> RemotionRenderer

RemotionRenderer -->|Generate audio| TTSService

RemotionRenderer -->|Fetch footage| StockService

RemotionRenderer -->|Generate code| Claude

TTSService --> ElevenLabs

StockService --> Pexels

RemotionRenderer -->|Queue job| RenderAPI

RenderAPI --> RemotionCLI

RemotionCLI -->|Upload MP4| KIEStorage

RenderAPI -->|Return URL| RemotionRenderer

RemotionRenderer -->|Update status| Storage

Storage --> SceneSpecs

Storage --> MediaAssets

VideoPage -->|GET /video/:id| Routes

Routes --> Storage
Summary of Changes
Phase 0: Infrastructure
Installed Remotion packages (remotion, @remotion/cli, @remotion/renderer, @remotion/bundler)
Created server/services/tts.ts - ElevenLabs TTS service for voiceover generation
Created server/services/stockFootage.ts - Pexels API service for stock video footage
Phase 1: Remotion Renderer
Created server/prompts/remotion-codegen.ts - Claude AI prompts for generating Remotion code
Created server/services/renderers/remotion.ts - Full IRenderer implementation
Updated server/services/renderers/base.ts - Added RemotionRenderOptions
Updated server/routes.ts - Smart routing between automation (short) and Remotion (long-form)
Phase 2: Docker Render Worker
Created render-worker/ directory with:
Dockerfile - Node 20 + Chromium + ffmpeg + Remotion
index.ts - Express server with /render and /status/:id endpoints
render.ts - Remotion render logic
package.json and tsconfig.json
Created docker-compose.yml for local development
Phase 3: Viewer and Routing
Created client/src/pages/ContentEngineVideoPage.tsx - Dedicated video viewer
Updated client/src/App.tsx - Added /content-engine/video/:id route
Updated client/src/pages/ContentEnginePage.tsx - "View Video" navigates to new viewer
Phase 4: Guardrails
Updated server/services/creditService.ts - Content Engine credit calculations (30 credits/min)
Updated render endpoint with credit check and deduction
Updated frontend with:
Duration selector: 3, 5, 7, 10 minutes
Confirmation dialog showing credit cost before render
Insufficient credits error handling
Environment Variables Needed
To fully test, you'll need:
ELEVENLABS_API_KEY=your_keyPEXELS_API_KEY=your_keyANTHROPIC_API_KEY=your_keyREMOTION_WORKER_URL=http://localhost:3001  # Optional, defaults to this
To Run the Render Worker Locally
cd render-workernpm installdocker-compose up -d
can u push all changes to git so we can test n railway app?

git status
	my-video/
	prosper-ugc-gen.code-workspace

nothing added to commit but untracked files present (use "git add" to track)
The changes are already pushed! The latest commit 19f148c containing the full Content Engine v1 Remotion implementation is already on both remotes.
git log --oneline -3
19f148c Content Engine v1: Remotion-based long-form video rendering
a876dcf Fix: Content Engine video viewer and gallery separation
88e6422 Fix: Await getAuthHeaders() in Content Engine mutations
Your code is already pushed to both GitHub repos:
origin: xpandai03/launchready-streamline-mvp.git
prosper: xpandai03/prosperlife-ugc-generator.git
Latest commit: 19f148c - Content Engine v1: Remotion-based long-form video rendering
Railway should automatically redeploy if it's configured to auto-deploy on push. If not, you can manually trigger a deploy from the Railway dashboard.
What's deployed:
Phase 0-4 of Remotion integration (TTS, stock footage, render worker, viewer, guardrails)
Duration options: 3, 5, 7, 10 minutes
Credit system: 30 credits/minute
Confirmation dialog before render
Dedicated video viewer at /content-engine/video/:id
Environment variables you'll need on Railway:
http://your-render-worker:3001
ELEVENLABS_API_KEY=your_keyPEXELS_API_KEY=your_key  ANTHROPIC_API_KEY=your_keyREMOTION_WORKER_URL=http://your-render-worker:3001
Note: The Remotion render worker (render-worker/) needs to be deployed separately as a Docker service. For initial testing, renders will fail gracefully with a message saying the worker isn't available.
**🔹 CLEAR DEBUG PROMPT --- Remotion Render Worker ENOTFOUND**
------------------------------------------------------------

### **C --- Context**

We have successfully implemented **Content Engine v1 (long-form)** using **Remotion** as the primary renderer.

What is working:

-   ChannelConfig creation ✅

-   SceneSpec generation ✅

-   TTS pre-generation via ElevenLabs ✅

-   Stock footage fetch via Pexels ✅

-   Claude code generation for Remotion compositions ✅

-   Code validation passes ✅

What is failing:

-   Dispatching the Remotion render job to the **render worker**

* * * * *

### **L --- Latest Action**

1.  Created a Channel Config (long-form, 5 minutes)

2.  Generated a SceneSpec

3.  Clicked **Render**

4.  Backend progressed through:

    -   TTS generation

    -   Stock footage lookup

    -   Remotion code generation

5.  Failed at **dispatching to render worker**

* * * * *

### **E --- Error Observed**

#### **Backend Logs**

```
[Remotion Renderer] Step 7: Dispatching to render worker...
[Remotion Renderer] Dispatching job to: http://your-render-worker:3001
[Remotion Renderer] Dispatch error: getaddrinfo ENOTFOUND your-render-worker
```

Followed by:

```
POST /api/content-engine/render/:id → 500
```

#### **UI**

-   Scene Spec marked as **failed**

-   Error message:

```
getaddrinfo ENOTFOUND your-render-worker
```

* * * * *

### **A --- Analysis / Known Facts**

-   The Remotion renderer is functioning up until the dispatch step

-   The error is **DNS resolution failure**

-   This indicates:

    -   REMOTION_WORKER_URL is set incorrectly

    -   or the render worker service is not running / not reachable

-   Current ENV value (from Railway):

```
REMOTION_WORKER_URL=http://your-render-worker:3001
```

This looks like a **placeholder value**, not a real hostname.

Important:

-   The render worker has **not been deployed yet**

-   We have only created the render-worker/ folder and Docker setup

-   No Railway / Docker / Fly service exists yet for the worker

Therefore:

> This failure is expected until the worker is deployed and the URL is real.

* * * * *

### **R --- Request (What To Do)**

Please **systematically debug and resolve** this issue by doing the following:

1.  Confirm that the error is caused by:

    -   invalid REMOTION_WORKER_URL

    -   missing render worker deployment

2.  Propose the **correct fix paths**, including:

    -   Local development setup (docker-compose)

    -   Production deployment setup (Railway / Fly / ECS)

3.  Specify:

    -   what REMOTION_WORKER_URL should be set to in each case

    -   how the main app and worker communicate

4.  Confirm whether the system should:

    -   fail gracefully when worker is unavailable (current behavior)

    -   or block render with a clearer error message

5.  Recommend the **fastest path** to get the first long-form video rendering successfully

* * * * *

### **Constraints**

-   Do NOT modify SceneSpec logic

-   Do NOT modify Remotion code generation

-   Do NOT break UGC/KIE flows

-   Assume Docker-based worker is the correct v1 choice

-   Prefer clarity and simplicity over production perfection

* * * * *

### **Deliverable Format**

Please respond with:

1.  Root cause explanation (1--2 paragraphs)

2.  Local dev fix (exact steps)

3.  Production fix (exact steps)

4.  Correct REMOTION_WORKER_URL examples

5.  Any small UX improvement suggestions (optional)

Do **not** write code yet unless explicitly asked.

* * * * *

### **Extra Signal**

Everything before "dispatching to render worker" is working correctly.

This is the *last missing infrastructure piece*.

* * * * *

**4️⃣ What Claude should change (surgical)**
--------------------------------------------

This is what needs to happen conceptually (no code pasted here):

1.  Open render-worker/package.json

2.  Identify all packages used by:

    -   index.ts

    -   render.ts

3.  Move them from devDependencies → dependencies

4.  Commit

5.  Push

6.  Railway auto-rebuilds

Nothing else.

* * * * *

**5️⃣ After the fix, what should happen**
-----------------------------------------

On next Railway build:

-   ✅ Docker image builds

-   ✅ render-worker goes **Online**

-   ✅ Logs show something like:

```
Render worker listening on port 3001
```

-   ✅ Internal hostname becomes reachable:

```
http://render-worker.railway.internal:3001
```

Then your previously failing SceneSpec render will:

-   pass dispatch

-   reach worker

-   render long-form video

* * * * *

**6️⃣ If you want, here's the **
--------------------------------

**CLEAR prompt**
----------------

** for Claude to fix this**
---------------------------

You can paste this directly into Claude/Cursor:

* * * * *

### **CLEAR DEBUG PROMPT --- render-worker npm ci build failure**

**Context**

The render-worker Railway service fails during Docker build at:

```
npm ci --omit=dev
```

**Error**

Build fails with exit code 1 during dependency installation.

**Analysis**

The worker runs Remotion at runtime, but Remotion packages are currently listed under devDependencies.

When npm ci --omit=dev runs, these packages are excluded, causing the install to fail.

**Request**

Please:

1.  Audit render-worker/package.json

2.  Identify all packages required at runtime (render.ts, index.ts)

3.  Move those packages from devDependencies → dependencies

4.  Do NOT modify Dockerfile

5.  Keep npm ci --omit=dev intact

Explain briefly why this fixes the issue.

* * * * *

**7️⃣ What to do **
-------------------

**right now**
-------------

Tell me **one thing**:

-   "I want you to give me the exact packages to move"

-   OR "Claude is fixing it --- I'll paste the diff"

-   OR "Build failed again --- here's the new log"

Once the worker is online, you're **one render away from a real 5-minute video**.
Fixed and pushed.
Commit: 5f95490 - Add package-lock.json for render-worker (required by npm ci)
What was wrong:
npm ci requires a package-lock.json file to exist
The render-worker folder only had package.json, no lockfile
What I did:
Generated package-lock.json with npm install --package-lock-only
Committed and pushed it
Railway will rebuild now. The npm ci --omit=dev step should pass this time.
**🔹 CLEAR DEBUG PROMPT --- Railway Internal DNS ENOTFOUND (Remotion Worker)**
----------------------------------------------------------------------------

### **C --- Context**

We have a **two-service Railway architecture** in the same project:

1.  **streamline-mvp** (main Node app)

2.  **render-worker** (Remotion render service)

Both services:

-   are deployed from the same GitHub repo

-   are in the same Railway project and environment

-   are currently **Active**

The render worker logs show:

```
[Worker] Remotion Render Worker running on port 8080
[Worker] Jobs directory: /app/jobs
[Worker] Output directory: /app/output
```

So the worker is **successfully running and listening**.

* * * * *

### **L --- Latest Action**

1.  Deployed render-worker as a Railway service

    -   Root directory: /render-worker

    -   Port: 8080

    -   Status: **Active**

2.  Set this environment variable on the **main app**:

```
REMOTION_WORKER_URL=http://render-worker.railway.internal:8080
```

1.  Triggered a Content Engine render from /content-engine

* * * * *

### **E --- Error Observed**

Despite the worker being active, the main app fails with:

```
getaddrinfo ENOTFOUND render-worker.railway.internal
```

The SceneSpec is marked as **failed** with this error.

This indicates a **DNS resolution failure**, not a connection refusal.

* * * * *

### **A --- Analysis / Known Facts**

-   The render worker container is running

-   The worker is listening on port 8080

-   The error is **ENOTFOUND**, not ECONNREFUSED

-   This means:

    -   the hostname cannot be resolved from the main app container

-   Possibilities include:

    -   incorrect Railway internal hostname

    -   service name mismatch

    -   internal networking not enabled / not supported the way assumed

    -   env var not actually applied to the running main app container

    -   Railway requires using the **public service URL**, not .railway.internal

Important detail:

-   The service name is render-worker

-   The internal hostname we assumed was render-worker.railway.internal

-   This may be **incorrect for Railway**, or environment-specific

* * * * *

### **R --- Request (What To Do)**

Please **systematically debug** why the main app cannot resolve render-worker.railway.internal.

Specifically:

1.  Confirm the **correct internal hostname format for Railway services**

    -   Is .railway.internal valid?

    -   Is the service name used correctly?

2.  Determine whether:

    -   Railway supports internal DNS between services in this setup

    -   or whether we must use the **public service URL**

3.  Verify whether REMOTION_WORKER_URL is actually present in the running main app container

4.  Propose the **correct fix**, choosing one of:

    -   correct internal hostname

    -   switch to public URL

    -   explicit service alias configuration

5.  Provide the **exact value** that REMOTION_WORKER_URL should be set to in production

* * * * *

### **Constraints**

-   Do NOT change Remotion code

-   Do NOT change render-worker implementation

-   Do NOT move services between projects

-   Assume both services must remain on Railway

-   Prefer the **simplest working networking setup** over theoretical purity

* * * * *

### **Deliverable Format**

Please respond with:

1.  Root cause explanation (why ENOTFOUND happens despite Active worker)

2.  Correct Railway networking model for this setup

3.  Exact REMOTION_WORKER_URL value to use

4.  Steps to verify connectivity from main app

5.  Any Railway-specific caveats we should know

Do **not** write code unless explicitly requested.

* * * * *

### **Extra Signal**

If Railway internal DNS is unreliable here, it is acceptable to use the **public worker URL** for v1, even if it's slightly less "pure".

* * * * *

**Why this prompt matters**
---------------------------

At this point:

-   **All logic works**

-   **All infra is deployed**

-   The only remaining variable is **service-to-service networking**

This is the final unlock.

* * * * *
Claude Alignment Prompt --- Option B (Hybrid UGC Video Architecture)

You are Claude, acting as a senior AI video systems engineer and product architect.

Your task in this step is NOT to implement anything yet.

Your task is to confirm deep understanding of the problem, constraints, and the chosen architectural direction, and then propose how you would plan the implementation.

⸻

Context

We are building Streamline AI, a video generation application.

Today, Streamline has a working UGC Ad feature:

- User uploads a product image

- Selects an avatar

- Enters product features / talking points

- Selects a generation style

- Backend uses KIE API (Veo / Sora-style wholesale video AI)

- Output is an 8--10 second avatar-led video

This works, but has hard constraints:

- When an image (avatar or product) is provided, KIE hard-caps output at ~8 seconds

- Video length cannot be meaningfully controlled

- Attempting longer outputs degrades quality

- This is a hard API limitation, not a prompting issue

⸻

New Goal

We want to generate fully ready-to-post, realistic, UGC-style product videos that:

- Are 30--45 seconds long

- Can be generated from:

- A set of uploaded product images, OR

- A scraped product page / product catalog

- Are suitable for website product pages, not just ads

- Can be generated in bulk, with guardrails

Critically:

- We still want a realistic human avatar holding the product and talking about it

- But we now understand that the avatar cannot be the entire video

⸻

Chosen Direction: Option B (Hybrid Architecture)

We are explicitly choosing Option B, defined as:

A hybrid, scene-based video architecture where:

- The avatar is used in short, high-impact segments

- The rest of the video is composed from:

- Product images

- Stock footage (optional)

- Motion graphics

- Text overlays

- AI voiceover

- A composition engine (e.g. Remotion or ffmpeg) assembles the final video

This is not a workaround --- it is the intended design.

⸻

Canonical Video Structure (Fixed)

Target length: 30--45 seconds

The video follows a fixed, template-based structure:

1. Scene 1 -- Hook (3--5s)

- Product hero shot or stock footage

- Bold text hook

- Music begins

2. Scene 2 -- Product Showcase (8--12s)

- Product images with subtle motion (zoom / pan)

- Voiceover introduces the product

- No avatar

3. Scene 3 -- Features / Benefits (10--15s)

- 3 key benefits

- Text + icons + motion graphics

- Voiceover continues

4. Scene 4 -- Avatar Segment (5--8s, OPTIONAL)

- Avatar holding the product

- Short testimonial-style delivery

- Generated via KIE

- This scene must stand alone and be skippable

5. Scene 5 -- CTA (3--5s)

- Product image

- Brand logo

- Call-to-action text

Avatar role:

- Supporting, not primary

- Never exceeds ~8 seconds

- Used where it adds realism and trust

⸻

Non-Goals (Important)

You should explicitly assume:

- We are not trying to:

- Generate 60s+ avatar-only videos

- Stitch multiple avatar clips together

- Achieve "Hollywood-level" realism

- This is AI-assisted content, not human-edited video

- Reliability, consistency, and scale matter more than perfection

⸻

Bulk Generation Constraints

- Bulk generation is allowed only after a single-video happy path works

- Expected failure rate: ~5--10%

- Graceful degradation is required:

- If avatar generation fails → skip Scene 4

- If TTS fails → fall back to text + music

- All videos use the same structural template

⸻

Your Tasks (This Step)

1\. Confirm Understanding

In your own words:

- Restate the problem we are solving

- Restate why avatar-only approaches fail

- Explain why Option B is the chosen solution

- Describe the role of KIE, Remotion, and voiceover in this system

Be explicit and concrete. No hand-waving.

⸻

2\. Call Out Risks & Assumptions

List:

- Key technical risks

- Product risks

- Places where expectations must be carefully managed

⸻

3\. Propose the Next Prompt

After confirming understanding, do not implement yet.

Instead:

- Write a Plan Mode prompt that we can give you next

- That prompt should instruct you to:

- Design the final implementation plan

- Break the system into phases

- Define inputs, outputs, and failure handling

The output of this step should end with:

"If this understanding is correct, here is the Plan Mode prompt you should use next."

⸻

Important

- Be opinionated

- Do not suggest reverting to avatar-only

- Do not suggest "better prompting" as a solution

- Optimize for something we can actually ship

This step is about alignment, not execution.
                                                            
⏺ Confirmation of Understanding                              
                                                             
  1. The Problem We're Solving                               
                                                             
  The core problem: You want to generate 30–45 second,       
  ready-to-post UGC-style product videos at scale. Your      
  current system produces good results but is capped at ~8   
  seconds because the KIE API has a hard technical limitation
   when images (avatar or product) are included in the       
  generation request.                                        
                                                             
  Why avatar-only approaches fail:                           
  - KIE's 8-second cap is not a prompting problem or a       
  configuration issue—it's a fundamental API constraint when 
  images are involved                                        
  - Attempting to generate longer outputs with images either 
  fails outright or produces degraded, unusable results      
  - Stitching multiple 8-second avatar clips would create    
  obvious seams, inconsistent lighting/positioning, and an   
  uncanny result                                             
  - The avatar-centric mental model ("the avatar IS the      
  video") is incompatible with the 30–45 second goal         
                                                             
  Why Option B is the answer:                                
  Option B acknowledges reality: the avatar is a component,  
  not the container. By treating the video as a composition  
  of discrete scenes—each optimized for what it does best—you
   can:                                                      
  - Use KIE where it excels (short, high-impact avatar       
  moments)                                                   
  - Use deterministic rendering (Remotion) for everything    
  else                                                       
  - Achieve reliable 30–45 second outputs without fighting   
  the API                                                    
  - Fail gracefully when the stochastic component (KIE) fails
                                                             
  This is architecturally honest. You're not trying to bend  
  KIE into something it can't do.                            
                                                             
  ---                                                        
  2. Role of Each Component                                  
  ┌─────────────┬───────────────────────────┬───────────────┐
  │  Component  │           Role            │ Failure Mode  │
  ├─────────────┼───────────────────────────┼───────────────┤
  │             │                           │ If it fails,  │
  │             │ Generates the optional    │ Scene 4 is    │
  │ KIE API     │ 5–8s avatar segment       │ skipped       │
  │             │ (Scene 4 only). The only  │ entirely.     │
  │             │ AI video generation call. │ Video still   │
  │             │                           │ ships.        │
  ├─────────────┼───────────────────────────┼───────────────┤
  │             │ Deterministic composition │               │
  │             │  engine. Assembles all    │ Must not      │
  │             │ scenes into final video.  │ fail. If it   │
  │ Remotion    │ Handles motion (zoom/pan  │ does, the     │
  │             │ on images), text          │ entire job    │
  │             │ overlays, timing,         │ fails.        │
  │             │ transitions, audio sync.  │               │
  ├─────────────┼───────────────────────────┼───────────────┤
  │ AI          │ Generates narration for   │ Falls back to │
  │ Voiceover   │ Scenes 2, 3, and 5.       │  text + music │
  │ (TTS)       │ Drives pacing.            │  if TTS       │
  │             │                           │ fails.        │
  ├─────────────┼───────────────────────────┼───────────────┤
  │             │ Primary visual content    │ Required      │
  │ Product     │ for Scenes 1, 2, 3, 5.    │ input. No     │
  │ Images      │ Uploaded by user or       │ fallback.     │
  │             │ scraped.                  │               │
  ├─────────────┼───────────────────────────┼───────────────┤
  │             │                           │ Can use a     │
  │ Music/Audio │ Background track. Sets    │ default track │
  │             │ tone.                     │  if selection │
  │             │                           │  fails.       │
  └─────────────┴───────────────────────────┴───────────────┘
  The critical insight: only one component is                
  non-deterministic (KIE), and it's optional. Everything else
   is predictable.                                           
                                                             
  ---                                                        
  3. Risks & Assumptions                                     
                                                             
  Technical Risks                                            
  Risk: KIE latency/availability                             
  Severity: Medium                                           
  Mitigation: Scene 4 is optional. Async generation with     
    timeout.                                                 
  ────────────────────────────────────────                   
  Risk: Remotion rendering performance                       
  Severity: High                                             
  Mitigation: Must validate render times at scale. May need  
    render queue/workers.                                    
  ────────────────────────────────────────                   
  Risk: TTS quality variance                                 
  Severity: Medium                                           
  Mitigation: Test multiple providers. Have fallback to      
    text-only.                                               
  ────────────────────────────────────────                   
  Risk: Product image quality                                
  Severity: Medium                                           
  Mitigation: User-uploaded images may be low-res, wrong     
    aspect ratio, or have backgrounds. May need              
    preprocessing.                                           
  ────────────────────────────────────────                   
  Risk: Audio sync drift                                     
  Severity: Medium                                           
  Mitigation: Voiceover duration must match scene duration.  
    Need to either: (a) generate VO first, then size         
     scenes to fit, or (b) constrain VO to fixed             
    durations.                                               
  ────────────────────────────────────────                   
  Risk: Scene transition jank                                
  Severity: Low                                              
  Mitigation: Remotion handles this well, but need consistent
                                                             
    styling.                                                 
  Product Risks                                              
  Risk: User expectation mismatch                            
  Severity: High                                             
  Notes: Users may expect "avatar talking for 45 seconds."   
    Must set expectations clearly in UI.                     
  ────────────────────────────────────────                   
  Risk: Avatar segment looks out of place                    
  Severity: Medium                                           
  Notes: If the avatar scene doesn't match the aesthetic of  
    the composed scenes, it will feel jarring. Need style    
     consistency.                                            
  ────────────────────────────────────────                   
  Risk: "AI-generated" stigma                                
  Severity: Medium                                           
  Notes: Motion graphics + stock footage can look generic.   
    Need good defaults.                                      
  ────────────────────────────────────────                   
  Risk: Bulk generation failures at 10%                      
  Severity: Medium                                           
  Notes: At 100 videos, 10 failures is noticeable. Need clear
                                                             
    status/retry UX.                                         
  Assumptions That Must Hold                                 
                                                             
  1. KIE can reliably generate 5–8s clips — If KIE fails >20%
   of the time, Scene 4 becomes effectively unusable         
  2. Remotion can render 30–45s videos in <60s — If render   
  times are 5+ minutes, bulk generation becomes impractical  
  3. Users will provide 3+ usable product images — The       
  template assumes multiple images. Single-image products    
  need a fallback                                            
  4. TTS can generate natural-sounding product narration —   
  Robotic TTS will kill the UGC feel                         
  5. The fixed template works across product categories — A  
  hoodie and a SaaS product have different optimal structures
                                                             
  ---                                                        
  4. Expectation Management Checklist                        
                                                             
  Before shipping, these must be explicitly communicated to  
  users:                                                     
                                                             
  - Avatar appears in a short segment, not the entire video  
  - Video length is 30–45 seconds, not configurable per-scene
  - Some generations may fail; retry is available            
  - Product images significantly impact output quality       
  - This is AI-assisted content, not human-edited video      
                                                             
  ---                                                        
  5. Proposed Plan Mode Prompt                               
                                                             
  If this understanding is correct, here is the Plan Mode    
  prompt you should use next:                                
                                                             
  ---                                                        
  You are Claude, acting as a senior AI video systems        
  architect.                                                 
                                                             
  Your task is to design the complete implementation plan for
   Option B: the Hybrid UGC Video Architecture.              
                                                             
  ---                                                        
                                                             
  ## Context (Confirmed)                                     
                                                             
  We are building a scene-based video composition system     
  where:                                                     
  - Total video length: 30–45 seconds                        
  - 5 fixed scenes (Hook → Showcase → Features → Avatar      
  [optional] → CTA)                                          
  - Avatar segment (5–8s) generated via KIE API              
  - All other scenes composed via Remotion from: product     
  images, text overlays, motion graphics, AI voiceover       
  - Graceful degradation if avatar or TTS fails              
                                                             
  The existing codebase has:                                 
  - A working KIE integration for 8s avatar clips            
  - A Remotion setup (confirm current state)                 
  - Product image upload handling                            
  - User-facing UGC Ad flow                                  
                                                             
  ---                                                        
                                                             
  ## Your Task                                               
                                                             
  Design a phased implementation plan. For each phase:       
                                                             
  1. Define the scope (what's built)                         
  2. Define inputs and outputs                               
  3. Define failure handling                                 
  4. Define what "done" looks like (acceptance criteria)     
  5. Call out dependencies and blockers                      
                                                             
  ---                                                        
                                                             
  ## Required Phases                                         
                                                             
  ### Phase 1: Single-Scene Proof of Concept                 
  - Render a single scene (Scene 2: Product Showcase) via    
  Remotion                                                   
  - Input: 1 product image + hardcoded text                  
  - Output: 10-second video file                             
  - Goal: Validate Remotion pipeline works end-to-end        
                                                             
  ### Phase 2: Full Template Assembly (No Avatar)            
  - Implement all 5 scenes, but skip Scene 4 (avatar)        
  - Input: Product images + product copy (features, CTA text)
  - Output: 30–40 second video                               
  - Goal: Validate the composition engine can produce a      
  complete video                                             
                                                             
  ### Phase 3: TTS Integration                               
  - Add AI voiceover to Scenes 2, 3, 5                       
  - Input: Script text (generated or provided)               
  - Output: Video with synchronized narration                
  - Goal: Validate audio sync and TTS quality                
                                                             
  ### Phase 4: Avatar Integration                            
  - Add optional Scene 4 using KIE                           
  - Input: Avatar selection + product image + short script   
  - Output: Video with avatar segment OR video without (if   
  KIE fails)                                                 
  - Goal: Validate graceful degradation                      
                                                             
  ### Phase 5: Single-Video Happy Path                       
  - Full end-to-end flow: user uploads images → video        
  generated                                                  
  - Input: User-provided product images + talking points     
  - Output: Downloadable 30–45s video                        
  - Goal: Shippable single-video feature                     
                                                             
  ### Phase 6: Bulk Generation                               
  - Queue-based generation of multiple videos                
  - Input: Product catalog (multiple products)               
  - Output: Batch of videos with status tracking             
  - Goal: Reliable bulk generation with <10% failure rate    
                                                             
  ---                                                        
                                                             
  ## Constraints                                             
                                                             
  - Do NOT propose avatar-only approaches                    
  - Do NOT suggest "better prompting" for KIE length limits  
  - Optimize for shippability, not perfection                
  - Assume Remotion is the composition engine (confirm if    
  already in codebase)                                       
  - Each phase must be independently testable                
                                                             
  ---                                                        
                                                             
  ## Output Format                                           
                                                             
  For each phase, provide:                                   
                                                             
  Phase N: [Name]                                            
                                                             
  Scope                                                      
                                                             
  [What is being built]                                      
                                                             
  Inputs                                                     
                                                             
  [What data/assets are required]                            
                                                             
  Outputs                                                    
                                                             
  [What is produced]                                         
                                                             
  Failure Handling                                           
                                                             
  [What happens if X fails]                                  
                                                             
  Acceptance Criteria                                        
                                                             
  [How we know it's done]                                    
                                                             
  Dependencies                                               
                                                             
  [What must exist before this phase]                        
                                                             
  Estimated Complexity                                       
                                                             
  [Low / Medium / High — no time estimates]                  
                                                             
  ---                                                        
                                                             
  After defining all phases, provide:                        
                                                             
  1. A dependency graph showing phase relationships          
  2. A list of open questions that need answers before       
  implementation                                             
  3. Recommendations for which phase to start with           
                                                             
  ---                                                        
                                                             
  Do NOT implement anything. Output the plan only.           
                                                             
  ---                                                        
  If this understanding is correct, paste the above prompt to
   enter Plan Mode and I will produce the detailed           
  implementation plan.                                       
                                                             
✻ Cogitated for 58s                                          
                                                             
⏺ All UGC code compiles without errors. Now let me create a  
  summary of what was implemented.                           
                                                             
⏺ All tasks have been completed and cleaned up. Let me       
  provide a summary of the implementation.                   
                                                             
  Implementation Summary                                     
                                                             
  I've implemented the Hybrid UGC Video Architecture (Option 
  B) as specified in the plan. Here's what was created:      
                                                             
  Phase 1-2: Remotion Scene Components                       
                                                             
  New files in my-video/src/:                                
  File: types/UGCSceneProps.ts                               
  Description: TypeScript interfaces for all UGC composition 
    props, scene configs, and defaults                       
  ────────────────────────────────────────                   
  File: scenes/HookScene.tsx                                 
  Description: Attention-grabbing intro with animated text   
  and                                                        
     hero image                                              
  ────────────────────────────────────────                   
  File: scenes/ShowcaseScene.tsx                             
  Description: Ken Burns effect product images with          
  cross-fade                                                 
     transitions                                             
  ────────────────────────────────────────                   
  File: scenes/FeaturesScene.tsx                             
  Description: Animated 3-feature benefit list with staggered
                                                             
    entrance                                                 
  ────────────────────────────────────────                   
  File: scenes/AvatarScene.tsx                               
  Description: Optional KIE avatar video player (skippable)  
  ────────────────────────────────────────                   
  File: scenes/CTAScene.tsx                                  
  Description: Call-to-action with pulsing button and logo   
    support                                                  
  ────────────────────────────────────────                   
  File: compositions/UGCComposition.tsx                      
  Description: Master composition assembling all 5 scenes    
  with                                                       
     Sequence                                                
  Updated: Root.tsx - Registered UGCVideo composition at     
  1080x1920 (portrait)                                       
                                                             
  Phase 3: Server Services                                   
                                                             
  New files in server/services/:                             
  File: ugcScriptGenerator.ts                                
  Description: AI-powered scene script generation from       
  product                                                    
     briefs (uses OpenAI via fetch)                          
  ────────────────────────────────────────                   
  File: ugcAudioPreparer.ts                                  
  Description: Batch TTS generation with duration-based scene
                                                             
    timing calculation                                       
  ────────────────────────────────────────                   
  File: ugcVideoService.ts                                   
  Description: Main orchestration service: scripts → TTS →   
    composition code → render                                
  Phase 5-6: API Endpoints                                   
                                                             
  Added to server/routes.ts:                                 
  Endpoint: /api/ugc/generate                                
  Method: POST                                               
  Description: Generate single UGC video (returns assetId for
                                                             
    polling)                                                 
  ────────────────────────────────────────                   
  Endpoint: /api/ugc/generate/batch                          
  Method: POST                                               
  Description: Generate up to 10 videos in batch             
  ────────────────────────────────────────                   
  Endpoint: /api/ugc/status/:assetId                         
  Method: GET                                                
  Description: Check video generation status                 
  Video Template Structure                                   
  Scene: Hook                                                
  Duration: 3-5s                                             
  Content: Bold text overlay, hero image                     
  ────────────────────────────────────────                   
  Scene: Showcase                                            
  Duration: 8-12s                                            
  Content: Product images with Ken Burns + voiceover         
  ────────────────────────────────────────                   
  Scene: Features                                            
  Duration: 10-15s                                           
  Content: 3 animated benefits + voiceover                   
  ────────────────────────────────────────                   
  Scene: Avatar                                              
  Duration: 5-8s                                             
  Content: Optional KIE avatar clip                          
  ────────────────────────────────────────                   
  Scene: CTA                                                 
  Duration: 3-5s                                             
  Content: Product + call-to-action button                   
  Total: 30-45 seconds                                       
                                                             
  Key Features                                               
                                                             
  1. TTS-driven timing: Audio duration determines scene      
  lengths                                                    
  2. Fallback handling: Default scripts if AI fails, silent  
  scenes if TTS fails                                        
  3. Avatar skip logic: Scene 4 time redistributes to        
  Features when skipped                                      
  4. Async processing: Returns immediately with assetId,     
  processes in background                                    
  5. Render worker integration: Generates inline composition 
  code for Docker render                                     
  6. Existing infrastructure reuse: Uses existing TTS, KIE   
  upload, and MediaAsset tracking                            
                                                             
  Verification                                               
                                                             
  All TypeScript compiles successfully for:                  
  - my-video/ Remotion components                            
  - server/services/ UGC services                            
  - server/routes.ts API endpoints                           
                                                             
✻ Crunched for 12m 36s
 deploying.                                                 
                                                             
❯ All right, so I want you to read the                       
  @full-auto-mode-VISION.md file. I want you to fully        
  read and sort of digest that information and help me       
  brainstorm how will we think about implementing a          
  feature like this? Don't go ahead and implement            
  anything yet. But this is kind of the vision of what I     
  want a new page on Streamline to be called Full Auto       
  Mode, or maybe we just call it full auto. I want this      
  page to have this kind of a user flow and I want this      
  to be where we can sort of generate high-quality           
  product demos both for the e-commerce stores and SAS       
  brands while simply taking in minimal information and      
  scraping their site taking in videos generating videos     
  there on the spot, fully polished videos and post          
  them on auto pilot to their accounts. No code changes      
  yet                                                        
  ⎿  Read full-auto-mode-VISION.md (236 lines)               
                                                             
⏺ I've read through the Full Auto Mode vision. This is an    
  ambitious but achievable feature that builds on the        
  infrastructure you already have. Let me share my thoughts  
  on how to approach this.                                   
                                                             
  ---                                                        
  Full Auto Mode - Implementation Brainstorm                 
                                                             
  What You Already Have (Building Blocks)                    
  Existing System: Content Engine                            
  How It Maps to Full Auto: Channel configs, scene specs →   
    Video Style Profiles                                     
  ────────────────────────────────────────                   
  Existing System: UGC Video Service (just built)            
  How It Maps to Full Auto: Scene-based video generation     
    pipeline                                                 
  ────────────────────────────────────────                   
  Existing System: TTS Service                               
  How It Maps to Full Auto: Voiceover generation             
  ────────────────────────────────────────                   
  Existing System: KIE Service                               
  How It Maps to Full Auto: Avatar clips, video rendering    
  ────────────────────────────────────────                   
  Existing System: Late.dev Integration                      
  How It Maps to Full Auto: Social publishing (YouTube, IG,  
    TikTok)                                                  
  ────────────────────────────────────────                   
  Existing System: Credit System                             
  How It Maps to Full Auto: Usage-based billing foundation   
  ────────────────────────────────────────                   
  Existing System: Media Assets                              
  How It Maps to Full Auto: Generated video tracking         
  ────────────────────────────────────────                   
  Existing System: Render Worker                             
  How It Maps to Full Auto: Remotion-based video rendering   
  ---                                                        
  The Missing Pieces                                         
                                                             
  1. Website Scraping Service                                
  - Input: URL                                               
  - Output: Products/pages with names, descriptions, images, 
  pricing                                                    
  - Tech options: Puppeteer/Playwright, or a service like    
  Firecrawl, Apify, or ScrapingBee                           
  - Challenge: E-commerce sites vary wildly (Shopify vs      
  WooCommerce vs custom)                                     
                                                             
  2. Content Pool / Library                                  
  - New database table: content_items or autopilot_products  
  - Stores scraped data + user edits                         
  - Tracks which items have been used, when, rotation status 
                                                             
  3. Video Style Profile                                     
  - Extends your existing channelConfigs concept             
  - Stores: tone, format, duration, avatar preference,       
  approved templates                                         
  - Links to approved "demo" videos for reference            
                                                             
  4. Scheduling Engine                                       
  - Cron-based job runner (could use: node-cron, BullMQ, or  
  Railway's cron)                                            
  - Picks next content item from pool                        
  - Triggers generation pipeline                             
  - Handles failures/retries                                 
                                                             
  5. Approval Queue (Optional Mode)                          
  - Videos generated but held for user review                
  - Simple approve/reject UI before publishing               
                                                             
  ---                                                        
  Proposed Data Model Sketch                                 
                                                             
  User                                                       
    └── AutopilotConfig (one per user)                       
          ├── websiteUrl                                     
          ├── scrapedAt                                      
          ├── videoStyleProfileId                            
          ├── postingCadence (e.g., "3_per_week")            
          ├── platforms: ["instagram", "tiktok"]             
          ├── approvalMode: "auto" | "manual"                
          ├── isActive: boolean                              
          └── nextScheduledAt                                
                                                             
    └── ContentPool (many)                                   
          ├── productName                                    
          ├── description                                    
          ├── images[]                                       
          ├── price                                          
          ├── sourceUrl                                      
          ├── isApproved                                     
          ├── lastUsedAt                                     
          └── usageCount                                     
                                                             
    └── AutopilotJobs (many) - execution log                 
          ├── contentItemId                                  
          ├── mediaAssetId                                   
          ├── status: "pending" | "generating" |             
  "awaiting_approval" | "published" | "failed"               
          ├── scheduledFor                                   
          ├── publishedAt                                    
          └── platforms[]                                    
                                                             
  ---                                                        
  User Flow Mapped to Pages/Components                       
  Step: 1. Enter URL                                         
  UI Component: Simple input + "Scan Website" button         
  Backend: Scraping service                                  
  ────────────────────────────────────────                   
  Step: 2. Review content library                            
  UI Component: Grid of products with edit capability        
  Backend: CRUD on ContentPool                               
  ────────────────────────────────────────                   
  Step: 3. Select video style                                
  UI Component: Style picker (tone, format, avatar)          
  Backend: Create/update VideoStyleProfile                   
  ────────────────────────────────────────                   
  Step: 4. Preview demo                                      
  UI Component: Generate 1-2 videos, video player            
  Backend: Existing UGC pipeline                             
  ────────────────────────────────────────                   
  Step: 5. Connect socials                                   
  UI Component: OAuth flow (existing Late.dev)               
  Backend: Already built                                     
  ────────────────────────────────────────                   
  Step: 6. Set schedule                                      
  UI Component: Cadence picker, platform checkboxes          
  Backend: AutopilotConfig                                   
  ────────────────────────────────────────                   
  Step: 7. Activate                                          
  UI Component: Toggle switch                                
  Backend: Start cron job                                    
  ────────────────────────────────────────                   
  Step: 8. Dashboard                                         
  UI Component: Stats, upcoming, history                     
  Backend: Read from AutopilotJobs                           
  ---                                                        
  Key Architecture Decisions to Make                         
                                                             
  1. Scraping Strategy                                       
  - Option A: Build custom scraper (Puppeteer) - more        
  control, more maintenance                                  
  - Option B: Use scraping API (Firecrawl, Apify) - faster,  
  costs money                                                
  - Option C: Shopify/WooCommerce API integrations - cleanest
   for those platforms                                       
                                                             
  2. Scheduling Infrastructure                               
  - Option A: In-process cron (node-cron) - simple, but dies 
  if server restarts                                         
  - Option B: External queue (BullMQ + Redis) - robust, more 
  infrastructure                                             
  - Option C: Railway cron jobs - managed, but less flexible 
  - Option D: Database-driven polling - check every N minutes
   for due jobs                                              
                                                             
  3. Content Rotation Logic                                  
  - Round-robin through products?                            
  - Weighted by performance?                                 
  - User-prioritized?                                        
  - Random with no-repeat window?                            
                                                             
  4. Video Generation Pipeline                               
  - Reuse UGC pipeline I just built?                         
  - Extend Content Engine for longer formats?                
  - New dedicated "Autopilot Renderer"?                      
                                                             
  ---                                                        
  Phased Implementation Suggestion                           
                                                             
  Phase 1: Manual Full Auto (MVP)                            
  - Scrape URL → show content library                        
  - User manually triggers "generate video for this product" 
  - User manually publishes                                  
  - Validates the core value prop without automation         
  complexity                                                 
                                                             
  Phase 2: Style Profiles + Preview                          
  - Save video style preferences                             
  - Generate preview videos                                  
  - Approval flow before publishing                          
                                                             
  Phase 3: Scheduling                                        
  - Add cadence settings                                     
  - Background job runner                                    
  - Auto-generation on schedule                              
                                                             
  Phase 4: Full Autopilot                                    
  - Auto-publish (with optional approval gate)               
  - Usage tracking + billing integration                     
  - Dashboard with analytics                                 
                                                             
  ---                                                        
  Questions to Think About                                   
                                                             
  1. Scraping scope: Just product pages, or also blog posts, 
  landing pages?                                             
  2. Video types: Short-form only (30-60s) or also long-form 
  (1-4 min)?                                                 
  3. Avatar: Required for all videos, or optional/text-only  
  option?                                                    
  4. Failure handling: What happens if video generation fails
   mid-schedule?                                             
  5. Content exhaustion: What if user has 5 products and     
  posts 3x/week? Re-use? Variations?                         
  6. Multi-store: One autopilot config per user, or multiple 
  stores/brands?                                             
                                                             
  ---                                                        
  What aspects would you like to dig deeper into first? The  
  scraping architecture, the scheduling system, or how the   
  video generation would differ from what we just built?     
                                                             
✻ Crunche        
                                                             
❯ > **Context:**                                             
                                                             
  > You are acting as a senior product engineer +            
  architect helping design a new MVP feature called          
  **Streamline -- Full Autopilot Mode**.                     
                                                             
  >                                                          
                                                             
  > This is **not an implementation task yet**.              
                                                             
  > No code changes. No files. No execution.                 
                                                             
  >                                                          
                                                             
  > Your goal is to **fully align on scope,                  
  architecture, and technical decisions** before             
  implementation.                                            
                                                             
  * * * * *                                                  
                                                             
  ### **Product Goal (Locked)**                              
                                                             
  We are building **Streamline Full Autopilot (MVP)**        
  --- a hands-free video content engine for **Shopify        
  e-commerce stores**.                                       
                                                             
  A user:                                                    
                                                             
  -   Onboards once with a Shopify store URL                 
                                                             
  -   Approves **one** demo video style                      
                                                             
  -   Sets cadence                                           
                                                             
  -   Then receives **automatically generated +              
  scheduled product demo videos** on an ongoing basis        
                                                             
  Publishing and scheduling are **already implemented**      
  using late.dev.                                            
                                                             
  * * * * *                                                  
                                                             
  ### **MVP Constraints (Non-Negotiable)**                   
                                                             
  Please treat these as **locked decisions**:                
                                                             
  1.  **Store Type (MVP):**                                  
                                                             
  -   Shopify stores only                                    
                                                             
  2.  **Content Type (MVP):**                                
                                                             
  -   E-commerce **product demo / UGC-style ads**            
                                                             
  -   No SaaS demos yet                                      
                                                             
  3.  **Video Duration:**                                    
                                                             
  -   Target **60--75 seconds** per video                    
                                                             
  -   Must feel like a *complete* video (not short           
  clips stitched randomly)                                   
                                                             
  4.  **Avatar:**                                            
                                                             
  -   Optional                                               
                                                             
  -   Supported if enabled, but not required for MVP         
  success                                                    
                                                             
  5.  **Approval Flow:**                                     
                                                             
  -   User approves **first generated video only**           
                                                             
  -   After approval, autopilot runs without further         
  approvals                                                  
                                                             
  6.  **Rotation Logic:**                                    
                                                             
  -   Round-robin through products                           
                                                             
  -   **No repeat until all products are exhausted**         
                                                             
  7.  **Billing:**                                           
                                                             
  -   Usage-based (already exists)                           
                                                             
  -   Billing mechanics are out of scope for this            
  alignment step                                             
                                                             
  * * * * *                                                  
                                                             
  ### **Existing Infrastructure (Already Built)**            
                                                             
  You should assume the following already exist and          
  should be reused where possible:                           
                                                             
  -   Video content engine                                   
                                                             
  -   Scene-based video generation                           
                                                             
  -   Remotion render worker                                 
                                                             
  -   Kai / avatar video generation (currently produces      
  short clips)                                               
                                                             
  -   TTS service                                            
                                                             
  -   Media asset storage                                    
                                                             
  -   Usage / credit system                                  
                                                             
  -   Social publishing + scheduling via late.dev            
                                                             
  * * * * *                                                  
                                                             
  ### **Known Gaps (What We're Aligning On)**                
                                                             
  These are the **new components** we need to reason         
  about:                                                     
                                                             
  1.  Shopify scraping / product ingestion                   
                                                             
  2.  Content Pool data model and lifecycle                  
                                                             
  3.  Video style profile abstraction                        
                                                             
  4.  How to generate **complete 60--75s videos** using      
  Remotion + existing services                               
                                                             
  5.  Autopilot orchestration (job triggering,               
  sequencing, retries)                                       
                                                             
  * * * * *                                                  
                                                             
  ### **What I Need From You (Claude)**                      
                                                             
  Please respond with **thinking and recommendations         
  only**, no code.                                           
                                                             
  #### **1\. Confirm Understanding**                         
                                                             
  Briefly restate the MVP in your own words to confirm       
  alignment.                                                 
                                                             
  #### **2\. Scraping Strategy Recommendation**              
                                                             
  Given the goal is Shopify-only for MVP:                    
                                                             
  -   Compare **Apify Shopify actors vs Firecrawl vs         
  ScrapingBee**                                              
                                                             
  -   Recommend **one primary approach** for MVP             
                                                             
  -   Explain *why* (speed, reliability, normalization       
  effort)                                                    
                                                             
  -   Call out known risks and how to mitigate them          
                                                             
  #### **3\. Content Pool Design (Conceptual)**              
                                                             
  Describe:                                                  
                                                             
  -   What data should be stored per product                 
                                                             
  -   What metadata is required for rotation and             
  tracking                                                   
                                                             
  -   How to handle missing or poor product data             
                                                             
  (No SQL, just structure and reasoning.)                    
                                                             
  #### **4\. Video Generation Strategy (Critical)**          
                                                             
  Explain **how you would generate a cohesive 60--75s        
  video** using:                                             
                                                             
  -   Remotion as the spine                                  
                                                             
  -   Existing short-form avatar/Kai clips if enabled        
                                                             
  -   Scraped product images + text                          
                                                             
  Focus on:                                                  
                                                             
  -   Scene structure                                        
                                                             
  -   Narrative flow                                         
                                                             
  -   Why this avoids the "8-second clip problem"            
                                                             
  #### **5\. Autopilot Execution Flow**                      
                                                             
  Conceptually describe:                                     
                                                             
  -   How a scheduled job picks the next product             
                                                             
  -   How it triggers generation                             
                                                             
  -   How failures are handled (retry vs pause)              
                                                             
  -   What state should be persisted                         
                                                             
  #### **6\. MVP Kill Criteria**                             
                                                             
  List:                                                      
                                                             
  -   What signals indicate this MVP is working              
                                                             
  -   What signals would tell us to stop or rethink          
                                                             
  * * * * *                                                  
                                                             
  ### **Important Instructions**                             
                                                             
  -   Do **not** propose additional features                 
                                                             
  -   Do **not** expand scope beyond MVP                     
                                                             
  -   Do **not** suggest refactors unless strictly           
  necessary                                                  
                                                             
  -   Optimize for **speed to first sellable version**       
                                                             
  * * * * *                                                  
                                                             
  ### **Output Format**                                      
                                                             
  Please structure your response with clear headings         
  matching the sections above.                               
                                                             
  * * * * *                                                  
                                                             
  If you want, after Claude responds, the *next* step        
  will be:                                                   
                                                             
  -   a **single execution / implementation planning         
  prompt**                                                   
                                                             
  -   broken into concrete phases with file touchpoints      
                                                             
  But **do not jump there yet**.-scraping bee api key        
  already added to railway incase for testing                
  ⎿  [Image #1]        ⎿  [Image #1]                                              
  ⎿  [Image #2]                                              
                                                             
⏺ Streamline Full Autopilot MVP — Alignment Document         
                                                             
  ---                                                        
  1. Confirm Understanding                                   
                                                             
  My understanding of the MVP:                               
                                                             
  Streamline Full Autopilot is a hands-free video content    
  engine for Shopify store owners only (MVP scope).          
                                                             
  The user flow:                                             
  1. User provides their Shopify store URL                   
  2. We scrape and ingest their product catalog into a       
  Content Pool                                               
  3. User reviews products, approves which ones to include   
  4. We generate one demo video (60-75s) for them to approve 
  the style                                                  
  5. Once approved, the system runs on autopilot at their    
  chosen cadence                                             
  6. Videos are generated via Remotion, published via        
  late.dev                                                   
  7. Products rotate round-robin — no product repeats until  
  all have been used                                         
                                                             
  Key constraints locked:                                    
  - Shopify only, e-commerce product demos only              
  - 60-75 second complete videos (not short clips)           
  - Avatar optional, not required                            
  - One approval, then full autopilot                        
  - Round-robin, no repeats until exhausted                  
  - Billing exists, out of scope here                        
                                                             
  ---                                                        
  2. Scraping Strategy Recommendation                        
                                                             
  Options Compared                                           
  Approach: Shopify /products.json                           
  Pros: Free, instant, structured JSON, no external          
  dependency                                                 
  Cons: Some stores disable it, limited to 250 products/page 
  Shopify Fit: Excellent                                     
  ────────────────────────────────────────                   
  Approach: Apify Shopify Actors                             
  Pros: Purpose-built, handles variants, pagination,         
    structured output                                        
  Cons: Async job model, additional service/cost, API        
    complexity                                               
  Shopify Fit: Good                                          
  ────────────────────────────────────────                   
  Approach: Firecrawl                                        
  Pros: AI-powered extraction, modern                        
  Cons: Not Shopify-specific, requires normalization,        
    newer/less proven                                        
  Shopify Fit: Medium                                        
  ────────────────────────────────────────                   
  Approach: ScrapingBee                                      
  Pros: Already integrated, handles JS, good proxies         
  Cons: Returns raw HTML, requires custom parsing, more work 
  Shopify Fit: Fallback only                                 
  Recommendation: Shopify /products.json (primary) +         
  ScrapingBee (fallback)                                     
                                                             
  Why this is the right choice for MVP:                      
                                                             
  1. Speed to implementation: Most Shopify stores expose     
  /products.json — it's a built-in Shopify feature, not a    
  hack. Returns perfectly structured JSON with all product   
  data, images, variants, prices.                            
  2. Zero cost, zero latency: No API calls to external       
  scraping services for the happy path. Instant response.    
  3. Already have the fallback: ScrapingBee key is on        
  Railway. For the ~10-15% of stores that disable the JSON   
  endpoint, we fall back to ScrapingBee + HTML parsing.      
  4. Normalization is trivial: Shopify's JSON schema is      
  consistent across stores. No AI extraction needed — it's   
  already structured.                                        
                                                             
  Implementation approach:                                   
  1. Try GET {store_url}/products.json                       
  2. If 200 + valid JSON → use it                            
  3. If 404/403/invalid → fall back to ScrapingBee           
  4. ScrapingBee fetches /collections/all, we parse product  
  links                                                      
  5. Fetch individual product pages, extract via meta tags + 
  JSON-LD                                                    
                                                             
  Risks and mitigations:                                     
  Risk: Store disables /products.json                        
  Likelihood: 10-15%                                         
  Mitigation: ScrapingBee fallback                           
  ────────────────────────────────────────                   
  Risk: Store has 1000+ products                             
  Likelihood: Low                                            
  Mitigation: Paginate (Shopify supports ?page=N), process in
                                                             
    batches                                                  
  ────────────────────────────────────────                   
  Risk: Images are CDN-gated                                 
  Likelihood: Rare                                           
  Mitigation: Shopify CDN is public, should work             
  ────────────────────────────────────────                   
  Risk: Store requires password                              
  Likelihood: ~5%                                            
  Mitigation: Detect early, show "Store is                   
  password-protected"                                        
     error                                                   
  ---                                                        
  3. Content Pool Design (Conceptual)                        
                                                             
  Per-Product Data Structure                                 
                                                             
  Core Identity:                                             
  - shopify_product_id — Shopify's numeric ID (for           
  deduplication)                                             
  - handle — URL slug (e.g., "blue-widget-pro")              
  - title — Product name                                     
  - vendor — Brand/manufacturer (if present)                 
                                                             
  Content:                                                   
  - description_html — Raw description from Shopify          
  - description_clean — Stripped/summarized text for scripts 
  - features — Array of extracted bullet points (AI-parsed   
  from description)                                          
                                                             
  Media:                                                     
  - images — Array of image URLs (ordered, first = hero)     
  - image_count — Quick check for minimum requirements       
                                                             
  Commerce:                                                  
  - price — Display price (formatted string or cents)        
  - compare_at_price — Original price if on sale             
  - currency — USD, etc.                                     
  - variants_count — Number of variants (for reference)      
                                                             
  Metadata:                                                  
  - source_url — Full product URL                            
  - scraped_at — When we ingested this                       
  - data_quality — "complete" | "partial" | "insufficient"   
                                                             
  Rotation & Lifecycle Tracking                              
                                                             
  - is_approved — User confirmed this product for rotation   
  (default false after scrape)                               
  - is_active — Currently in rotation (can be paused without 
  removing)                                                  
  - last_generated_at — Timestamp of last video generation   
  (null = never used)                                        
  - generation_count — Total videos made for this product    
  - last_generation_status — "success" | "failed" | null     
                                                             
  Handling Missing/Poor Data                                 
                                                             
  Minimum viable product data:                               
  - Title (required)                                         
  - At least 1 image (required)                              
  - Description OR at least 3 features (required)            
  - Price (optional but recommended)                         
                                                             
  Quality classification:                                    
  - Complete: Has title, 3+ images, description, price,      
  features                                                   
  - Partial: Has minimums but missing some fields            
  - Insufficient: Missing title, images, or description —    
  excluded from rotation                                     
                                                             
  User experience:                                           
  - After scrape, show products grouped by quality           
  - "Complete" products auto-suggested for approval          
  - "Partial" products shown with warnings                   
  - "Insufficient" products shown but disabled, with "Add    
  missing info" prompt                                       
                                                             
  ---                                                        
  4. Video Generation Strategy (Critical)                    
                                                             
  The Core Problem                                           
                                                             
  Current UGC pipeline produces 30-45s videos. We need 60-75s
   that feel like a complete, professional product           
  advertisement — not a montage of short clips stitched      
  together.                                                  
                                                             
  Proposed Scene Structure (60-75s Target)                   
  #: 1                                                       
  Scene: Hook                                                
  Duration: 4-5s                                             
  Content: Bold text overlay + hero product image, subtle    
  zoom                                                       
  Narrative Purpose: Stop the scroll, create curiosity       
  ────────────────────────────────────────                   
  #: 2                                                       
  Scene: Problem/Pain                                        
  Duration: 8-10s                                            
  Content: Relatable pain point + supporting visuals (product
                                                             
    context or subtle stock footage)                         
  Narrative Purpose: Establish the "why"                     
  ────────────────────────────────────────                   
  #: 3                                                       
  Scene: Product Reveal                                      
  Duration: 8-10s                                            
  Content: Product name + hero shot + one-line value prop    
  Narrative Purpose: The "what" — introduce the solution     
  ────────────────────────────────────────                   
  #: 4                                                       
  Scene: Feature Showcase                                    
  Duration: 18-22s                                           
  Content: 3-4 product images cycling with Ken Burns +       
  feature                                                    
     text callouts + voiceover                               
  Narrative Purpose: The "why buy" — deep dive on value      
  ────────────────────────────────────────                   
  #: 5                                                       
  Scene: Social Proof                                        
  Duration: 6-8s                                             
  Content: Star rating, review quote, or "trusted by X       
    customers"                                               
  Narrative Purpose: Build trust                             
  ────────────────────────────────────────                   
  #: 6                                                       
  Scene: Avatar (optional)                                   
  Duration: 8-12s                                            
  Content: KIE-generated testimonial clip                    
  Narrative Purpose: Human connection, authenticity          
  ────────────────────────────────────────                   
  #: 7                                                       
  Scene: Offer                                               
  Duration: 5-7s                                             
  Content: Price display, discount if applicable, urgency    
    element                                                  
  Narrative Purpose: The deal                                
  ────────────────────────────────────────                   
  #: 8                                                       
  Scene: CTA                                                 
  Duration: 5-6s                                             
  Content: "Shop Now" button animation + product + logo      
  Narrative Purpose: Close the sale                          
  Total range: 62-80s (tune scene durations to hit 65-70s    
  sweet spot)                                                
                                                             
  Why This Avoids the "8-Second Clip Problem"                
                                                             
  1. Each scene is substantial (5-22 seconds) — no rapid-fire
   3-second fragments                                        
  2. Clear narrative arc: Attention → Problem → Solution →   
  Proof → Offer → Action                                     
  3. Voiceover continuity: TTS narration flows across scenes 
  2-5 and 7, creating cohesion                               
  4. Avatar is one block: If enabled, it's a single 8-12s    
  segment, not spliced throughout                            
  5. Visual rhythm: Ken Burns motion, fade transitions, and  
  text animations are paced for retention, not frenetic      
                                                             
  Script Generation Flow                                     
                                                             
  Input to AI:                                               
  - Product title, description, features (parsed)            
  - Price, compare_at_price                                  
  - Brand/vendor name                                        
  - Number of images available                               
                                                             
  AI generates:                                              
  - Hook text (3-8 words)                                    
  - Problem statement (1-2 sentences)                        
  - Product intro line                                       
  - Feature callouts (3-4 short phrases)                     
  - Social proof text (can be templated if no real reviews)  
  - Offer text                                               
  - CTA text                                                 
  - Full voiceover script (for TTS)                          
                                                             
  Voiceover mapping:                                         
  - Scenes 2, 3, 4, 5, 7 get TTS narration                   
  - Scene 1 (Hook) and Scene 8 (CTA) are text-only with      
  music/ambient                                              
  - Scene 6 (Avatar) has its own embedded audio from KIE     
                                                             
  Avatar Integration (When Enabled)                          
                                                             
  - Avatar clip is generated separately via KIE (existing    
  service)                                                   
  - Script for avatar: First-person testimonial, 15-25 words 
  - Avatar output is 8s clip (KIE's current capability)      
  - Inserted as Scene 6 as a complete block                  
  - If avatar generation fails, Scene 6 is skipped (video is 
  still valid at ~55-65s)                                    
                                                             
  ---                                                        
  5. Autopilot Execution Flow                                
                                                             
  Scheduling Model                                           
                                                             
  User configures:                                           
  - Cadence: "X videos per week" (e.g., 3/week)              
  - Platforms: Which connected accounts to publish to        
  - Preferred publish times (optional, or we pick optimal    
  times)                                                     
                                                             
  System calculates:                                         
  - next_scheduled_at timestamps based on cadence            
  - Spread evenly (3/week = Mon, Wed, Fri at 10am, for       
  example)                                                   
                                                             
  Job Execution Sequence                                     
                                                             
  ┌─────────────────────────────────────────────────────────┐
  │ Every 5 minutes: Autopilot Worker runs                  │
  ├─────────────────────────────────────────────────────────┤
  │ 1. Query: Find autopilots where                         │
  │    is_active = true AND next_scheduled_at <= now()      │
  │                                                         │
  │ 2. For each due autopilot:                              │
  │    a. Select next product (round-robin query)           │
  │    b. Create AutopilotJob record (status: "generating") │
  │    c. Generate script from product data                 │
  │    d. Generate TTS audio                                │
  │    e. Generate avatar clip (if enabled)                 │
  │    f. Render video via Remotion                         │
  │    g. Upload to storage                                 │
  │    h. Publish via late.dev                              │
  │    i. Update job status → "published"                   │
  │    j. Update product.last_generated_at                  │
  │    k. Calculate next_scheduled_at                       │
  └─────────────────────────────────────────────────────────┘
                                                             
  Product Selection Query (Round-Robin, No Repeats)          
                                                             
  SELECT * FROM content_pool                                 
  WHERE autopilot_config_id = :autopilot_id                  
    AND is_approved = true                                   
    AND is_active = true                                     
  ORDER BY                                                   
    last_generated_at ASC NULLS FIRST,  -- Never-used        
  products first                                             
    generation_count ASC,                -- Then least-used  
    id ASC                               -- Deterministic    
  tiebreaker                                                 
  LIMIT 1                                                    
                                                             
  This guarantees:                                           
  - Fresh products always come first                         
  - Full rotation before any repeat                          
  - Deterministic ordering for debugging                     
                                                             
  Failure Handling                                           
  Failure Type: Script generation fails                      
  Response: Retry 2x, then skip product, log error           
  User Impact: Next product used instead                     
  ────────────────────────────────────────                   
  Failure Type: TTS fails                                    
  Response: Retry 2x, then generate video without VO         
  User Impact: Video still publishes (text-only)             
  ────────────────────────────────────────                   
  Failure Type: Avatar fails                                 
  Response: Skip avatar scene, proceed with 5-scene video    
  User Impact: Video still publishes                         
  ────────────────────────────────────────                   
  Failure Type: Render fails                                 
  Response: Retry 2x, then mark job failed, alert user       
  User Impact: Job skipped, user notified                    
  ────────────────────────────────────────                   
  Failure Type: Publish fails                                
  Response: Retry 3x, then hold in "pending_publish" queue   
  User Impact: User can manually retry                       
  ────────────────────────────────────────                   
  Failure Type: All products exhausted                       
  Response: Reset rotation, start from top                   
  User Impact: Seamless continuation                         
  Critical rule: Single product failure never pauses entire  
  autopilot. Log it, skip it, continue.                      
                                                             
  State Persistence                                          
                                                             
  AutopilotConfig (per-user):                                
  - is_active, cadence, platforms[]                          
  - video_style_profile_id                                   
  - last_run_at, next_scheduled_at                           
  - total_videos_generated, total_videos_published           
                                                             
  AutopilotJob (per-execution):                              
  - autopilot_config_id, content_pool_id                     
  - status: pending → generating → rendering → publishing →  
  published | failed                                         
  - media_asset_id (links to existing media_assets table)    
  - error_message (if failed)                                
  - scheduled_for, started_at, completed_at                  
  - platforms_published[]                                    
                                                             
  ContentPool (per-product):                                 
  - last_generated_at — updated on successful generation     
  - generation_count — incremented on success                
                                                             
  ---                                                        
  6. MVP Kill Criteria                                       
                                                             
  Success Signals (Keep Building)                            
  Signal: Onboarding completion                              
  Target: > 80% of users who start finish                    
  How to Measure: Funnel tracking                            
  ────────────────────────────────────────                   
  Signal: Scrape success rate                                
  Target: > 90% of Shopify stores work                       
  How to Measure: Error logs                                 
  ────────────────────────────────────────                   
  Signal: Demo video approval                                
  Target: > 60% approve on first generation                  
  How to Measure: Approval tracking                          
  ────────────────────────────────────────                   
  Signal: Autopilot activation                               
  Target: > 70% of approvers activate                        
  How to Measure: Config tracking                            
  ────────────────────────────────────────                   
  Signal: Video generation reliability                       
  Target: < 5% job failure rate                              
  How to Measure: Job status metrics                         
  ────────────────────────────────────────                   
  Signal: Time to first video                                
  Target: < 15 minutes from URL entry                        
  How to Measure: Timestamp tracking                         
  ────────────────────────────────────────                   
  Signal: User retention                                     
  Target: Users keep autopilot active for 2+ weeks           
  How to Measure: Activity tracking                          
  Stop/Rethink Signals                                       
  ┌──────────────┬────────────┬─────────────────────────────┐
  │    Signal    │ Threshold  │         Implication         │
  ├──────────────┼────────────┼─────────────────────────────┤
  │              │ > 25% of   │                             │
  │ Scraping     │ stores     │ Revisit scraping strategy   │
  │ failures     │ fail to    │                             │
  │              │ scrape     │                             │
  ├──────────────┼────────────┼─────────────────────────────┤
  │ Demo         │ > 50%      │ Video quality or style      │
  │ rejection    │ reject     │ problem                     │
  │ rate         │ first demo │                             │
  ├──────────────┼────────────┼─────────────────────────────┤
  │ Generation   │ > 15 min   │ Infrastructure/architecture │
  │ time         │ average    │  issue                      │
  │              │ per video  │                             │
  ├──────────────┼────────────┼─────────────────────────────┤
  │              │ > 40% turn │                             │
  │ Autopilot    │  off       │ Value prop not landing      │
  │ deactivation │ within 7   │                             │
  │              │ days       │                             │
  ├──────────────┼────────────┼─────────────────────────────┤
  │ Cost per     │ Exceeds    │                             │
  │ video        │ revenue    │ Unit economics broken       │
  │              │ per video  │                             │
  ├──────────────┼────────────┼─────────────────────────────┤
  │              │ High       │                             │
  │ Support      │ tickets    │                             │
  │ volume       │ about      │ Quality bar not met         │
  │              │ video      │                             │
  │              │ quality    │                             │
  └──────────────┴────────────┴─────────────────────────────┘
  Minimum Viable Launch Criteria                             
                                                             
  Before calling MVP "done," we need:                        
  - 10 successful end-to-end runs (URL → published video)    
  - 3 different Shopify stores tested                        
  - Round-robin rotation verified over 5+ products           
  - Failure recovery tested (intentional failures)           
  - At least one real user completes flow and approves       
                                                             
  ---                                                        
  Summary                                                    
                                                             
  This MVP is achievable with existing infrastructure. The   
  key new work is:                                           
                                                             
  1. Shopify ingestion — /products.json primary, ScrapingBee 
  fallback                                                   
  2. Content Pool + rotation tracking — New data model       
  3. 60-75s video structure — Extended scene architecture    
  4. Autopilot scheduler — Background worker with job        
  tracking                                                   
                                                             
  The riskiest piece is video quality at 60-75s — ensuring it
   feels like a real ad, not a slideshow. This should be     
  validated early with real product data before building the 
  full autopilot machinery.                                  
                                                             
  ---                                                        
  Ready for implementation planning when you are.            
                                                             
✻ Brewed for 2m 10s                                          
 
**Claude Implementation Planning Prompt --- Streamline Full Autopilot MVP**
-------------------------------------------------------------------------

> **Role & Mode**

> You are now acting as a **senior staff engineer + technical product owner**.

>

> Alignment is complete. The product scope, constraints, and architecture are **locked**.

>

> This task is **implementation planning only**.

>

> ❌ No code yet

> ❌ No refactors unless explicitly justified

> ❌ No feature expansion beyond MVP

>

> Your job is to produce a **clear, minimal, execution-ready implementation plan** that a single engineer (you) could follow step-by-step.

* * * * *

**Context (Locked, Do Not Reinterpret)**
----------------------------------------

You have already produced and agreed on the **Streamline Full Autopilot MVP Alignment Document**, which includes:

-   Shopify-only ingestion (/products.json primary, ScrapingBee fallback)

-   E-commerce product demo videos only

-   60--75s Remotion-based complete videos

-   Avatar optional (single scene, skip-safe)

-   First-video approval only, autopilot after

-   Round-robin rotation, no repeats until exhausted

-   Publishing + scheduling already implemented via late.dev

-   Existing systems: content engine, Remotion worker, Kai, TTS, media assets, credits

Assume all of that is correct and final.

* * * * *

**Objective**
-------------

Produce a **sniper-clean implementation plan** for adding **Streamline Full Autopilot (MVP)** to the existing application.

The plan should:

-   Minimize risk

-   Maximize early validation

-   Avoid "Frankenstein" creep

-   Prioritize *preview video quality* over automation depth

* * * * *

**What I Want From You**
------------------------

### **1\. MVP Build Phases (Strictly Ordered)**

Break the work into **clear phases**, where:

-   Each phase is independently testable

-   Each phase unlocks real user value

-   We can stop after any phase and still have something demoable

For each phase, include:

-   Goal of the phase

-   What must exist at the end of the phase

-   What is explicitly *out of scope* for that phase

* * * * *

### **2\. Concrete Work Breakdown per Phase**

For each phase, list:

-   Backend components to add or extend

-   Frontend screens or UI changes needed

-   Background jobs / workers involved

-   Which existing services are reused vs extended

This should be **conceptual but specific** (e.g. "new ContentPool table", not SQL).

* * * * *

### **3\. Critical Path Identification**

Explicitly call out:

-   Which parts are **blocking everything else**

-   Which parts can be safely delayed

-   Which parts should be built *first to validate quality* (especially video)

* * * * *

### **4\. Video Preview Validation Plan (Very Important)**

Describe:

-   The **earliest possible way** to validate that a 60--75s video feels "real"

-   How to test this **before** full autopilot logic exists

-   What success/failure looks like at this stage

This is the highest-risk part of the system --- treat it as such.

* * * * *

### **5\. Scraping Integration Plan**

Describe:

-   How Shopify /products.json ingestion plugs into the system

-   How fallback scraping is triggered and handled

-   How partial or poor data is surfaced to the user

Do **not** design a general crawler --- stay MVP-focused.

* * * * *

### **6\. Autopilot Orchestration (Minimal)**

Describe:

-   The minimal scheduler / worker setup needed

-   How jobs are persisted and retried

-   What states are required to make this safe

Avoid overengineering --- we want "robust enough," not perfect.

* * * * *

### **7\. "Do NOT Build Yet" List**

Explicitly list:

-   Features

-   Optimizations

-   Abstractions

    that should **not** be built in MVP, even if tempting.

This section is mandatory.

* * * * *

### **8\. Implementation Readiness Checklist**

End with a checklist answering:

-   What must be true before starting to code?

-   What data or credentials are required?

-   What assumptions should be validated first?

* * * * *

**Output Requirements**
-----------------------

-   Use clear headings

-   Be concise but concrete

-   No speculative features

-   No code blocks

-   No diagrams required

-   Optimize for *execution clarity*

* * * * *

**Final Instruction**
---------------------

Do **not** jump to implementation.

Do **not** propose alternate architectures.

This plan should make the next step obvious:

> "Yes --- now we can write the execution prompt."

* * * * *                     
────────────────────────────────────────────────────────────
 Ready to code?                                              
                                                             
 Here is Claude's plan:                                      
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Streamline Full Autopilot MVP - Implementation Plan         
                                                             
 Executive Summary                                           
                                                             
 Build a hands-free video content engine for Shopify         
 e-commerce stores. User onboards once, approves first video 
  style, and Streamline continuously generates and publishes 
  60-75 second product demo videos.                          
                                                             
 Core Flow: Shopify URL → Product Scrape → Content Pool →    
 Video Generation → First-Video Approval → Autopilot         
 Publishing                                                  
                                                             
 ---                                                         
 Locked Constraints (Do Not Deviate)                         
 Constraint: Store Type                                      
 Value: Shopify only                                         
 Rationale: /products.json endpoint, predictable structure   
 ────────────────────────────────────────                    
 Constraint: Video Duration                                  
 Value: 60-75 seconds                                        
 Rationale: Longer-form product demos, not quick clips       
 ────────────────────────────────────────                    
 Constraint: Approval Model                                  
 Value: First video only                                     
 Rationale: Then fully autonomous                            
 ────────────────────────────────────────                    
 Constraint: Rotation                                        
 Value: Round-robin, no repeats                              
 Rationale: Until pool exhausted                             
 ────────────────────────────────────────                    
 Constraint: Avatar                                          
 Value: Optional (skip for MVP)                              
 Rationale: Simplifies pipeline                              
 ────────────────────────────────────────                    
 Constraint: Publishing                                      
 Value: Late.dev integration                                 
 Rationale: Already built, reuse                             
 ---                                                         
 Architecture Overview                                       
                                                             
 ┌────────────────────────────────────────────────────────── 
 ───────┐                                                    
 │                    FULL AUTOPILOT FLOW                    
        │                                                    
 ├────────────────────────────────────────────────────────── 
 ───────┤                                                    
 │                                                           
        │                                                    
 │  1. ONBOARDING                                            
        │                                                    
 │     User enters Shopify URL                               
        │                                                    
 │          ↓                                                
        │                                                    
 │     Scrape /products.json (fallback: ScrapingBee)         
        │                                                    
 │          ↓                                                
        │                                                    
 │     Store products in autopilot_products table            
        │                                                    
 │          ↓                                                
        │                                                    
 │     User reviews Content Pool in UI                       
        │                                                    
 │                                                           
        │                                                    
 ├────────────────────────────────────────────────────────── 
 ───────┤                                                    
 │                                                           
        │                                                    
 │  2. STYLE SETUP                                           
        │                                                    
 │     User selects video style (tone, format)               
        │                                                    
 │          ↓                                                
        │                                                    
 │     Generate FIRST video from random product              
        │                                                    
 │          ↓                                                
        │                                                    
 │     User approves or adjusts & regenerates                
        │                                                    
 │          ↓                                                
        │                                                    
 │     Style Profile locked                                  
        │                                                    
 │                                                           
        │                                                    
 ├────────────────────────────────────────────────────────── 
 ───────┤                                                    
 │                                                           
        │                                                    
 │  3. AUTOPILOT CONFIG                                      
        │                                                    
 │     User sets: cadence (X videos/week), platforms         
        │                                                    
 │          ↓                                                
        │                                                    
 │     Connect social accounts (reuse existing Late.dev      
 flow)      │                                                
 │          ↓                                                
        │                                                    
 │     Activate autopilot                                    
        │                                                    
 │                                                           
        │                                                    
 ├────────────────────────────────────────────────────────── 
 ───────┤                                                    
 │                                                           
        │                                                    
 │  4. CONTINUOUS GENERATION (Cron-Triggered)                
        │                                                    
 │     Scheduler picks next product (round-robin)            
        │                                                    
 │          ↓                                                
        │                                                    
 │     Generate script → TTS → Render video                  
        │                                                    
 │          ↓                                                
        │                                                    
 │     Queue to Late.dev for scheduled publish               
        │                                                    
 │          ↓                                                
        │                                                    
 │     Mark product as "used", move to back of queue         
        │                                                    
 │          ↓                                                
        │                                                    
 │     Repeat on schedule                                    
        │                                                    
 │                                                           
        │                                                    
 └────────────────────────────────────────────────────────── 
 ───────┘                                                    
                                                             
 ---                                                         
 Phase 1: Shopify Scraping Service                           
                                                             
 Goal: Reliably extract products from any Shopify store.     
                                                             
 What to Build                                               
 File: server/services/shopifyScraperService.ts              
 Purpose: Primary scraper using /products.json               
 ────────────────────────────────────────                    
 File: shared/schema.ts                                      
 Purpose: New tables: autopilot_stores, autopilot_products   
 Scraping Strategy                                           
                                                             
 // Primary: Direct Shopify API (no auth required)           
 GET https://{store-domain}/products.json?limit=250          
                                                             
 // Fallback: ScrapingBee (if blocked/rate-limited)          
 // Already have ScrapingBee integration in codebase         
                                                             
 Data Extraction (Per Product)                               
                                                             
 interface ScrapedProduct {                                  
   externalId: string;        // Shopify product ID          
   title: string;                                            
   description: string;       // HTML stripped               
   images: string[];          // Up to 4 image URLs          
   price: string;             // Formatted price             
   variants?: string[];       // Color/size options          
   tags?: string[];           // For categorization          
 }                                                           
                                                             
 Database Schema                                             
                                                             
 -- Stores table                                             
 CREATE TABLE autopilot_stores (                             
   id UUID PRIMARY KEY,                                      
   user_id INTEGER REFERENCES users(id),                     
   shopify_domain TEXT NOT NULL,                             
   store_name TEXT,                                          
   logo_url TEXT,                                            
   last_scraped_at TIMESTAMP,                                
   product_count INTEGER DEFAULT 0,                          
   status TEXT DEFAULT 'pending', -- pending, active,        
 paused, error                                               
   created_at TIMESTAMP DEFAULT NOW()                        
 );                                                          
                                                             
 -- Products table (scraped inventory)                       
 CREATE TABLE autopilot_products (                           
   id UUID PRIMARY KEY,                                      
   store_id UUID REFERENCES autopilot_stores(id),            
   external_id TEXT NOT NULL,                                
   title TEXT NOT NULL,                                      
   description TEXT,                                         
   images JSONB NOT NULL,        -- string[]                 
   price TEXT,                                               
   tags JSONB,                   -- string[]                 
   last_used_at TIMESTAMP,       -- For round-robin          
   use_count INTEGER DEFAULT 0,                              
   is_active BOOLEAN DEFAULT TRUE,                           
   created_at TIMESTAMP DEFAULT NOW(),                       
   UNIQUE(store_id, external_id)                             
 );                                                          
                                                             
 API Endpoints                                               
                                                             
 POST /api/autopilot/stores/scrape                           
   Body: { shopifyUrl: string }                              
   Response: { storeId, productCount, products[] }           
                                                             
 GET /api/autopilot/stores/:storeId/products                 
   Response: { products[], total }                           
                                                             
 PATCH /api/autopilot/products/:productId                    
   Body: { isActive?: boolean, title?: string }              
                                                             
 Acceptance Criteria                                         
                                                             
 - Successfully scrape 5 different Shopify stores            
 - Extract title, description, images, price                 
 - Fall back to ScrapingBee if direct request fails          
 - Products stored in database with store association        
 - Duplicate products detected on re-scrape (upsert)         
                                                             
 Failure Handling                                            
 Failure: Invalid URL                                        
 Response: 400: "Not a valid Shopify store URL"              
 ────────────────────────────────────────                    
 Failure: Store not found                                    
 Response: 404: "Store not found or not accessible"          
 ────────────────────────────────────────                    
 Failure: Rate limited                                       
 Response: Retry with ScrapingBee fallback                   
 ────────────────────────────────────────                    
 Failure: No products                                        
 Response: 400: "No products found on store"                 
 ---                                                         
 Phase 2: Extended Video Template (60-75s)                   
                                                             
 Goal: Expand UGC composition from 30-45s to 60-75s with 8   
 scenes.                                                     
                                                             
 Scene Structure (60-75 seconds)                             
 #: 1                                                        
 Scene: Hook                                                 
 Duration: 3-5s                                              
 Content: Bold text + product hero                           
 ────────────────────────────────────────                    
 #: 2                                                        
 Scene: Problem                                              
 Duration: 8-10s                                             
 Content: Pain point narration                               
 ────────────────────────────────────────                    
 #: 3                                                        
 Scene: Reveal                                               
 Duration: 8-12s                                             
 Content: Product introduction                               
 ────────────────────────────────────────                    
 #: 4                                                        
 Scene: Features                                             
 Duration: 12-15s                                            
 Content: 3-4 benefits with visuals                          
 ────────────────────────────────────────                    
 #: 5                                                        
 Scene: Social Proof                                         
 Duration: 8-10s                                             
 Content: Testimonial/stats overlay                          
 ────────────────────────────────────────                    
 #: 6                                                        
 Scene: Avatar                                               
 Duration: 0-10s                                             
 Content: Optional KIE clip (skip MVP)                       
 ────────────────────────────────────────                    
 #: 7                                                        
 Scene: Offer                                                
 Duration: 5-8s                                              
 Content: Price/discount highlight                           
 ────────────────────────────────────────                    
 #: 8                                                        
 Scene: CTA                                                  
 Duration: 5-8s                                              
 Content: Call-to-action + logo                              
 Total: 60-75 seconds (without avatar: 57-68s)               
                                                             
 What to Build                                               
 File: my-video/src/scenes/ProblemScene.tsx                  
 Purpose: New scene                                          
 ────────────────────────────────────────                    
 File: my-video/src/scenes/RevealScene.tsx                   
 Purpose: New scene                                          
 ────────────────────────────────────────                    
 File: my-video/src/scenes/SocialProofScene.tsx              
 Purpose: New scene                                          
 ────────────────────────────────────────                    
 File: my-video/src/scenes/OfferScene.tsx                    
 Purpose: New scene                                          
 ────────────────────────────────────────                    
 File: my-video/src/compositions/AutopilotComposition.tsx    
 Purpose: New 8-scene master                                 
 ────────────────────────────────────────                    
 File: my-video/src/types/AutopilotSceneProps.ts             
 Purpose: Type definitions                                   
 Updated Scene Constraints                                   
                                                             
 const AUTOPILOT_SCENE_CONSTRAINTS = {                       
   hook: { min: 3, max: 5, default: 4 },                     
   problem: { min: 8, max: 10, default: 9 },                 
   reveal: { min: 8, max: 12, default: 10 },                 
   features: { min: 12, max: 15, default: 14 },              
   socialProof: { min: 8, max: 10, default: 9 },             
   avatar: { min: 0, max: 10, default: 0 },  // Skip for MVP 
   offer: { min: 5, max: 8, default: 6 },                    
   cta: { min: 5, max: 8, default: 6 },                      
 };                                                          
 // Total: 57-78s (target 60-75s)                            
                                                             
 Script Generation Update                                    
                                                             
 Extend ugcScriptGenerator.ts to generate:                   
 - Problem narration (pain point)                            
 - Reveal narration (product intro)                          
 - Social proof text (testimonial/stat)                      
 - Offer text (price/discount)                               
                                                             
 Acceptance Criteria                                         
                                                             
 - All 8 scene components render correctly                   
 - Total duration is 60-75 seconds                           
 - Scenes transition smoothly                                
 - Can skip avatar scene (duration = 0)                      
 - TTS audio syncs with scene durations                      
                                                             
 ---                                                         
 Phase 3: Style Profile & First-Video Approval               
                                                             
 Goal: User approves video style before autopilot activates. 
                                                             
 Style Profile Schema                                        
                                                             
 CREATE TABLE autopilot_configs (                            
   id UUID PRIMARY KEY,                                      
   store_id UUID REFERENCES autopilot_stores(id),            
   user_id INTEGER REFERENCES users(id),                     
                                                             
   -- Style settings                                         
   tone TEXT DEFAULT 'casual',           -- casual,          
 professional, energetic                                     
   voice_id TEXT,                        -- ElevenLabs voice 
   include_avatar BOOLEAN DEFAULT FALSE,                     
                                                             
   -- Schedule settings                                      
   videos_per_week INTEGER DEFAULT 3,                        
   platforms JSONB,                      -- ["youtube",      
 "instagram", "tiktok"]                                      
                                                             
   -- State                                                  
   is_approved BOOLEAN DEFAULT FALSE,    -- First video      
 approved?                                                   
   is_active BOOLEAN DEFAULT FALSE,      -- Autopilot        
 running?                                                    
                                                             
   -- Tracking                                               
   first_video_asset_id UUID,                                
   next_scheduled_at TIMESTAMP,                              
   last_generated_at TIMESTAMP,                              
                                                             
   created_at TIMESTAMP DEFAULT NOW()                        
 );                                                          
                                                             
 First-Video Flow                                            
                                                             
 1. User sets style preferences                              
 2. System picks random product from pool                    
 3. Generate preview video (same pipeline as production)     
 4. User watches preview in UI                               
 5. User can:                                                
    a. Approve → Lock style, enable autopilot                
    b. Adjust settings → Regenerate preview                  
    c. Pick different product → Regenerate                   
 6. On approval:                                             
    - Mark config as `is_approved = true`                    
    - Schedule first autopilot run                           
                                                             
 API Endpoints                                               
                                                             
 POST /api/autopilot/configs                                 
   Body: { storeId, tone, voiceId, videosPerWeek, platforms  
 }                                                           
   Response: { configId }                                    
                                                             
 POST /api/autopilot/configs/:configId/preview               
   Response: { assetId } (poll for video)                    
                                                             
 POST /api/autopilot/configs/:configId/approve               
   Response: { status: 'active', nextScheduledAt }           
                                                             
 PATCH /api/autopilot/configs/:configId                      
   Body: { tone?, voiceId?, videosPerWeek? }                 
                                                             
 Acceptance Criteria                                         
                                                             
 - User can set style preferences                            
 - Preview video generates with selected style               
 - User can regenerate with different settings               
 - Approval locks style and activates autopilot              
 - Config tracks approval state                              
                                                             
 ---                                                         
 Phase 4: Round-Robin Product Rotation                       
                                                             
 Goal: Cycle through products without repeats until pool     
 exhausted.                                                  
                                                             
 Rotation Algorithm                                          
                                                             
 async function getNextProduct(storeId: string):             
 Promise<Product | null> {                                   
   // Get product with oldest last_used_at (or never used)   
   // that is still active                                   
   const product = await db.query(`                          
     SELECT * FROM autopilot_products                        
     WHERE store_id = $1 AND is_active = TRUE                
     ORDER BY                                                
       last_used_at ASC NULLS FIRST,  -- Never used first    
       use_count ASC,                  -- Then least used    
       created_at ASC                  -- Then oldest added  
     LIMIT 1                                                 
   `, [storeId]);                                            
                                                             
   return product || null;                                   
 }                                                           
                                                             
 async function markProductUsed(productId: string):          
 Promise<void> {                                             
   await db.query(`                                          
     UPDATE autopilot_products                               
     SET last_used_at = NOW(), use_count = use_count + 1     
     WHERE id = $1                                           
   `, [productId]);                                          
 }                                                           
                                                             
 Pool Exhaustion Handling                                    
                                                             
 When all products have been used:                           
 1. Continue cycling (round-robin resets)                    
 2. use_count tracks total uses per product                  
 3. Dashboard shows "Pool cycled X times"                    
                                                             
 What to Build                                               
 File: server/services/autopilotProductService.ts            
 Purpose: Product rotation logic                             
 Acceptance Criteria                                         
                                                             
 - Products selected in round-robin order                    
 - Never-used products prioritized                           
 - last_used_at updated after video generation               
 - Pool cycles correctly when exhausted                      
 - Inactive products skipped                                 
                                                             
 ---                                                         
 Phase 5: Autopilot Scheduler                                
                                                             
 Goal: Cron-based video generation and publishing.           
                                                             
 Scheduler Design                                            
                                                             
 // scripts/cron-autopilot-generator.ts                      
 // Runs every hour, checks for due configs                  
                                                             
 async function runAutopilotCycle() {                        
   // 1. Find configs due for generation                     
   const dueConfigs = await db.query(`                       
     SELECT * FROM autopilot_configs                         
     WHERE is_active = TRUE                                  
     AND is_approved = TRUE                                  
     AND next_scheduled_at <= NOW()                          
   `);                                                       
                                                             
   for (const config of dueConfigs) {                        
     // 2. Get next product                                  
     const product = await getNextProduct(config.store_id);  
     if (!product) continue;                                 
                                                             
     // 3. Generate video                                    
     const assetId = await generateAutopilotVideo({          
       product,                                              
       config,                                               
     });                                                     
                                                             
     // 4. Queue to Late.dev                                 
     await scheduleToLate({                                  
       assetId,                                              
       platforms: config.platforms,                          
     });                                                     
                                                             
     // 5. Mark product used                                 
     await markProductUsed(product.id);                      
                                                             
     // 6. Calculate next run                                
     await updateNextScheduled(config.id,                    
 config.videos_per_week);                                    
   }                                                         
 }                                                           
                                                             
 Schedule Calculation                                        
                                                             
 function calculateNextScheduled(videosPerWeek: number):     
 Date {                                                      
   const intervalDays = 7 / videosPerWeek;                   
   const next = new Date();                                  
   next.setDate(next.getDate() + intervalDays);              
   return next;                                              
 }                                                           
                                                             
 // Examples:                                                
 // 7/week → every 1 day                                     
 // 3/week → every 2.3 days                                  
 // 1/week → every 7 days                                    
                                                             
 What to Build                                               
 File: scripts/cron-autopilot-generator.ts                   
 Purpose: Hourly cron job                                    
 ────────────────────────────────────────                    
 File: server/services/autopilotSchedulerService.ts          
 Purpose: Scheduling logic                                   
 ────────────────────────────────────────                    
 File: server/services/autopilotVideoService.ts              
 Purpose: Video generation orchestration                     
 Acceptance Criteria                                         
                                                             
 - Cron runs hourly and finds due configs                    
 - Videos generate for due configs                           
 - Videos queue to Late.dev correctly                        
 - next_scheduled_at updates after generation                
 - Failed generations don't block other configs              
                                                             
 ---                                                         
 Phase 6: Dashboard & Monitoring                             
                                                             
 Goal: User visibility into autopilot status.                
                                                             
 Dashboard Data                                              
                                                             
 interface AutopilotDashboard {                              
   store: {                                                  
     name: string;                                           
     domain: string;                                         
     productCount: number;                                   
   };                                                        
   config: {                                                 
     tone: string;                                           
     videosPerWeek: number;                                  
     platforms: string[];                                    
     isActive: boolean;                                      
   };                                                        
   stats: {                                                  
     videosGenerated: number;                                
     videosPublished: number;                                
     productsUsed: number;                                   
     poolCycles: number;                                     
   };                                                        
   upcoming: {                                               
     nextProduct: Product;                                   
     nextScheduledAt: Date;                                  
   };                                                        
   recent: {                                                 
     videos: Video[];  // Last 10 generated                  
   };                                                        
 }                                                           
                                                             
 API Endpoints                                               
                                                             
 GET /api/autopilot/dashboard/:storeId                       
   Response: AutopilotDashboard                              
                                                             
 POST /api/autopilot/configs/:configId/pause                 
 POST /api/autopilot/configs/:configId/resume                
                                                             
 GET /api/autopilot/stores/:storeId/history                  
   Response: { videos[], total }                             
                                                             
 Acceptance Criteria                                         
                                                             
 - Dashboard shows current autopilot status                  
 - User can pause/resume autopilot                           
 - Recent videos visible                                     
 - Next scheduled generation visible                         
 - Pool rotation stats shown                                 
                                                             
 ---                                                         
 Critical Path (Dependency Order)                            
                                                             
 Phase 1: Shopify Scraping ──────────────────────┐           
                                                  │          
 Phase 2: Extended Video Template ────────────────┼──→ Phase 
  3: Style Profile                                           
                                                  │          
 │                                                           
                                                  │          
 ↓                                                           
                                                  │    Phase 
  4: Round-Robin                                             
                                                  │          
 │                                                           
                                                  │          
 ↓                                                           
                                                  └───→      
 Phase 5: Scheduler                                          
                                                             
 │                                                           
                                                             
 ↓                                                           
                                                      Phase  
 6: Dashboard                                                
                                                             
 Parallel Tracks:                                            
 - Phase 1 and Phase 2 can run in parallel (no dependencies) 
 - Phase 3+ requires both Phase 1 and Phase 2                
                                                             
 ---                                                         
 Do NOT Build Yet (Post-MVP)                                 
 Feature: Multi-store support                                
 Why Defer: MVP = 1 store per user                           
 ────────────────────────────────────────                    
 Feature: Avatar generation                                  
 Why Defer: Adds complexity, skip for MVP                    
 ────────────────────────────────────────                    
 Feature: Background music                                   
 Why Defer: Voiceover-only for now                           
 ────────────────────────────────────────                    
 Feature: Analytics/insights                                 
 Why Defer: Basic stats only for MVP                         
 ────────────────────────────────────────                    
 Feature: A/B testing styles                                 
 Why Defer: Single style for MVP                             
 ────────────────────────────────────────                    
 Feature: Product categorization                             
 Why Defer: Flat pool for MVP                                
 ────────────────────────────────────────                    
 Feature: Rescrape scheduling                                
 Why Defer: Manual rescrape for MVP                          
 ────────────────────────────────────────                    
 Feature: Webhook notifications                              
 Why Defer: Polling UI for MVP                               
 ────────────────────────────────────────                    
 Feature: Credit/billing integration                         
 Why Defer: Post-launch                                      
 ---                                                         
 Files to Create/Modify                                      
                                                             
 New Files                                                   
 File: server/services/shopifyScraperService.ts              
 Phase: 1                                                    
 ────────────────────────────────────────                    
 File: server/services/autopilotProductService.ts            
 Phase: 4                                                    
 ────────────────────────────────────────                    
 File: server/services/autopilotSchedulerService.ts          
 Phase: 5                                                    
 ────────────────────────────────────────                    
 File: server/services/autopilotVideoService.ts              
 Phase: 5                                                    
 ────────────────────────────────────────                    
 File: scripts/cron-autopilot-generator.ts                   
 Phase: 5                                                    
 ────────────────────────────────────────                    
 File: my-video/src/scenes/ProblemScene.tsx                  
 Phase: 2                                                    
 ────────────────────────────────────────                    
 File: my-video/src/scenes/RevealScene.tsx                   
 Phase: 2                                                    
 ────────────────────────────────────────                    
 File: my-video/src/scenes/SocialProofScene.tsx              
 Phase: 2                                                    
 ────────────────────────────────────────                    
 File: my-video/src/scenes/OfferScene.tsx                    
 Phase: 2                                                    
 ────────────────────────────────────────                    
 File: my-video/src/compositions/AutopilotComposition.tsx    
 Phase: 2                                                    
 ────────────────────────────────────────                    
 File: my-video/src/types/AutopilotSceneProps.ts             
 Phase: 2                                                    
 Modified Files                                              
 File: shared/schema.ts                                      
 Phase: 1                                                    
 Changes: Add 3 new tables                                   
 ────────────────────────────────────────                    
 File: server/routes.ts                                      
 Phase: 1-6                                                  
 Changes: Add autopilot endpoints                            
 ────────────────────────────────────────                    
 File: server/services/ugcScriptGenerator.ts                 
 Phase: 2                                                    
 Changes: Extended script generation                         
 ────────────────────────────────────────                    
 File: server/services/ugcAudioPreparer.ts                   
 Phase: 2                                                    
 Changes: Extended scene constraints                         
 ────────────────────────────────────────                    
 File: my-video/src/Root.tsx                                 
 Phase: 2                                                    
 Changes: Register new composition                           
 ---                                                         
 Verification Plan                                           
                                                             
 Phase 1 Verification                                        
                                                             
 # Test scraping                                             
 curl -X POST                                                
 http://localhost:5000/api/autopilot/stores/scrape \         
   -H "Authorization: Bearer {token}" \                      
   -H "Content-Type: application/json" \                     
   -d '{"shopifyUrl": "https://allbirds.com"}'               
                                                             
 # Expected: { storeId, productCount: 50+, products: [...] } 
                                                             
 Phase 2 Verification                                        
                                                             
 # Test extended composition render                          
 cd my-video && npm run build                                
 # Check for AutopilotComposition in bundle                  
                                                             
 # Manual test: Render 60s video                             
 # Verify all 8 scenes present (minus avatar)                
                                                             
 Phase 3 Verification                                        
                                                             
 # Create config and generate preview                        
 curl -X POST http://localhost:5000/api/autopilot/configs \  
   -d '{"storeId": "...", "tone": "casual", "videosPerWeek": 
  3}'                                                        
                                                             
 curl -X POST                                                
 http://localhost:5000/api/autopilot/configs/{id}/preview    
                                                             
 # Poll for video, watch preview                             
 # Approve and verify autopilot activates                    
                                                             
 Phase 5 Verification                                        
                                                             
 # Run scheduler manually                                    
 npx ts-node scripts/cron-autopilot-generator.ts             
                                                             
 # Verify:                                                   
 # - Video generated for due config                          
 # - Product marked as used                                  
 # - Next scheduled time updated                             
 # - Late.dev queue populated                                
                                                             
 ---                                                         
 Implementation Readiness Checklist                          
                                                             
 Before starting implementation:                             
                                                             
 - Shopify /products.json endpoint confirmed accessible      
 - Existing UGC composition works (Phase 1-6 complete)       
 - TTS service operational (ElevenLabs)                      
 - Render worker operational (Docker)                        
 - Late.dev integration working                              
 - Database migrations pattern established                   
 - Cron pattern exists                                       
 (scripts/cron-check-scheduled-posts.ts)                     
                                                             
 ---                                                         
 Recommended Start Point                                     
                                                             
 Start with Phase 1 (Shopify Scraping) because:              
 1. Foundation for all other phases                          
 2. Can validate against real Shopify stores                 
 3. Low complexity, high value                               
 4. UI can be built in parallel                              
                                                             
 ---                                                         
 Risk Mitigation                                             
 Risk: Shopify rate limits                                   
 Mitigation: ScrapingBee fallback, respect 2req/s            
 ────────────────────────────────────────                    
 Risk: Video generation slow                                 
 Mitigation: Queue-based, async processing                   
 ────────────────────────────────────────                    
 Risk: TTS rate limits                                       
 Mitigation: Existing caching, exponential backoff           
 ────────────────────────────────────────                    
 Risk: Late.dev API changes                                  
 Mitigation: Abstract behind service layer                   
 ────────────────────────────────────────                    
 Risk: Render worker crashes                                 
 Mitigation: Retry logic, mark failed gracefully             
 ---                                                         
 End of plan.                                                
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
                                                            
⏺ The my-video directory compiles cleanly. Now let me provide
   a summary of what was implemented.                        
                                                             
  Summary                                                    
                                                             
  I've implemented the Streamline Full Autopilot MVP as      
  specified in the plan. Here's what was built:              
                                                             
  Phase 1: Shopify Scraping Service                          
                                                             
  - server/services/shopifyScraperService.ts - Primary       
  scraper using /products.json endpoint with ScrapingBee     
  fallback                                                   
  - Extracts title, description, images (up to 4), price,    
  variants, and tags                                         
  - Validates and normalizes Shopify URLs                    
                                                             
  Phase 2: Extended Video Template (60-75s)                  
                                                             
  Created 4 new scenes and the master composition:           
  - my-video/src/scenes/ProblemScene.tsx - Pain point        
  presentation (8-10s)                                       
  - my-video/src/scenes/RevealScene.tsx - Product            
  introduction with dramatic reveal (8-12s)                  
  - my-video/src/scenes/SocialProofScene.tsx -               
  Testimonials/stats display (8-10s)                         
  - my-video/src/scenes/OfferScene.tsx - Price/discount      
  highlight (5-8s)                                           
  - my-video/src/compositions/AutopilotComposition.tsx -     
  8-scene master composition                                 
  - my-video/src/types/AutopilotSceneProps.ts - Type         
  definitions for all scenes                                 
                                                             
  Phase 3: Style Profile & First-Video Approval              
                                                             
  - server/services/autopilotScriptGenerator.ts - AI-powered 
  8-scene script generation                                  
  - server/services/autopilotAudioPreparer.ts - TTS audio    
  generation for all scenes                                  
  - API endpoints for config creation, preview generation,   
  and approval workflow                                      
                                                             
  Phase 4: Round-Robin Product Rotation                      
                                                             
  - server/services/autopilotProductService.ts - Product     
  rotation with getNextProduct() algorithm                   
  - Prioritizes never-used products, then least-used, then   
  oldest-used                                                
  - Tracks lastUsedAt and useCount for each product          
                                                             
  Phase 5: Autopilot Scheduler                               
                                                             
  - server/services/autopilotSchedulerService.ts - Scheduling
   and execution logic                                       
  - server/services/autopilotVideoService.ts - Full video    
  generation pipeline orchestration                          
  - scripts/cron-autopilot-generator.ts - Hourly cron job for
   automated generation                                      
                                                             
  Phase 6: Dashboard & Monitoring APIs                       
                                                             
  Added comprehensive API endpoints to server/routes.ts:     
  - POST /api/autopilot/stores/scrape - Scrape products from 
  Shopify store                                              
  - GET /api/autopilot/stores - Get user's stores            
  - GET /api/autopilot/stores/:storeId/products - Get        
  products for a store                                       
  - PATCH /api/autopilot/products/:productId - Update product
  - POST /api/autopilot/configs - Create autopilot config    
  - GET /api/autopilot/configs/:configId - Get config        
  - POST /api/autopilot/configs/:configId/preview - Generate 
  preview video                                              
  - POST /api/autopilot/configs/:configId/approve - Approve  
  and activate autopilot                                     
  - POST /api/autopilot/configs/:configId/pause - Pause      
  autopilot                                                  
  - POST /api/autopilot/configs/:configId/resume - Resume    
  autopilot                                                  
  - GET /api/autopilot/dashboard/:storeId - Get full         
  dashboard data                                             
  - GET /api/autopilot/stores/:storeId/history - Get         
  generation history                                         
                                                             
  Database Schema                                            
                                                             
  Added to shared/schema.ts:                                 
  - autopilot_stores - Connected Shopify stores              
  - autopilot_products - Scraped product inventory           
  - autopilot_configs - Style profile and schedule settings  
  - autopilot_history - Generation and publishing history    
                                                             
  The implementation follows all locked constraints:         
  Shopify-only, 60-75s videos, first-video approval model,   
  round-robin rotation, optional avatar (skipped for MVP),   
  and Late.dev integration.                                  
                                                             
✻ Sautéed for 13m 31s                                        
      npm run build 2>&1)                                    
  ⎿  > my-video@1.0.0 build                                  
     > remotion bundle                                       
     … +14 lines (ctrl+o to expand)                          
                                                             
⏺ The Remotion bundle built successfully. All autopilot code 
  is ready. Here's the deployment summary:                   
                                                             
  ✅ Pre-Deployment Checklist Complete                       
                                                             
  Files Created/Modified:                                    
                                                             
  Server Services:                                           
  - server/services/shopifyScraperService.ts - Shopify       
  product scraping                                           
  - server/services/autopilotProductService.ts - Round-robin 
  product selection                                          
  - server/services/autopilotScriptGenerator.ts - AI script  
  generation                                                 
  - server/services/autopilotAudioPreparer.ts - TTS audio    
  preparation                                                
  - server/services/autopilotVideoService.ts - Video         
  generation orchestration                                   
  - server/services/autopilotSchedulerService.ts - Scheduling
   logic                                                     
  - scripts/cron-autopilot-generator.ts - Hourly cron job    
                                                             
  Remotion Scenes:                                           
  - my-video/src/scenes/ProblemScene.tsx                     
  - my-video/src/scenes/RevealScene.tsx                      
  - my-video/src/scenes/SocialProofScene.tsx                 
  - my-video/src/scenes/OfferScene.tsx                       
  - my-video/src/compositions/AutopilotComposition.tsx       
                                                             
  Schema & Routes:                                           
  - shared/schema.ts - Added 4 autopilot tables              
  - server/routes.ts - Added 12 autopilot API endpoints      
                                                             
  Builds Verified:                                           
                                                             
  - Main server build: ✓ (npm run build)                     
  - Remotion bundle: ✓ (my-video/npm run build)              
                                                             
  ---                                                        
  Railway Deployment Steps:                                  
                                                             
  1. Push to Git - This triggers Railway auto-deploy         
  2. Run Database Migration - After deploy completes, run in 
  Railway shell:                                             
  npm run db:push                                            
  3. Set Up Cron Job - For autopilot scheduler, add Railway  
  cron service:                                              
  npx tsx scripts/cron-autopilot-generator.ts                
  3. Schedule: Every hour (0 * * * *)                        
  4. Verify Endpoints - Test the new API routes:             
    - POST /api/autopilot/stores/scrape                      
    - GET /api/autopilot/stores/:storeId/products            
    - POST /api/autopilot/configs                            
    - POST /api/autopilot/configs/:configId/preview          
    - POST /api/autopilot/configs/:configId/approve          
                                                             
✻ Churned for 4m 29s                                         
                                                             
❯ lets push changes and deploy to railway                    
> **Role & Mode**

> You are acting as a **senior backend engineer + AI systems designer**.

>

> This task is **alignment and reasoning only**.

> ❌ No code

> ❌ No schema migrations

> ❌ No refactors

>

> Your goal is to confirm understanding and define **how Apify Website Content Crawler output should be normalized into a video-ready product object** for Streamline Autopilot (Demo Mode).

* * * * *

**Context**
-----------

We are building **Streamline Full Autopilot**, a hands-free video content engine that generates 60--75 second product demo videos.

Originally, the MVP targeted **Shopify stores only**, but for **demo + early validation**, we are introducing a **Generic Product Page Ingestion mode** that works on **any product page URL** (e.g. WordPress / WooCommerce).

This mode:

-   Uses **Apify Website Content Crawler**

-   Accepts raw crawl output (HTML, text, metadata, OpenGraph, JSON-LD, markdown)

-   Normalizes it into a **single "product" object**

-   Feeds that object into the existing video pipeline (Remotion + TTS)

This does **not** replace Shopify ingestion --- it is a **demo / fallback ingestion path**.

* * * * *

**Apify Scraper Input & Output**
--------------------------------

We are using:

-   **Apify Website Content Crawler**

-   Browser mode enabled

-   Crawl depth: 0--1 (single page + direct product links)

You will receive objects similar to the following (example provided):

-   url

-   metadata (title, description, openGraph, jsonLd)

-   text

-   markdown

-   headers

-   crawl info

Assume **no guarantees** about structure beyond what HTML pages normally provide.

* * * * *

**Objective**
-------------

Your task is to reason about and confirm:

> **How we should interpret Apify crawl output and normalize it into a clean, video-ready product object suitable for generating a 60--75s demo video.**

* * * * *

**Locked Constraints (Do Not Change)**
--------------------------------------

-   This ingestion path is **generic** (not Shopify-specific)

-   The output must be **one product object per page**

-   Minimum requirements for a usable product:

    -   Product title

    -   Short description

    -   3--5 high-quality images

-   Price, variants, tags, reviews are **optional**

-   The result must be usable by:

    -   Script generation

    -   Remotion scene composition

    -   TTS narration

* * * * *

**What I Need From You**
------------------------

### **1\. Confirm Understanding**

Briefly restate:

-   What this ingestion mode is

-   What problem it solves

-   How it fits into Streamline Autopilot

* * * * *

### **2\. Image Extraction Strategy (Critical)**

Based on Apify output:

-   Identify **all possible image sources** (e.g. openGraph, markdown, <img> tags)

-   Define a **safe heuristic** for selecting the *best 3--5 images* for a product demo video

Please reason about:

-   Removing icons / SVGs

-   Minimum size thresholds

-   Deduplication

-   Prioritizing hero / product images

No code --- just logic.

* * * * *

### **3\. Text & Description Normalization**

Explain how to derive:

-   Product title

-   Short product description (2--3 sentences)

-   3--5 benefit bullets

From:

-   metadata.title

-   openGraph.description

-   text

-   markdown

-   Headings and paragraphs

Clarify:

-   What content should be ignored (FAQs, policies, shipping, etc.)

-   How to avoid overly long or marketing-bloated output

* * * * *

### **4\. Proposed Normalized Product Object**

Define the **conceptual shape** (not SQL, not TS types) of the final object, for example:

-   title

-   description

-   benefits[]

-   images[]

-   source_url

-   data_quality flag

Explain what is **required vs optional**.

* * * * *

### **5\. Failure & Edge Cases**

Reason about:

-   Pages with too many images

-   Pages with very little text

-   Pages that are category pages, not products

-   Pages that mix multiple products

Describe:

-   How to detect these cases

-   When to fail vs warn vs proceed

* * * * *

### **6\. How This Feeds the Video Pipeline**

Explain how the normalized product object supports:

-   Hook

-   Problem

-   Feature showcase

-   Social proof (optional)

-   CTA

Focus on *why* this data is sufficient to produce a coherent 60--75s video.

* * * * *

### **7\. MVP Guardrails**

Explicitly list:

-   What this ingestion mode **will not** try to do

-   What we should avoid building at this stage

-   Why AI normalization is preferred over brittle parsing

* * * * *

**Output Requirements**
-----------------------

-   Use clear section headings

-   Be concise but thorough

-   No code

-   No schema changes

-   No feature expansion beyond this ingestion path

* * * * *

**Final Instruction**
---------------------

Do **not** propose implementation yet.

This response should make it obvious how to proceed safely into coding.

Once aligned, the next step will be:

> "Write the execution prompt for Generic Product Page Ingestion."    
                                                            
⏺ Generic Product Page Ingestion: Alignment & Reasoning      
                                                             
  1. Confirm Understanding                                   
                                                             
  What this ingestion mode is:                               
  A fallback/demo ingestion path that accepts any product    
  page URL (not just Shopify), crawls it using Apify Website 
  Content Crawler, and normalizes the raw HTML/metadata into 
  a structured product object suitable for video generation. 
                                                             
  What problem it solves:                                    
  - Enables demos and validation without requiring prospects 
  to have Shopify stores                                     
  - Supports WooCommerce, custom WordPress, Squarespace,     
  BigCommerce, or any ecommerce platform                     
  - Allows single-product validation before committing to    
  full store integration                                     
  - Removes the "Shopify only" friction for early adopters   
                                                             
  How it fits into Streamline Autopilot:                     
  This sits as an alternative ingestion source alongside the 
  existing Shopify /products.json scraper. Both paths output 
  the same normalized product object, which then feeds into  
  the shared pipeline: script generation → TTS → Remotion    
  rendering. The video pipeline remains unchanged—only the   
  data source differs.                                       
                                                             
  ---                                                        
  2. Image Extraction Strategy                               
                                                             
  Possible Image Sources (Priority Order)                    
                                                             
  1. OpenGraph images (og:image) — typically the hero/product
   image, high confidence                                    
  2. JSON-LD Product schema (image field) — structured data, 
  very reliable when present                                 
  3. Twitter card images (twitter:image) — usually same as   
  OG, good fallback                                          
  4. Markdown image references — extracted from page content,
   variable quality                                          
  5. Raw <img> tags from HTML — highest volume, lowest       
  signal-to-noise ratio                                      
                                                             
  Selection Heuristic                                        
                                                             
  Step 1: Collect all candidate images                       
  - Extract from OG, JSON-LD, Twitter cards first (high      
  confidence)                                                
  - Parse markdown for ![](url) patterns                     
  - If still under 5 images, consider <img> tags from main   
  content area                                               
                                                             
  Step 2: Filter out non-product images                      
  - Remove by extension/pattern: .svg, .gif, icon, logo,     
  badge, payment, trust, shipping                            
  - Remove by path patterns: /assets/, /icons/, /ui/,        
  /static/, sprite, placeholder                              
  - Remove by dimension: Images under 300x300px (if          
  dimensions available) — these are typically thumbnails or  
  icons                                                      
  - Remove data URIs: data:image/ — inline assets, never     
  product photos                                             
                                                             
  Step 3: Deduplicate                                        
  - Normalize URLs (remove query params like ?w=, ?size=)    
  - Hash-based or URL-based deduplication                    
  - If same image appears at multiple sizes, keep the largest
                                                             
  Step 4: Prioritize                                         
  - OG/JSON-LD images first (most likely to be the hero)     
  - Images from upper portion of page content                
  - Images with product-related alt text (contains product   
  name, "product", "view")                                   
  - Larger images over smaller ones                          
                                                             
  Step 5: Select top 3-5                                     
  - Take first 3-5 from prioritized list                     
  - If fewer than 3 images remain after filtering, flag as   
  low_image_quality                                          
                                                             
  Edge Case: Too Many Images                                 
                                                             
  If a page yields 50+ candidate images after filtering, it's
   likely a category page or gallery. In this case:          
  - Take only images from first 1000px of page content (above
   the fold)                                                 
  - Limit to images within the main product container (if    
  detectable via semantic HTML)                              
                                                             
  ---                                                        
  3. Text & Description Normalization                        
                                                             
  Deriving Product Title                                     
                                                             
  Priority order:                                            
  1. JSON-LD Product.name — most reliable when present       
  2. OpenGraph og:title — usually product name + brand       
  3. <title> tag — often includes site name, needs cleaning  
  4. First <h1> on page — typically the product name         
                                                             
  Cleaning logic:                                            
  - Strip site name suffixes (e.g., "| Store Name", "-       
  Brand")                                                    
  - Remove price from title if accidentally included         
  - Truncate to 80 characters max                            
  - If title contains "Buy", "Shop", "Order" at start, strip 
  those words                                                
                                                             
  Deriving Short Description (2-3 sentences)                 
                                                             
  Priority order:                                            
  1. JSON-LD Product.description — clean, structured         
  2. OpenGraph og:description — marketing-optimized, good    
  length                                                     
  3. First 2-3 paragraphs from main content that aren't      
  boilerplate                                                
  4. Meta description tag                                    
                                                             
  Content to ignore:                                         
  - Shipping/returns information ("Free shipping", "30-day   
  returns")                                                  
  - Legal/policy text ("Terms apply", "See details")         
  - Navigation breadcrumbs                                   
  - Price/availability statements                            
  - Customer service info                                    
  - Social share prompts                                     
  - "Add to cart" adjacent text                              
                                                             
  Length guardrails:                                         
  - Target: 150-300 characters                               
  - If source is too long, take first 2 complete sentences   
  - If source is too short (<50 chars), flag as              
  low_text_quality                                           
                                                             
  Deriving 3-5 Benefit Bullets                               
                                                             
  Extraction approach:                                       
  1. Look for existing bullet lists (<ul>, <li>) in product  
  description area                                           
  2. Look for "Features:", "Benefits:", "Why choose" sections
  3. Extract from markdown lists                             
  4. If no structured lists, extract key phrases from        
  description paragraphs                                     
                                                             
  What makes a good benefit bullet:                          
  - Starts with action verb or describes outcome ("Reduces", 
  "Improves", "Made from")                                   
  - Contains specific claims (materials, measurements,       
  capabilities)                                              
  - Under 100 characters                                     
  - Not a shipping/policy statement                          
                                                             
  Fallback if no bullets found:                              
  - Use AI summarization to extract 3-5 key selling points   
  from the description                                       
  - Flag as ai_generated_benefits: true                      
                                                             
  ---                                                        
  4. Proposed Normalized Product Object                      
                                                             
  NormalizedProduct {                                        
    // Required                                              
    title: string                    // Product name, cleaned
    description: string              // 2-3 sentence summary 
    images: string[]                 // 3-5 image URLs,      
  ordered by relevance                                       
    source_url: string               // Original crawled URL 
                                                             
    // Required for video (but can be AI-generated)          
    benefits: string[]               // 3-5 benefit bullets  
                                                             
    // Optional                                              
    price: string | null             // Formatted price if   
  found                                                      
    original_price: string | null    // For discount display 
    brand: string | null             // Brand name if        
  extractable                                                
    category: string | null          // Product category     
                                                             
    // Metadata                                              
    data_quality: 'high' | 'medium' | 'low'                  
    quality_flags: string[]          // e.g.,                
  ['low_image_count', 'ai_generated_benefits']               
    extraction_source: {                                     
      title_from: 'jsonld' | 'og' | 'title_tag' | 'h1'       
      description_from: 'jsonld' | 'og' | 'meta' | 'content' 
      image_count_raw: number        // Before filtering     
      image_count_final: number      // After filtering      
    }                                                        
    crawled_at: timestamp                                    
  }                                                          
                                                             
  Required vs Optional:                                      
  Field: title                                               
  Required: Yes                                              
  Reason: Needed for hook, reveal, CTA                       
  ────────────────────────────────────────                   
  Field: description                                         
  Required: Yes                                              
  Reason: Needed for problem/reveal narration                
  ────────────────────────────────────────                   
  Field: images                                              
  Required: Yes (min 3)                                      
  Reason: Needed for visual scenes                           
  ────────────────────────────────────────                   
  Field: benefits                                            
  Required: Yes (min 3)                                      
  Reason: Needed for features scene                          
  ────────────────────────────────────────                   
  Field: source_url                                          
  Required: Yes                                              
  Reason: Attribution, debugging                             
  ────────────────────────────────────────                   
  Field: price                                               
  Required: No                                               
  Reason: Nice for offer scene, not critical                 
  ────────────────────────────────────────                   
  Field: data_quality                                        
  Required: Yes                                              
  Reason: Determines if product is video-ready               
  ---                                                        
  5. Failure & Edge Cases                                    
                                                             
  Too Many Images (50+)                                      
                                                             
  - Detection: Raw image count > 50 after initial collection 
  - Likely cause: Category page, image gallery, or homepage  
  - Action: Warn, apply aggressive filtering, proceed if 3+  
  images remain after filtering. If still >20 after          
  filtering, fail with "Page appears to be a category or     
  gallery page"                                              
                                                             
  Very Little Text (<100 characters total)                   
                                                             
  - Detection: Combined description + content < 100 chars    
  - Likely cause: Image-only page, coming soon page, or      
  JavaScript-rendered content not captured                   
  - Action: Fail with "Insufficient text content to generate 
  video script"                                              
                                                             
  Category Page (Multiple Products)                          
                                                             
  - Detection signals:                                       
    - Multiple JSON-LD Product objects                       
    - Multiple distinct price points                         
    - Repeated product-like structures in HTML               
    - URL contains /category/, /collection/, /shop/          
    - Title contains "Shop all", "Browse", "Collection"      
  - Action: Fail with "Page appears to contain multiple      
  products. Please provide a single product URL"             
                                                             
  Mixed/Ambiguous Pages                                      
                                                             
  - Detection: Moderate image count (10-30), multiple H2s    
  with product-like names                                    
  - Action: Proceed with warning, extract from first/primary 
  product block only, flag data_quality: 'low'               
                                                             
  Decision Matrix                                            
  Condition: < 3 images after filtering                      
  Action: Fail                                               
  ────────────────────────────────────────                   
  Condition: < 100 chars description                         
  Action: Fail                                               
  ────────────────────────────────────────                   
  Condition: Multiple JSON-LD Products                       
  Action: Fail                                               
  ────────────────────────────────────────                   
  Condition: 3-4 images, good text                           
  Action: Proceed, quality: medium                           
  ────────────────────────────────────────                   
  Condition: 5+ images, good text, structured data           
  Action: Proceed, quality: high                             
  ────────────────────────────────────────                   
  Condition: AI-generated benefits needed                    
  Action: Proceed, flag in metadata                          
  ---                                                        
  6. How This Feeds the Video Pipeline                       
                                                             
  The 8-scene autopilot video structure requires:            
  Scene: Hook (3-5s)                                         
  Data Required: Bold claim, hero image                      
  Source from Normalized Object: title, images[0], derived   
    hook text                                                
  ────────────────────────────────────────                   
  Scene: Problem (8-10s)                                     
  Data Required: Pain point narration                        
  Source from Normalized Object: AI-generated from           
  description                                                
     + category                                              
  ────────────────────────────────────────                   
  Scene: Reveal (8-12s)                                      
  Data Required: Product intro, hero image                   
  Source from Normalized Object: title, images[0],           
  description                                                
  ────────────────────────────────────────                   
  Scene: Features (12-15s)                                   
  Data Required: 3-4 benefits with visuals                   
  Source from Normalized Object: benefits[], images[1-3]     
  ────────────────────────────────────────                   
  Scene: Social Proof (8-10s)                                
  Data Required: Testimonial/stat                            
  Source from Normalized Object: AI-generated or skipped if  
  no                                                         
     data                                                    
  ────────────────────────────────────────                   
  Scene: Avatar (0-10s)                                      
  Data Required: Optional                                    
  Source from Normalized Object: Skipped in MVP              
  ────────────────────────────────────────                   
  Scene: Offer (5-8s)                                        
  Data Required: Price display                               
  Source from Normalized Object: price, original_price,      
    images[0]                                                
  ────────────────────────────────────────                   
  Scene: CTA (5-8s)                                          
  Data Required: Call to action                              
  Source from Normalized Object: title, source_url, brand    
  logo                                                       
     if available                                            
  Why this data is sufficient:                               
                                                             
  1. Title → Used in reveal ("Introducing {title}"), CTA     
  ("Get {title} today")                                      
  2. Description → AI script generator uses this to craft    
  problem/reveal narration                                   
  3. Benefits → Direct mapping to features scene, one benefit
   per visual beat                                           
  4. Images → Distributed across scenes for visual variety   
  5. Price → Optional but enables offer scene; if missing,   
  offer scene uses "Check price" CTA                         
  6. Source URL → Displayed in CTA for attribution           
                                                             
  The script generator already handles sparse inputs by      
  generating contextually appropriate filler. A data_quality:
   'medium' product can still produce a coherent video—it    
  just won't be as targeted.                                 
                                                             
  ---                                                        
  7. MVP Guardrails                                          
                                                             
  What This Ingestion Mode Will NOT Do                       
                                                             
  - Multi-product extraction: One URL = one product. No      
  catalog crawling.                                          
  - Variant handling: No color/size variants. Single         
  canonical product.                                         
  - Review aggregation: Not scraping reviews, ratings, or    
  testimonials.                                              
  - Price tracking: No historical price data or discount     
  calculation.                                               
  - Inventory/availability: Not checking stock status.       
  - Competitor comparison: Not cross-referencing other sites.
  - Deep crawling: Max depth 0-1. Not following internal     
  links beyond immediate product page.                       
                                                             
  What to Avoid Building at This Stage                       
                                                             
  - Custom parsers for specific platforms (WooCommerce,      
  Squarespace, etc.)                                         
  - Visual/screenshot-based extraction                       
  - Headless browser orchestration beyond what Apify provides
  - Manual field mapping UI for users to "fix" extractions   
  - Bulk URL import (single URL at a time for demo mode)     
                                                             
  Why AI Normalization Over Brittle Parsing                  
                                                             
  1. HTML variance is infinite: Every theme, every platform, 
  every customization changes the DOM                        
  2. Semantic understanding: AI can recognize "Free shipping 
  over $50" is not a product benefit                         
  3. Graceful degradation: AI produces something usable even 
  with messy input                                           
  4. Maintenance cost: Rule-based parsers require constant   
  updates; AI adapts                                         
  5. Demo mode tolerance: For demos, "pretty good" extraction
   is acceptable—we're not running production campaigns      
                                                             
  The AI normalization step (likely a single GPT-4 call with 
  structured output) takes the raw Apify data and produces   
  the clean NormalizedProduct. This is intentionally a black 
  box that handles edge cases without us enumerating every   
  one.                                                       
                                                             
  ---                                                        
  Summary                                                    
                                                             
  This design enables:                                       
  - Any product URL → clean product object → video-ready     
  input                                                      
  - Graceful failure with clear error messages for           
  non-product pages                                          
  - Quality flags so downstream systems know what they're    
  working with                                               
  - AI-assisted normalization to avoid brittle per-platform  
  parsing                                                    
                                                             
  Ready for the execution prompt when you are.               
                                                             
✻ Cooked for 1m 12s                                          
                                                                                                  