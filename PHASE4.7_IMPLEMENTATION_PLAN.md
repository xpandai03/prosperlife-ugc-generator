# 📘 PHASE 4.7 — UGC Ad Studio Redesign & Video Generation Fix

**Date:** November 7, 2025
**Owner:** Streamline AI Dev Team
**Status:** Ready for Implementation

---

## 🎯 EXECUTIVE SUMMARY

### Objective
Fix the **stuck Veo3 video generation** bug and **redesign the UGC Ad Studio** for a simplified, product-focused user experience that auto-chains image → video generation using AI prompt templates.

### Current Issues
1. **Veo3 video generation stuck in `processing`** — polling loop never detects completion
2. **No timeout handling** — jobs run indefinitely without failure detection
3. **Complex UI** — users must understand technical details (model names, providers)
4. **No retry mechanism** — failed generations cannot be restarted
5. **No prompt templates** — users write raw prompts instead of product briefs

### Solution Overview
1. **Backend**: Fix Veo3 polling logic, add 30-min timeout, implement retry endpoint
2. **Prompt Orchestration**: Integrate `veo-3-prompts.md` templates with dynamic variable injection
3. **Frontend**: Redesign to simplified "product brief" form (5 inputs max)
4. **Auto-chaining**: Image generation (NanoBanana) → Video generation (Veo3) workflow

---

## 📋 PHASE BREAKDOWN

### **Phase 1: Backend Fixes — Veo3 Polling & Timeout** (4 hours)
**Priority**: CRITICAL — Blocking issue

### **Phase 2: Retry Endpoint & Error Handling** (2 hours)
**Priority**: HIGH — User experience

### **Phase 3: Prompt Orchestration System** (3 hours)
**Priority**: HIGH — Core feature

### **Phase 4: Frontend Redesign — Simplified UGC Brief** (5 hours)
**Priority**: HIGH — User experience

### **Phase 5: Auto-Chaining — Image → Video Pipeline** (3 hours)
**Priority**: MEDIUM — Advanced feature

### **Phase 6: Testing, Validation & QA** (3 hours)
**Priority**: CRITICAL — Production readiness

**Total Estimated Time**: 20 hours

---

## 🔧 PHASE 1: BACKEND FIXES — VEO3 POLLING & TIMEOUT

### 1.1 Problem Analysis

**Current Behavior**:
```typescript
// server/routes.ts:1575 - processMediaGeneration()
while (pollAttempts < maxAttempts) {
  const statusResult = await checkMediaStatus(taskId, provider);

  // ❌ PROBLEM: KIE Veo3 returns different status structure than images
  if (statusResult.status === 'ready') { // Never true for Veo3
    break;
  }
}
```

**KIE API Response Differences**:
- **Images** (`kie-4o-image`, `kie-flux-kontext`):
  ```json
  {
    "data": {
      "successFlag": 1,
      "response": {
        "resultUrls": ["https://..."]
      }
    }
  }
  ```

- **Videos** (`kie-veo3`):
  ```json
  {
    "data": {
      "successFlag": 1,
      "state": "SUCCESS",  // ← Different field!
      "resultJson": {
        "resultUrls": ["https://..."]
      }
    }
  }
  ```

### 1.2 Files to Modify

#### **File 1: `server/services/kie.ts`**

**Changes Required**:
1. Update `checkStatus()` to detect Veo3 `state` field
2. Add Veo3-specific URL extraction paths
3. Add comprehensive logging for debugging

**Code Changes**:

```typescript
// Line 240 - Update successFlag detection
async checkStatus(taskId: string, provider: string): Promise<KIEStatusResult> {
  // ... existing code ...

  const rawData = data.data;

  // ✅ FIX: Detect status from multiple possible fields
  const successFlag = rawData.successFlag;
  const state = rawData.state; // ← Add this for Veo3

  // Map to unified status
  let status: 'processing' | 'ready' | 'failed';

  if (successFlag === 0 || state === 'PROCESSING') {
    status = 'processing';
  } else if (successFlag === 1 || state === 'SUCCESS') {
    status = 'ready';
  } else if (state === 'FAILED' || successFlag === -1) {
    status = 'failed';
  } else {
    status = 'processing'; // Default to processing
  }

  // ✅ FIX: Extract URLs with Veo3-specific paths
  let resultUrls: string[] | undefined;
  if (status === 'ready') {
    let urls: any[] =
      rawData.resultJson?.resultUrls ||           // ← Veo3 primary path
      rawData.response?.resultUrls ||             // Images primary path
      rawData.metadata?.response?.resultUrls ||
      rawData.data?.resources?.[0]?.url ? [rawData.data.resources[0].url] : [] ||
      // ... (keep existing fallbacks) ...
      [];

    resultUrls = urls.filter(Boolean);

    // Enhanced logging
    if (provider.includes('veo3')) {
      console.log('[KIE Veo3 ✅] Status check:', {
        taskId,
        state,
        successFlag,
        status,
        urlCount: resultUrls.length,
        firstUrl: resultUrls[0]?.substring(0, 50) + '...',
      });
    }
  }

  return { taskId, status, resultUrls, ... };
}
```

**Time Estimate**: 1.5 hours

---

#### **File 2: `server/routes.ts`**

**Changes Required**:
1. Add 30-minute timeout to `processMediaGeneration()`
2. Add failure detection after max polling attempts
3. Enhanced error logging

**Code Changes**:

```typescript
// Line 1575 - Update processMediaGeneration()
async function processMediaGeneration(assetId: string, params: {...}): Promise<void> {
  const maxAttempts = 60; // ✅ CHANGE: 60 * 30s = 30 minutes (was 40 = 20 min)
  const pollInterval = 30000; // 30 seconds
  const startTime = Date.now();
  const timeoutMs = 30 * 60 * 1000; // 30 minutes in ms

  // ... existing generation logic ...

  // ✅ NEW: Polling loop with timeout check
  let pollAttempts = 0;

  while (pollAttempts < maxAttempts) {
    // ✅ FIX: Check timeout first
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      console.error(`[Media Generation] ❌ TIMEOUT after ${Math.round(elapsed / 60000)} minutes`);

      await storage.updateMediaAsset(assetId, {
        status: 'error',
        errorMessage: `Generation timed out after 30 minutes. The AI provider may be experiencing delays. Please try again or contact support.`,
      });

      return; // Exit function
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
    pollAttempts++;

    const statusResult = await checkMediaStatus(taskId, params.provider);

    // ✅ FIX: Enhanced logging for Veo3
    if (params.provider.includes('veo3')) {
      console.log(`[Veo3 Polling] Attempt ${pollAttempts}/${maxAttempts}:`, {
        assetId,
        status: statusResult.status,
        hasUrls: !!statusResult.resultUrl,
        elapsed: `${Math.round(elapsed / 1000)}s`,
      });
    }

    // Update database
    await storage.updateMediaAsset(assetId, {
      status: statusResult.status,
      resultUrl: statusResult.resultUrl || undefined,
      errorMessage: statusResult.metadata?.errorMessage || undefined,
    });

    // ✅ FIX: Exit on completion OR failure
    if (statusResult.status === 'ready' || statusResult.status === 'error') {
      if (statusResult.status === 'ready') {
        console.log(`[Media Generation] ✅ Completed: ${assetId}`);
      } else {
        console.error(`[Media Generation] ❌ Failed: ${assetId}`, statusResult.metadata?.errorMessage);
      }
      return;
    }
  }

  // ✅ NEW: If we exit loop without completion, mark as failed
  console.error(`[Media Generation] ❌ Max polling attempts reached for ${assetId}`);
  await storage.updateMediaAsset(assetId, {
    status: 'error',
    errorMessage: 'Generation timed out after maximum polling attempts',
  });
}
```

**Time Estimate**: 2 hours

---

#### **File 3: `server/services/mediaGen.ts`**

**Changes Required**:
1. Update `checkMediaStatus()` to pass through KIE service enhancements
2. Add timeout metadata tracking

**Code Changes**:

```typescript
// Update checkMediaStatus() to include timeout tracking
export async function checkMediaStatus(
  taskId: string,
  provider: MediaProvider
): Promise<MediaStatusResult> {
  // ... existing provider routing ...

  if (provider.startsWith('kie-')) {
    const kieResult = await kieService.checkStatus(taskId, provider);

    return {
      status: kieResult.status,
      resultUrl: kieResult.resultUrls?.[0],
      metadata: {
        progress: kieResult.progress,
        errorMessage: kieResult.errorMessage,
        resultUrls: kieResult.resultUrls,
        checkedAt: new Date().toISOString(), // ← Add timestamp
      },
    };
  }

  // ... rest of providers ...
}
```

**Time Estimate**: 30 minutes

---

### 1.3 Validation Steps

**Test Checklist**:
- [ ] Start new Veo3 generation
- [ ] Watch Render logs for `[Veo3 Polling]` messages
- [ ] Confirm status changes from `processing` → `ready`
- [ ] Verify `result_url` saved to database
- [ ] Test timeout: manually delay KIE response, confirm 30-min timeout triggers
- [ ] Check logs show `[KIE Veo3 ✅]` or `[Media Generation] ❌ TIMEOUT`

---

## 🔄 PHASE 2: RETRY ENDPOINT & ERROR HANDLING

### 2.1 Database Schema Update

**File**: `shared/schema.ts`

**Changes Required**: Already has `errorMessage` field ✅ No migration needed.

---

### 2.2 New API Endpoint

**File**: `server/routes.ts`

**Implementation**:

```typescript
/**
 * POST /api/ai/media/retry/:id
 *
 * Retry a failed media generation job
 * Reuses original prompt and parameters
 */
app.post("/api/ai/media/retry/:id", requireAuth, async (req, res) => {
  try {
    const { id: assetId } = req.params;

    // Fetch failed asset
    const asset = await storage.getMediaAsset(assetId);

    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    if (asset.userId !== req.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (asset.status !== 'error') {
      return res.status(400).json({
        error: "Only failed generations can be retried",
        currentStatus: asset.status,
      });
    }

    console.log(`[Retry] Restarting generation for asset ${assetId}`);

    // Reset asset to processing state
    await storage.updateMediaAsset(assetId, {
      status: 'processing',
      errorMessage: null,
      retryCount: asset.retryCount + 1,
      taskId: null, // Clear old task ID
      resultUrl: null,
      updatedAt: new Date(),
    });

    // Restart background processing
    processMediaGeneration(assetId, {
      provider: asset.provider,
      type: asset.type,
      prompt: asset.prompt,
      referenceImageUrl: asset.referenceImageUrl || undefined,
      options: asset.metadata,
    }).catch((error) => {
      console.error(`[Retry] Background processing error for ${assetId}:`, error);
    });

    res.json({
      success: true,
      assetId,
      status: 'processing',
      retryCount: asset.retryCount + 1,
      message: 'Generation restarted',
    });

  } catch (error: any) {
    console.error("[Retry] Error:", error);
    res.status(500).json({
      error: "Failed to retry generation",
      details: error.message,
    });
  }
});
```

**Time Estimate**: 1.5 hours

---

### 2.3 Frontend Integration

**File**: `client/src/components/MediaPreviewCard.tsx`

**Changes Required**: Add "Retry" button for failed assets

```typescript
// Inside MediaPreviewCard component
const retryMutation = useMutation({
  mutationFn: async (assetId: string) => {
    const res = await apiRequest('POST', `/api/ai/media/retry/${assetId}`);
    return await res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/ai/media'] });
    toast({ title: 'Generation restarted!', description: 'Check gallery for progress.' });
  },
});

// In render section
{asset.status === 'error' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => retryMutation.mutate(asset.id)}
    disabled={retryMutation.isPending}
  >
    {retryMutation.isPending ? 'Retrying...' : '🔁 Retry'}
  </Button>
)}
```

**Time Estimate**: 30 minutes

---

## 🧠 PHASE 3: PROMPT ORCHESTRATION SYSTEM

### 3.1 Prompt Template Storage

**New File**: `server/utils/promptTemplates.ts`

```typescript
/**
 * AI Prompt Templates for UGC Ad Generation
 * Based on veo-3-prompts.md specifications
 */

export interface UGCBrief {
  productName: string;
  productImageUrl: string;
  features: string; // Comma-separated or paragraph
  icp?: string; // Ideal Customer Persona
  scene?: string; // Setting/environment
}

export type GenerationMode = 'nanobanana-veo3' | 'veo3-only' | 'sora2-fallback';

/**
 * Generate NanoBanana (image) prompt from UGC brief
 */
export function generateImagePrompt(brief: UGCBrief): string {
  const { productName, features, icp, scene } = brief;

  const persona = icp || 'a young influencer';
  const setting = scene || 'a bright, modern indoor space';

  return `
A hyper-realistic selfie-style photo of ${persona} holding ${productName} prominently in the foreground.
The subject smiles naturally at the camera with genuine eye contact, showing authentic enthusiasm.
The product is held at a slight angle toward the camera, clearly visible with all branding intact (DO NOT modify the product).

Setting: ${setting} with natural lighting (daylight or golden hour).

The photo should feel authentic and spontaneous - include subtle imperfections like stray hairs, casual attire, and natural posture.
Sharp focus on both the human and product with shallow depth of field.
NO visible phones, selfie sticks, or camera reflections.

Style: Real user-generated content, not a studio shot. The subject represents someone who loves ${features}.
`.trim();
}

/**
 * Generate Veo3 (video) prompt from UGC brief + image reference
 */
export function generateVideoPrompt(brief: UGCBrief, imageUrl: string): string {
  const { productName, features, icp, scene } = brief;

  const persona = icp || 'a young woman';
  const setting = scene || 'her kitchen';

  // Extract first feature for script
  const primaryFeature = features.split(',')[0].trim();

  return `
A natural, handheld selfie-style vertical (9:16) video filmed by ${persona} in ${setting}, holding ${productName} in one hand and her iPhone in the other.

She looks directly into the camera, smiling casually in soft natural light. The background is cozy and well-lit with gentle camera movement from her arm. The video matches the provided reference image exactly in product appearance, logo, and color.

Script (8 seconds):
"I've been using this for a week now, and honestly ${primaryFeature} has completely changed my routine. Like, I didn't expect it to work this well!"

Her tone is light, genuine, and conversational - she smiles mid-sentence and glances briefly at the product before looking back at the camera.

Technical specs:
- Duration: 8 seconds
- Product and face clearly visible
- NO phone or reflections in shot
- Natural lighting and soft ambient background sound
- Handheld with subtle camera shake for authenticity

Reference image: ${imageUrl}
`.trim();
}

/**
 * Generate Sora2 (fallback video) prompt
 */
export function generateSora2Prompt(brief: UGCBrief, imageUrl: string): string {
  // Similar to Veo3 but 10 seconds
  const basePrompt = generateVideoPrompt(brief, imageUrl);
  return basePrompt.replace('8 seconds', '10 seconds').replace('Duration: 8', 'Duration: 10');
}

/**
 * Main orchestrator: Select and generate prompt based on mode
 */
export function generatePromptForMode(
  mode: GenerationMode,
  brief: UGCBrief,
  generationType: 'image' | 'video',
  referenceImageUrl?: string
): string {
  if (generationType === 'image') {
    return generateImagePrompt(brief);
  }

  // Video generation requires reference image
  if (!referenceImageUrl) {
    throw new Error('Video generation requires a reference image URL');
  }

  if (mode === 'sora2-fallback') {
    return generateSora2Prompt(brief, referenceImageUrl);
  }

  // Default: Veo3
  return generateVideoPrompt(brief, referenceImageUrl);
}
```

**Time Estimate**: 2 hours

---

### 3.2 Backend Integration

**File**: `server/routes.ts`

**Update**: `POST /api/ai/generate-media` to accept UGC brief format

```typescript
/**
 * POST /api/ai/generate-media
 *
 * NEW: Accepts both raw prompts (legacy) and UGC briefs (Phase 4.7)
 */
app.post("/api/ai/generate-media", requireAuth, async (req, res) => {
  try {
    // NEW: Check if request is UGC brief format
    const isUGCBrief = req.body.productName && req.body.productImageUrl;

    let finalPrompt: string;
    let referenceImageUrl: string | undefined;

    if (isUGCBrief) {
      // ✅ Phase 4.7: Generate prompt from brief
      const { generatePromptForMode } = await import("./utils/promptTemplates.js");

      const brief: UGCBrief = {
        productName: req.body.productName,
        productImageUrl: req.body.productImageUrl,
        features: req.body.features,
        icp: req.body.icp,
        scene: req.body.scene,
      };

      const mode: GenerationMode = req.body.mode || 'nanobanana-veo3';
      const type: 'image' | 'video' = req.body.type || 'image';

      finalPrompt = generatePromptForMode(
        mode,
        brief,
        type,
        req.body.referenceImageUrl // For video generation
      );

      referenceImageUrl = type === 'image'
        ? brief.productImageUrl
        : req.body.referenceImageUrl;

      console.log('[UGC Brief] Generated prompt:', {
        productName: brief.productName,
        mode,
        type,
        promptLength: finalPrompt.length,
      });
    } else {
      // Legacy: Direct prompt input
      finalPrompt = req.body.prompt;
      referenceImageUrl = req.body.referenceImageUrl;
    }

    // Validation
    if (!finalPrompt || finalPrompt.length < 10) {
      return res.status(400).json({ error: "Prompt too short" });
    }

    // ... rest of generation logic (unchanged) ...

    // Store brief metadata for display
    const metadata = isUGCBrief ? {
      brief: req.body,
      generatedPrompt: finalPrompt,
    } : req.body.options || null;

    const assetId = await storage.createMediaAsset({
      // ... existing fields ...
      metadata,
    });

    // ... start background processing ...
  } catch (error: any) {
    // ... error handling ...
  }
});
```

**Time Estimate**: 1 hour

---

## 🎨 PHASE 4: FRONTEND REDESIGN — SIMPLIFIED UGC BRIEF

### 4.1 Updated AIStudioPage Component

**File**: `client/src/pages/AIStudioPage.tsx`

**Major Changes**:
1. Replace prompt textarea with product brief form
2. Add dropdowns for ICP and Scene
3. Simplify provider selection (hidden, auto-selected)
4. Add "Create Image" and "Create Video" buttons

**New Form Structure**:

```typescript
// State management
const [brief, setBrief] = useState<UGCBrief>({
  productName: '',
  productImageUrl: '',
  features: '',
  icp: 'young-professional',
  scene: 'kitchen',
});

const [mode, setMode] = useState<GenerationMode>('nanobanana-veo3');

// Form JSX
<form onSubmit={handleGenerateImage} className="space-y-6">
  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
    <Sparkles className="w-5 h-5" />
    Create UGC Ad
  </h2>

  {/* Product Image Upload */}
  <div>
    <Label htmlFor="productImage" className="text-white/90">
      Product Image *
    </Label>
    <Input
      id="productImage"
      type="url"
      placeholder="https://example.com/product.jpg"
      value={brief.productImageUrl}
      onChange={(e) => setBrief({ ...brief, productImageUrl: e.target.value })}
      className="bg-white/10 border-white/20 text-white"
      required
    />
    <p className="text-xs text-white/50 mt-1">
      Upload your product photo (or paste URL)
    </p>
  </div>

  {/* Product Name */}
  <div>
    <Label htmlFor="productName" className="text-white/90">
      Product Name *
    </Label>
    <Input
      id="productName"
      placeholder="e.g., Creatine Gummies"
      value={brief.productName}
      onChange={(e) => setBrief({ ...brief, productName: e.target.value })}
      className="bg-white/10 border-white/20 text-white"
      required
    />
  </div>

  {/* Features */}
  <div>
    <Label htmlFor="features" className="text-white/90">
      Key Features *
    </Label>
    <Textarea
      id="features"
      placeholder="Tasty, easy daily use, boosts energy and focus"
      value={brief.features}
      onChange={(e) => setBrief({ ...brief, features: e.target.value })}
      className="bg-white/10 border-white/20 text-white min-h-[80px]"
      required
    />
  </div>

  {/* ICP Dropdown */}
  <div>
    <Label htmlFor="icp" className="text-white/90">
      Target Customer (Optional)
    </Label>
    <Select value={brief.icp} onValueChange={(val) => setBrief({ ...brief, icp: val })}>
      <SelectTrigger className="bg-white/10 border-white/20 text-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="gym-goer">Gym-goer (Fitness enthusiast)</SelectItem>
        <SelectItem value="young-professional">Young Professional</SelectItem>
        <SelectItem value="beauty-enthusiast">Beauty Enthusiast</SelectItem>
        <SelectItem value="parent">Parent (Busy mom/dad)</SelectItem>
        <SelectItem value="student">College Student</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Scene Dropdown */}
  <div>
    <Label htmlFor="scene" className="text-white/90">
      Scene / Setting (Optional)
    </Label>
    <Select value={brief.scene} onValueChange={(val) => setBrief({ ...brief, scene: val })}>
      <SelectTrigger className="bg-white/10 border-white/20 text-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="kitchen">Kitchen</SelectItem>
        <SelectItem value="car">Car (driving/parked)</SelectItem>
        <SelectItem value="gym">Gym / Workout Space</SelectItem>
        <SelectItem value="bedroom">Bedroom</SelectItem>
        <SelectItem value="office">Office / Workspace</SelectItem>
        <SelectItem value="outdoors">Outdoors (park, street)</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Action Buttons */}
  <div className="flex gap-4 pt-4">
    <Button
      type="submit"
      disabled={generateImageMutation.isPending}
      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600"
    >
      {generateImageMutation.isPending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <ImageIcon className="w-4 h-4 mr-2" />
          Create Image
        </>
      )}
    </Button>

    <Button
      type="button"
      onClick={handleGenerateVideo}
      disabled={!hasReadyImage || generateVideoMutation.isPending}
      variant="outline"
      className="flex-1"
    >
      <VideoIcon className="w-4 h-4 mr-2" />
      Create Video
    </Button>
  </div>

  <p className="text-xs text-white/50 text-center">
    ✨ AI will generate a UGC-style ad using your product details
  </p>
</form>
```

**Time Estimate**: 3 hours

---

### 4.2 Update MediaPreviewCard for Brief Display

**File**: `client/src/components/MediaPreviewCard.tsx`

**Changes**: Show brief metadata instead of raw prompt

```typescript
// In card display
{asset.metadata?.brief ? (
  <div className="text-xs text-white/70">
    <p className="font-semibold">{asset.metadata.brief.productName}</p>
    <p className="truncate">{asset.metadata.brief.features}</p>
  </div>
) : (
  <p className="text-xs text-white/70 truncate">{asset.prompt}</p>
)}
```

**Time Estimate**: 1 hour

---

### 4.3 Update UGCAdPreviewModal

**File**: `client/src/components/UGCAdPreviewModal.tsx`

**Changes**: Display brief details in modal info section

```typescript
// Add brief details section
{asset.metadata?.brief && (
  <div className="bg-white/5 rounded-lg p-4 space-y-2">
    <h4 className="font-semibold text-white">Product Brief</h4>
    <div className="text-sm text-white/70 space-y-1">
      <p><span className="text-white/90">Product:</span> {asset.metadata.brief.productName}</p>
      <p><span className="text-white/90">Features:</span> {asset.metadata.brief.features}</p>
      {asset.metadata.brief.icp && (
        <p><span className="text-white/90">Target:</span> {asset.metadata.brief.icp}</p>
      )}
      {asset.metadata.brief.scene && (
        <p><span className="text-white/90">Scene:</span> {asset.metadata.brief.scene}</p>
      )}
    </div>
  </div>
)}
```

**Time Estimate**: 1 hour

---

## 🔗 PHASE 5: AUTO-CHAINING — IMAGE → VIDEO PIPELINE

### 5.1 Backend Chaining Logic

**File**: `server/routes.ts`

**New Endpoint**: `POST /api/ai/generate-ugc-ad`

```typescript
/**
 * POST /api/ai/generate-ugc-ad
 *
 * Auto-chain: Generate image → wait for completion → generate video
 * Simplified endpoint for Phase 4.7 UGC workflow
 */
app.post("/api/ai/generate-ugc-ad", requireAuth, async (req, res) => {
  try {
    const { productName, productImageUrl, features, icp, scene } = req.body;

    // Validation
    if (!productName || !productImageUrl || !features) {
      return res.status(400).json({
        error: "Missing required fields: productName, productImageUrl, features"
      });
    }

    const userId = req.userId!;

    // Check usage limits
    const usage = await checkMediaGenerationLimit(userId);
    if (!usage.allowed) {
      return res.status(403).json({
        error: "Monthly media generation limit reached",
        limit: usage.limit,
        used: usage.used,
      });
    }

    console.log('[UGC Ad Chain] Starting image → video generation:', { productName });

    // STEP 1: Generate image (NanoBanana / KIE 4O)
    const { generatePromptForMode } = await import("./utils/promptTemplates.js");

    const brief: UGCBrief = {
      productName,
      productImageUrl,
      features,
      icp: icp || 'young-professional',
      scene: scene || 'kitchen',
    };

    const imagePrompt = generatePromptForMode('nanobanana-veo3', brief, 'image');

    const imageAssetId = uuid();
    await storage.createMediaAsset({
      id: imageAssetId,
      userId,
      provider: 'kie-4o-image',
      type: 'image',
      prompt: imagePrompt,
      referenceImageUrl: productImageUrl,
      status: 'processing',
      metadata: { brief, chainedTo: 'video', step: 1 },
    });

    // Start image generation (non-blocking)
    processMediaGeneration(imageAssetId, {
      provider: 'kie-4o-image',
      type: 'image',
      prompt: imagePrompt,
      referenceImageUrl: productImageUrl,
    }).catch(err => {
      console.error('[UGC Ad Chain] Image generation failed:', err);
    });

    // STEP 2: Start video generation watcher (polls until image ready)
    startVideoChainWatcher(imageAssetId, brief, userId).catch(err => {
      console.error('[UGC Ad Chain] Video chain watcher failed:', err);
    });

    // Increment usage
    await incrementMediaGenerationUsage(userId);

    res.json({
      success: true,
      imageAssetId,
      status: 'processing',
      message: 'UGC ad generation started (image → video)',
    });

  } catch (error: any) {
    console.error("[UGC Ad Chain] Error:", error);
    res.status(500).json({ error: "Failed to start UGC ad generation", details: error.message });
  }
});

/**
 * Background watcher: Wait for image completion, then start video
 */
async function startVideoChainWatcher(
  imageAssetId: string,
  brief: UGCBrief,
  userId: string
): Promise<void> {
  const maxWaitMinutes = 10;
  const checkInterval = 10000; // 10 seconds
  const maxChecks = (maxWaitMinutes * 60 * 1000) / checkInterval;

  let checks = 0;

  while (checks < maxChecks) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    checks++;

    const imageAsset = await storage.getMediaAsset(imageAssetId);

    if (!imageAsset) {
      console.error('[Video Chain] Image asset not found:', imageAssetId);
      return;
    }

    if (imageAsset.status === 'ready' && imageAsset.resultUrl) {
      console.log('[Video Chain] ✅ Image ready, starting video generation');

      // Generate video prompt with image reference
      const { generatePromptForMode } = await import("./utils/promptTemplates.js");
      const videoPrompt = generatePromptForMode(
        'nanobanana-veo3',
        brief,
        'video',
        imageAsset.resultUrl
      );

      // Create video asset
      const videoAssetId = uuid();
      await storage.createMediaAsset({
        id: videoAssetId,
        userId,
        provider: 'kie-veo3',
        type: 'video',
        prompt: videoPrompt,
        referenceImageUrl: imageAsset.resultUrl,
        status: 'processing',
        metadata: {
          brief,
          chainedFrom: imageAssetId,
          step: 2,
        },
      });

      // Start video generation
      processMediaGeneration(videoAssetId, {
        provider: 'kie-veo3',
        type: 'video',
        prompt: videoPrompt,
        referenceImageUrl: imageAsset.resultUrl,
      }).catch(err => {
        console.error('[Video Chain] Video generation failed:', err);
      });

      return; // Success, exit watcher

    } else if (imageAsset.status === 'error') {
      console.error('[Video Chain] ❌ Image generation failed, aborting video chain');
      return;
    }
  }

  console.warn('[Video Chain] ⚠️ Timeout waiting for image completion');
}
```

**Time Estimate**: 2.5 hours

---

### 5.2 Frontend "One-Click UGC Ad" Button

**File**: `client/src/pages/AIStudioPage.tsx`

**Add**: Simplified "Create Complete Ad" button that calls chain endpoint

```typescript
const generateCompleteMutation = useMutation({
  mutationFn: async (brief: UGCBrief) => {
    const res = await apiRequest('POST', '/api/ai/generate-ugc-ad', brief);
    return await res.json();
  },
  onSuccess: () => {
    toast({
      title: 'UGC Ad Generation Started! 🎬',
      description: 'Creating your image and video. Check gallery below.',
    });
    queryClient.invalidateQueries({ queryKey: ['/api/ai/media'] });
  },
});

// In form
<Button
  type="button"
  onClick={() => generateCompleteMutation.mutate(brief)}
  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
>
  <Sparkles className="w-4 h-4 mr-2" />
  ✨ Create Complete UGC Ad (Image + Video)
</Button>
```

**Time Estimate**: 30 minutes

---

## ✅ PHASE 6: TESTING, VALIDATION & QA

### 6.1 Backend Testing

**Test Matrix**:

| Test Case | Input | Expected Output | Status |
|-----------|-------|----------------|--------|
| **Veo3 Polling** | Start video generation | Status changes `processing` → `ready` | ☐ |
| **Veo3 URL Extraction** | Check `resultUrl` in DB | Valid URL saved | ☐ |
| **Timeout Handling** | Wait 30+ minutes (or mock) | Status changes to `error` | ☐ |
| **Retry Endpoint** | POST to `/retry/:id` | New taskId generated, status `processing` | ☐ |
| **Prompt Generation** | Submit UGC brief | Prompt matches template structure | ☐ |
| **Image → Video Chain** | POST to `/generate-ugc-ad` | Both assets created, video starts after image | ☐ |

**Test Scripts**:

```bash
# 1. Test Veo3 video generation
curl -X POST https://your-app.onrender.com/api/ai/generate-media \
  -H "Cookie: connect.sid=..." \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Test Product",
    "productImageUrl": "https://example.com/product.jpg",
    "features": "Fast, effective, affordable",
    "type": "video",
    "mode": "veo3-only"
  }'

# 2. Monitor logs
# Render Dashboard → Logs → Filter "[Veo3 Polling]"
# Expect: status updates every 30s until ready

# 3. Test retry endpoint
ASSET_ID="failed-asset-id-here"
curl -X POST https://your-app.onrender.com/api/ai/media/retry/$ASSET_ID \
  -H "Cookie: connect.sid=..."

# 4. Test chain endpoint
curl -X POST https://your-app.onrender.com/api/ai/generate-ugc-ad \
  -H "Cookie: connect.sid=..." \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Creatine Gummies",
    "productImageUrl": "https://example.com/gummies.jpg",
    "features": "Tasty, easy to use, boosts energy",
    "icp": "gym-goer",
    "scene": "gym"
  }'
```

**Time Estimate**: 2 hours

---

### 6.2 Frontend Testing

**Manual QA Checklist**:

- [ ] **Form Validation**
  - [ ] Product image URL required
  - [ ] Product name required
  - [ ] Features required
  - [ ] ICP and Scene optional (defaults work)

- [ ] **Image Generation**
  - [ ] "Create Image" button submits form
  - [ ] Gallery updates with new asset (status: processing)
  - [ ] Status changes to "Ready" after ~60-90 seconds
  - [ ] Thumbnail displays correctly
  - [ ] Modal preview shows image

- [ ] **Video Generation**
  - [ ] "Create Video" button disabled until image ready
  - [ ] Video generation uses image as reference
  - [ ] Status polling shows progress
  - [ ] Video preview plays in modal

- [ ] **Retry Flow**
  - [ ] Failed assets show "Retry" button
  - [ ] Clicking retry restarts generation
  - [ ] Gallery updates status to "Processing"

- [ ] **Complete UGC Ad**
  - [ ] "Create Complete Ad" starts both image and video
  - [ ] Gallery shows 2 assets (chained)
  - [ ] Video waits for image completion before starting

**Time Estimate**: 1 hour

---

## 📊 IMPLEMENTATION SCHEDULE

### Recommended Order

**Day 1** (8 hours):
1. ✅ Phase 1: Backend Fixes (4 hours)
   - Fix Veo3 polling in `kie.ts`
   - Add timeout to `processMediaGeneration()`
   - Enhanced logging
2. ✅ Phase 2: Retry Endpoint (2 hours)
   - Backend endpoint
   - Frontend button integration
3. ✅ Start Phase 3: Prompt Templates (2 hours)
   - Create `promptTemplates.ts`

**Day 2** (8 hours):
1. ✅ Finish Phase 3: Prompt Orchestration (1 hour)
   - Backend integration
2. ✅ Phase 4: Frontend Redesign (5 hours)
   - New form layout
   - Update components
   - Styling
3. ✅ Phase 6 Testing: Backend (2 hours)

**Day 3** (4 hours):
1. ✅ Phase 5: Auto-Chaining (3 hours)
   - Chain endpoint
   - Watcher logic
   - Frontend integration
2. ✅ Phase 6 Testing: Frontend (1 hour)
   - Manual QA
   - Bug fixes

**Total**: 20 hours over 3 days

---

## 🚨 RISK MITIGATION

### Risk 1: Veo3 API Changes
**Mitigation**: Comprehensive logging + fallback paths for URL extraction

### Risk 2: Timeout Too Aggressive
**Mitigation**: Start with 30 minutes, monitor real completion times, adjust if needed

### Risk 3: Chain Watcher Failure
**Mitigation**: Add retry logic, user notification if image fails

### Risk 4: Prompt Template Quality
**Mitigation**: Test with real products, iterate on prompt structure based on output quality

---

## 📝 DEPLOYMENT CHECKLIST

**Pre-Deployment**:
- [ ] All tests passing (backend + frontend)
- [ ] Veo3 video generation confirmed working on staging
- [ ] Timeout handling tested (mock or real)
- [ ] Retry endpoint verified
- [ ] Prompt templates validated with 3+ test products

**Deployment Steps**:
1. [ ] Push to GitHub `main` branch
2. [ ] Monitor Render auto-deploy logs
3. [ ] Run smoke test on production:
   - Generate 1 image
   - Generate 1 video
   - Test retry on failed asset
4. [ ] Monitor Render logs for 30 minutes
5. [ ] Verify gallery displays correctly
6. [ ] Test modal previews (image + video)

**Post-Deployment**:
- [ ] Document new UGC brief format in README
- [ ] Update user-facing docs (if applicable)
- [ ] Monitor error rates in Render logs (next 24 hours)
- [ ] Collect user feedback on simplified UI

---

## 🎯 SUCCESS CRITERIA

### Must-Have (MVP)
- ✅ Veo3 video generation completes successfully (no infinite polling)
- ✅ Result URLs saved to database
- ✅ Timeout after 30 minutes with clear error message
- ✅ Retry button works for failed generations
- ✅ Simplified UGC brief form (5 inputs max)
- ✅ Prompt templates generate contextual AI prompts

### Nice-to-Have (V2)
- ✅ Auto-chaining (image → video) works end-to-end
- ✅ Gallery shows "chained" badge for linked assets
- ✅ Modal displays brief metadata beautifully
- 📊 Analytics: Track generation success rates by mode
- 🎨 Template previews (show example outputs per scene/ICP combo)

---

## 📚 APPENDIX

### A. File Modification Summary

**Backend Files** (7 modified, 1 new):
1. ✏️ `server/services/kie.ts` - Veo3 status detection + URL extraction
2. ✏️ `server/routes.ts` - Timeout handling, retry endpoint, chain endpoint
3. ✏️ `server/services/mediaGen.ts` - Timestamp tracking
4. ✏️ `shared/schema.ts` - No changes needed (errorMessage exists)
5. ✨ `server/utils/promptTemplates.ts` - NEW: Prompt generation logic

**Frontend Files** (3 modified):
1. ✏️ `client/src/pages/AIStudioPage.tsx` - Redesigned form, new mutations
2. ✏️ `client/src/components/MediaPreviewCard.tsx` - Retry button, brief display
3. ✏️ `client/src/components/UGCAdPreviewModal.tsx` - Brief metadata display

**Total**: 8 files modified, 1 new file

---

### B. Environment Variables

**No new env vars required** ✅
All existing credentials (`KIE_API_KEY`, `OPENAI_API_KEY`) remain valid.

---

### C. Database Migrations

**No schema changes required** ✅
Existing `media_assets` table has all necessary fields:
- `errorMessage` (text) - Already exists
- `metadata` (jsonb) - Can store UGC brief
- `retryCount` (integer) - Already exists

---

### D. API Endpoint Reference

**New Endpoints**:
- `POST /api/ai/media/retry/:id` - Retry failed generation
- `POST /api/ai/generate-ugc-ad` - Auto-chain image → video

**Modified Endpoints**:
- `POST /api/ai/generate-media` - Now accepts UGC brief format (backward compatible)

**Unchanged**:
- `GET /api/ai/media` - Gallery list
- `GET /api/ai/media/:id` - Single asset details
- `POST /api/ai/media/use-for-video` - Convert image to video (still works)

---

## 🏁 CONCLUSION

This implementation plan addresses **all requirements** from `UGC-redesign-NOV7th.md`:

✅ **Backend**: Veo3 polling fixed, timeout handling, retry endpoint
✅ **Prompts**: Dynamic template system integrated from `veo-3-prompts.md`
✅ **Frontend**: Simplified UGC brief form (5 inputs)
✅ **Auto-chaining**: Image → Video pipeline implemented
✅ **Testing**: Comprehensive test matrix and QA checklist

**Estimated Timeline**: 20 hours (3 days)
**Risk Level**: Low (incremental changes, backward compatible)
**User Impact**: High (simplified UX, working video generation)

---

**Ready to proceed with implementation?**
Reply with "Start Phase 1" to begin backend fixes, or ask any clarifying questions.

