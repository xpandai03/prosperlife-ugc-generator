Here's your ready-to-paste Markdown file for Claude.

It's written as an internal build specification --- clear, complete, and formatted for Claude to understand context, problems, and implementation scope.

* * * * *

```
# 📘 Phase 4.7 --- UGC Ad Studio Redesign & Video Generation Fix
**Date:** Nov 2025
**Owner:** Streamline AI Dev Team

---

## 🎯 Objective
Simplify the user experience for **UGC Ad creation** while fixing the **stuck Veo3 video generation** issue.
Goal: Let users upload a product photo and automatically generate **UGC-style images and videos** using pre-set AI prompt templates.

---

## 🧱 Current System Summary

- **Image generation (`kie-4o-image`)** → ✅ Works perfectly (visible in gallery)
- **Video generation (`kie-veo3`)** → ⚠️ Stuck in `processing` (no result URLs saved)
- **Polling loop** → Works for images, not for Veo3 (never detects `SUCCESS`)
- **Frontend (AI Studio page)** → UI too complex; needs redesign for simple "Create Ad" flow

---

## ⚠️ Problem Breakdown

### 1. Video Generation (Backend Issue)
- Endpoint: `/api/ai/media/use-for-video`
- Behavior: Starts KIE Veo3 task but `processMediaGeneration()` never resolves.
- Logs show:
  ```json
  status: "PROCESSING"
  [KIE FIX ✅] Extracted resultUrls: []
```

-   Veo3 responses don't follow the same structure as image jobs:

    -   Images: response.resultUrls[0]

    -   Videos: data.resultJson.resultUrls[0] or data.resources[0].url

### **2\. User Flow / Frontend UX**

-   Current form exposes unnecessary details (model names, captions, etc.).

-   Need to streamline the creation flow --- "one brief, one click."

* * * * *

**🧾 Desired User Inputs (Simplified UGC Brief)**
-------------------------------------------------

|

**Field**

 |

**Type**

 |

**Example**

 |

**Notes**

 |
| --- | --- | --- | --- |
|

**Product Image**

 |

Upload / URL

 |

https://.../creatine.jpg

 |

Required

 |
|

**Product Name**

 |

Text

 |

"Creatine Gummies"

 |

Required

 |
|

**Features**

 |

Textarea

 |

"Tasty, easy daily use, boosts energy"

 |

Required

 |
|

**Customer Persona (ICP)**

 |

Dropdown

 |

"Gym-goer", "Beauty enthusiast"

 |

Optional

 |
|

**Scene / Setting**

 |

Dropdown

 |

"Car", "Kitchen", "Gym", "Outdoors"

 |

Optional

 |
|

*(Hidden)* Mode

 |

Enum

 |

Default → "NanoBanana + Veo3"

 |

Optional override

 |

Everything else --- prompt generation, chaining, and posting --- is automatic.

* * * * *

**🧠 Prompt Orchestration Logic**
---------------------------------

-   Prompt source: /client/prompts/veo-3-prompts.md

-   Use placeholders:

```
{product}, {feature}, {icp}, {scene}
```

-   Select prompt template based on **mode**:

    -   **Mode A (default)** → NanoBanana → Veo3

    -   **Mode B** → Veo3 only (direct from product image)

    -   **Mode C** → Sora2 (budget / fallback)

* * * * *

**🛠️ Backend Work Required**
-----------------------------

### **1\. Fix Veo3 Polling**

-   Update processMediaGeneration() logic:

    -   Detect status === "SUCCESS" or state === "success".

    -   Check these possible URL paths:

        -   data.resultJson.resultUrls[0]

        -   data.resources[0].url

        -   response.resultUrls[0]

    -   Save the first valid result URL to DB.

-   Add 30-minute timeout → mark asset failed.

-   Add [KIE Veo3 ✅] and [KIE Veo3 ❌] logs for debugging.

### **2\. Add Retry Endpoint**

-   Endpoint: POST /api/ai/media/retry/:id

    -   Requeues failed job using the same parameters.

    -   Returns { success: true, newTaskId }.

    -   Visible in gallery (Retry button).

### **3\. Enhance Error Handling**

-   Update DB schema: Add error_message field to media_assets.

-   Record failed KIE job responses.

* * * * *

**🎨 Frontend Redesign Plan**
-----------------------------

### **Page: **

### **/ai-studio**

**Section 1 --- Create Ad (Brief Form)**

-   Simplified input panel with:

    -   Image upload field

    -   Product name

    -   Features textarea

    -   Persona dropdown

    -   Scene dropdown

-   Hidden "Mode" selector (defaults to NanoBanana + Veo3)

-   Button: ✨ Create UGC Ad

-   On submit:

    -   Sends data to /api/ai/generate-media

    -   Auto-fills prompt using veo-3-prompts.md

    -   Triggers chained image → video workflow

**Section 2 --- Your UGC Ads (Gallery)**

-   Each card shows:

    -   Thumbnail (image or video preview)

    -   Status badge → Processing, Ready, Failed

    -   Buttons:

        -   ▶️ Preview

        -   🔁 Retry (if failed)

        -   📥 Download

        -   📤 Post to Instagram (Late.dev)

-   Modal preview (UGCAdPreviewModal):

    -   Embed mediaUrl (img/video)

    -   Shows generation metadata (model, status, date)

* * * * *

**🧪 Testing Plan**
-------------------

### **Backend Tests**

-   ✅ Start a Veo3 generation job and confirm:

    -   Status changes to ready

    -   result_url saved in DB

-   ❌ Simulate timeout → ensure job marked as failed

-   ✅ Retry endpoint → new task created

-   ✅ Polling stops after URL found or 30 min timeout

### **Frontend Tests**

-   ✅ "Create Ad" brief submits successfully

-   ✅ Image and video previews appear in gallery

-   ✅ Retry button re-triggers generation

-   ✅ Post button triggers Late.dev call

-   ✅ Mobile layout tested for /ai-studio

* * * * *

**🧩 Deliverables for Claude**
------------------------------

Claude must:

1.  Refactor /api/ai/media/use-for-video logic (Veo3 fix)

2.  Patch processMediaGeneration() for Veo3 success/timeout logic

3.  Add /api/ai/media/retry/:id

4.  Redesign /ai-studio with simplified inputs and mode pre-selection

5.  Integrate dynamic prompt injection using /client/prompts/veo-3-prompts.md

6.  Update gallery to show Retry + Post buttons

7.  Ensure videos display in modal previews

8.  Write small helper: generatePrompt(mode, inputs) → returns final text

* * * * *

**✅ Success Criteria**
----------------------

-   🟢 New images and videos appear correctly in the gallery

-   🟢 No infinite polling for Veo3 video generation

-   🟢 Retry endpoint working

-   🟢 User can generate ad with 5 inputs only

-   🟢 UI feels like: *Upload → Generate → View → Post*

* * * * *

**📋 Expected Output from Claude**
----------------------------------

Claude should produce:

1.  A **phased implementation plan**

2.  File-by-file code changes

3.  Updated endpoint specifications

4.  Example prompts with injected variables

5.  Step-by-step testing checklist

* * * * *

```
---

Once you feed this file to Claude, pair it with this short system prompt:

> "Read `Phase4.7-UGC-AdStudio-Redesign.md`. Understand all required changes. Then produce a structured phased implementation plan that addresses both the frontend UX redesign and the KIE Veo3 video generation fix, using the latest working app code."

Would you like me to also draft that Claude system prompt for you (so you can paste both together cleanly)?
```

 Your plan should include:

-   > **Phase breakdowns** (e.g., UI simplification, backend orchestration, model
 mode presets, UX polish, testing/deployment).

-   > **Implementation objectives per phase**, explaining what needs to be built 
or modified and why.

-   > **Integration points** (where frontend → backend → n8n workflow → KIE API 
interact).

-   > **Developer notes** on how to keep the system modular and maintainable.

-   > **Success criteria** for each phase (functional, UX, and technical).

>

> The output should be a **clear, technical, implementation-ready plan** that we 
can execute sequentially within the current repo structure. 

⏺ I'll analyze the UGC redesign documentation, transcript, and N8N workflow to
  create a comprehensive implementation plan. Let me gather all the necessary
  information first.

⏺ Plan(Analyze UGC redesign docs and N8N workflow)
  ⎿  Done (4 tool uses · 48.4k tokens · 1m 34s)                                 

⏺ Based on my comprehensive analysis of the UGC redesign documentation, YouTube
  transcript, and N8N workflow, I'll now present a detailed phased implementation
   plan.

─────────────────────────────────────────────────────────────────────────────────────
 Ready to code?

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 UGC Ad Studio Redesign - Phased Implementation Plan

 Overview

 Transform the UGC Ad Studio from a complex technical interface into a streamlined
 "Upload → Generate → Post" workflow using preset prompts, automated chaining
 (NanoBanana + Veo3), and robust error handling.

 ---
 PHASE 1: Backend Stabilization & Core Fixes (Week 1)

 Goal: Fix critical Veo3 polling issues and add timeout/retry infrastructure

 1.1 Fix Veo3 URL Extraction

 - Update server/services/kie.ts checkStatus() to handle ALL response paths:
   - data.response.resultUrls[0] (primary Veo3 path)
   - JSON.parse(data.resultJson).resultUrls[0] (alternate)
   - data.resources[0].url (fallback)
 - Add state detection: state === "SUCCESS" OR successFlag === 1

 1.2 Add Timeout Mechanism

 - Modify server/routes.ts processMediaGeneration():
   - Max polling duration: 30 minutes
   - After timeout, update DB: status = 'error', errorMessage = "Timeout after 
 30min"
   - Add cleanup logic to prevent orphaned polling

 1.3 Database Schema Updates

 ALTER TABLE media_assets
 ADD COLUMN generation_mode VARCHAR(50),  -- "nanobana+veo3", "veo3-only", "sora2"
 ADD COLUMN chain_metadata JSONB;         -- Store intermediate results

 Success Criteria

 - ✅ Veo3 videos complete and display in gallery
 - ✅ Failed jobs show error message within 30 minutes
 - ✅ Zero infinite polling loops
 - ✅ All 3 KIE response formats handled correctly

 ---
 PHASE 2: Retry System (Week 1-2)

 Goal: Let users retry failed generations without re-uploading

 2.1 Backend Retry Endpoint

 POST /api/ai/media/retry/:id
 // Re-submits failed job with same params
 // Increments retry_count, clears error_message

 2.2 Frontend Retry Button

 - Add to MediaPreviewCard.tsx:
   - Show "🔁 Retry" button when status === 'error'
   - Disable after 3 retry attempts
 - Update UGCAdPreviewModal.tsx:
   - Show retry button with error details

 Success Criteria

 - ✅ Failed videos can be retried with one click
 - ✅ Retry preserves original prompt/settings
 - ✅ Max 3 retry attempts enforced
 - ✅ UI shows retry count (e.g., "Attempt 2/3")

 ---
 PHASE 3: Prompt Template System (Week 2)

 Goal: Build preset prompt infrastructure with variable injection

 3.1 Create Prompt Templates

 - File: server/prompts/ugc-presets.ts
 export const PRESET_PROMPTS = {
   imagePrompt: {
     systemRole: "Hyper-realistic UGC photography creator",
     template: "Create realistic selfie-style photo: person holding {product} in 
 {scene}. Features: {features}. Style: natural lighting, authentic, casual..."
   },
   videoPromptVeo3: {
     systemRole: "Expert UGC video creator",
     template: "8-second selfie video: {icp} showing {product} in {scene}. Dialogue:
  casual 1-2 sentences about {features}..."
   },
   videoPromptSora: { /* similar structure */ }
 }

 3.2 Variable Injection Helper

 function injectVariables(template: string, vars: {
   product: string;
   features: string;
   icp: string;
   scene: string;
 }): string {
   return template
     .replace(/{product}/g, vars.product)
     .replace(/{features}/g, vars.features)
     .replace(/{icp}/g, vars.icp)
     .replace(/{scene}/g, vars.scene);
 }

 3.3 Mode Selection Logic

 enum GenerationMode {
   MODE_A = "nanobana+veo3",  // Default: Best quality
   MODE_B = "veo3-only",       // Faster, lower quality
   MODE_C = "sora2"            // Cheaper fallback
 }

 Success Criteria

 - ✅ Templates defined for all 3 modes
 - ✅ Variable injection tested with sample inputs
 - ✅ String sanitization (remove newlines, quotes)
 - ✅ Prompts match N8N workflow quality

 ---
 PHASE 4: Frontend Redesign - Simplified Form (Week 2-3)

 Goal: Replace complex form with 5-field product brief

 4.1 New Form Schema

 interface UGCBriefForm {
   productImage: File | string;      // Upload or URL
   productName: string;               // Required, max 100 chars
   productFeatures: string;           // Required, textarea, max 500 chars
   customerPersona: string;           // Optional dropdown
   videoSetting: string;              // Optional dropdown
 }

 4.2 Dropdown Options

 const PERSONAS = [
   "Gym-goer", "Beauty enthusiast", "Busy professional",
   "Health-conscious parent", "Fitness influencer"
 ];

 const SCENES = [
   "Car (commute/travel)", "Kitchen (cooking)",
   "Gym (workout)", "Bedroom (morning routine)",
   "Outdoors (park/beach)"
 ];

 4.3 UI Layout (Replace Current Form)

 ┌─────────────────────────────────────┐
 │  Upload Product Photo               │
 │  [📷 Upload or paste URL]           │
 ├─────────────────────────────────────┤
 │  Product Name                       │
 │  [e.g., "Creatine Gummies"]         │
 ├─────────────────────────────────────┤
 │  Product Features                   │
 │  [Tasty, boosts energy, easy...]    │
 ├─────────────────────────────────────┤
 │  Customer (optional)                │
 │  [Dropdown: Gym-goer ▼]             │
 ├─────────────────────────────────────┤
 │  Scene (optional)                   │
 │  [Dropdown: Kitchen ▼]              │
 ├─────────────────────────────────────┤
 │  [🎬 Generate UGC Ad]               │
 └─────────────────────────────────────┘

 4.4 Remove/Hide Fields

 - ❌ Remove: Model provider selector
 - ❌ Remove: Caption input (auto-generated)
 - ❌ Remove: "Type" selector (always video workflow)
 - ✅ Keep: Reference image URL (optional)

 Success Criteria

 - ✅ Form has exactly 5 fields
 - ✅ Submission takes <10 seconds (user POV)
 - ✅ No technical jargon visible
 - ✅ Mobile-responsive layout

 ---
 PHASE 5: NanoBanana + Veo3 Chaining (Week 3-4)

 Goal: Implement Mode A workflow (enhanced image → video)

 5.1 Chain Orchestration Endpoint

 POST /api/ai/generate-ugc-chain
 Body: { productImage, productName, features, persona, scene }

 Workflow:
 1. Generate NanoBanana image prompt (AI agent)
 2. Submit to KIE NanoBanana API → get taskId
 3. Poll until image ready → save to media_assets
 4. Analyze image with OpenAI Vision
 5. Generate Veo3 video prompt (AI agent + image analysis)
 6. Submit to KIE Veo3 API → get taskId
 7. Poll until video ready → save to media_assets
 8. Return final video URL

 5.2 AI Agent Integration (OpenAI)

 // Step 1: Image Prompt Agent
 const imagePrompt = await openai.chat.completions.create({
   model: "gpt-4o-mini",
   messages: [
     { role: "system", content: PRESET_PROMPTS.imagePrompt.systemRole },
     { role: "user", content: injectVariables(template, vars) }
   ]
 });

 // Step 4: Image Analysis
 const analysis = await openai.chat.completions.create({
   model: "gpt-4o",
   messages: [{
     role: "user",
     content: [
       { type: "text", text: "Describe this person and scene" },
       { type: "image_url", image_url: { url: nanoImageUrl } }
     ]
   }]
 });

 // Step 5: Video Prompt Agent
 const videoPrompt = await openai.chat.completions.create({
   // Include: brief + image analysis + preset template
 });

 5.3 Chain State Tracking

 // Update media_assets for intermediate steps
 {
   id: "ugc-chain-123",
   type: "video",
   status: "processing",
   generation_mode: "nanobana+veo3",
   chain_metadata: {
     step: "analyzing_image",  // "generating_image" | "analyzing_image" | 
 "generating_video"
     nanoImageUrl: "https://...",
     imageAnalysis: "Person in gym holding product..."
   }
 }

 Success Criteria

 - ✅ NanoBanana image generates in ~15 seconds
 - ✅ Image analysis completes in ~5 seconds
 - ✅ Veo3 video uses enhanced image as reference
 - ✅ Total workflow completes in <3 minutes
 - ✅ Chain failures handled gracefully (retry at failed step)

 ---
 PHASE 6: Gallery & Status UI Polish (Week 4)

 Goal: Clear visual feedback for processing/ready/failed states

 6.1 Status Badges

 {status === 'processing' && (
   <Badge variant="secondary">
     <Loader2 className="animate-spin mr-1" />
     {chainMetadata?.step === 'generating_image' && "Creating Image..."}
     {chainMetadata?.step === 'analyzing_image' && "Analyzing..."}
     {chainMetadata?.step === 'generating_video' && "Creating Video..."}
   </Badge>
 )}

 {status === 'ready' && (
   <Badge variant="default">
     <CheckCircle2 className="mr-1" /> Ready
   </Badge>
 )}

 {status === 'error' && (
   <Badge variant="destructive">
     <XCircle className="mr-1" /> Failed
     {retryCount > 0 && ` (${retryCount}/3)`}
   </Badge>
 )}

 6.2 Action Buttons

 <div className="actions">
   {status === 'ready' && (
     <>
       <Button variant="ghost" onClick={preview}>▶️ Preview</Button>
       <Button variant="ghost" onClick={download}>📥 Download</Button>
       <Button variant="primary" onClick={post}>📤 Post to IG</Button>
     </>
   )}
   {status === 'error' && retryCount < 3 && (
     <Button variant="outline" onClick={retry}>🔁 Retry</Button>
   )}
 </div>

 Success Criteria

 - ✅ Processing status shows current chain step
 - ✅ Gallery auto-refreshes every 10s during processing
 - ✅ Error state shows descriptive message
 - ✅ Ready state has clear CTAs

 ---
 PHASE 7: Testing & Deployment (Week 5)

 Goal: Validate end-to-end workflow with real KIE API

 7.1 Integration Tests

 describe('UGC Chain Workflow', () => {
   it('should generate NanoBanana + Veo3 video', async () => {
     const result = await generateUGCChain({
       productImage: 'https://example.com/product.jpg',
       productName: 'Creatine Gummies',
       productFeatures: 'Tasty, boosts energy',
       customerPersona: 'Gym-goer',
       videoSetting: 'Gym'
     });

     expect(result.status).toBe('ready');
     expect(result.videoUrl).toMatch(/\.mp4$/);
   });
 });

 7.2 Error Scenario Tests

 - Timeout after 30 minutes
 - KIE API returns 500 error
 - Image generation succeeds, video fails
 - Retry after failure

 7.3 Load Testing

 - 10 concurrent video generation requests
 - Verify no polling conflicts
 - Check database connection pool limits

 Success Criteria

 - ✅ 95%+ success rate for Mode A workflow
 - ✅ Timeout mechanism works (no infinite loops)
 - ✅ Retry recovers 80%+ of failures
 - ✅ Gallery updates within 10 seconds of completion

 ---
 Integration Points Summary

 ┌─────────────┐
 │  Frontend   │  POST /api/ai/generate-ugc-chain
 │  (5-field   │  { productImage, productName, features, persona, scene }
 │   form)     │
 └──────┬──────┘
        │
        ▼
 ┌─────────────────────────────────────────┐
 │  Backend (Express)                      │
 │  1. Load preset prompt templates        │
 │  2. Inject variables                    │
 │  3. Call OpenAI (image prompt agent)    │
 │  4. Call KIE NanoBanana API             │
 │  5. Poll for image completion           │
 │  6. Analyze image (OpenAI Vision)       │
 │  7. Call OpenAI (video prompt agent)    │
 │  8. Call KIE Veo3 API                   │
 │  9. Poll for video completion           │
 │  10. Save to media_assets DB            │
 └──────┬──────────────────────────────────┘
        │
        ▼
 ┌─────────────┐
 │  NeonDB     │  Store: media_assets (chain_metadata)
 │  PostgreSQL │  Track: processing steps, retry count
 └─────────────┘

 ---
 Developer Notes

 Modularity Guidelines

 1. Prompt Templates: Keep in separate file (server/prompts/ugc-presets.ts)
 2. Chain Logic: Extract to server/services/ugcChain.ts
 3. KIE API Calls: Reuse existing server/services/kie.ts
 4. OpenAI Calls: Create server/services/openai-agents.ts

 Maintainability

 - Each chain step = separate function (testable in isolation)
 - Use TypeScript interfaces for all API responses
 - Add extensive logging: [UGC Chain] Step 2/5: Analyzing image...
 - Store raw API responses in chain_metadata for debugging

 Code Reuse

 - ✅ Keep existing MediaPreviewCard.tsx structure
 - ✅ Reuse processMediaGeneration() polling logic
 - ✅ Extend mediaAssets table (no breaking changes)
 - ❌ Don't duplicate KIE API integration

 ---
 Success Metrics

 Phase 1-2: Backend Stability
 - 0 infinite polling loops in production
 - 100% of timeouts trigger within 30 minutes
 - Retry success rate >80%

 Phase 3-4: User Experience
 - Form completion time <30 seconds (user measurement)
 - NPS score increase (measure before/after)
 - Support tickets about "stuck videos" drops to 0

 Phase 5-6: Quality & Reliability
 - Mode A (NanoBanana+Veo3) success rate >95%
 - Average generation time: 2-3 minutes
 - Video quality rated 4+ stars by users

 Phase 7: Production Readiness
 - Load test: 50 concurrent users, no failures
 - Rollback plan tested and documented
 - Monitoring dashboards live (Render logs + Sentry)

 ---
 Risks & Mitigations

 | Risk                                | Impact | Mitigation
           |
 |-------------------------------------|--------|-----------------------------------
 ----------|
 | KIE API rate limits                 | High   | Add queue system, batch requests
           |
 | OpenAI costs too high               | Medium | Cache image analyses, use
 gpt-4o-mini       |
 | Chain failures mid-process          | High   | Checkpoint system (retry from
 failed step)  |
 | NanoBanana rejects images           | Medium | Fallback to Mode B (Veo3 only)
           |
 | Polling conflicts (race conditions) | Medium | Use distributed locks (Redis) or
 task queue |

 ---
 This plan maintains backward compatibility while systematically transforming the
 UGC Ad Studio into a production-ready, user-friendly system. Each phase builds on
 the previous, with clear rollback points if issues arise.
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
