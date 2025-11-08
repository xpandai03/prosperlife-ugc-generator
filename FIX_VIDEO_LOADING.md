# 🔧 FIX: UGC Video Loading Issue

## 🎯 Root Cause Analysis

**Problem**: Veo3 videos successfully generate and save to database, but don't display in the frontend gallery/modal.

**Evidence**:
- ✅ Backend logs: `[Veo3 ✅] Video saved successfully`
- ✅ Database query: `result_url` contains valid .mp4 URL
- ✅ URL downloads/plays correctly when accessed directly
- ❌ Frontend: Videos stuck in "loading" state

**Most Likely Causes**:
1. **Drizzle ORM field name mismatch** - Returns `result_url` (snake_case) but frontend expects `resultUrl` (camelCase)
2. **Missing URL extraction path** - Frontend checks wrong field name
3. **Query cache not updating** - Frontend has stale data showing `status='processing'`

---

## 📝 Fix Implementation

### **Fix 1: Add Debug Logging to MediaPreviewCard**
**File**: `client/src/components/MediaPreviewCard.tsx`
**Line**: After line 66

**Add**:
```typescript
const mediaUrl = getMediaUrl();

// 🔍 DEBUG: Log exact asset structure for videos
if (asset.type === 'video') {
  console.log('[MediaPreviewCard] Video asset:', {
    id: asset.id,
    status: asset.status,
    type: asset.type,
    resultUrl: asset.resultUrl,
    result_url: (asset as any).result_url,
    resultUrls: asset.resultUrls,
    extractedUrl: mediaUrl,
    allKeys: Object.keys(asset),
  });
}
```

---

### **Fix 2: Enhanced URL Extraction with All Possible Paths**
**File**: `client/src/components/MediaPreviewCard.tsx`
**Line**: 52-64

**Replace**:
```typescript
// Robust URL extraction with fallbacks
const getMediaUrl = (): string | null => {
  return (
    asset.resultUrl ||
    (asset as any).result_url ||
    asset.resultUrls?.[0] ||
    asset.metadata?.resultUrls?.[0] ||
    asset.metadata?.outputs?.[0]?.url ||
    asset.metadata?.resultUrl ||
    asset.apiResponse?.data?.resultUrl ||
    null
  );
};
```

**With**:
```typescript
// Robust URL extraction with ALL possible paths (Drizzle + API variations)
const getMediaUrl = (): string | null => {
  // Try all possible field name variations
  const url = (
    asset.resultUrl ||                                  // Drizzle camelCase
    (asset as any).result_url ||                        // Drizzle snake_case fallback
    asset.resultUrls?.[0] ||                            // Array format (camelCase)
    (asset as any).result_urls?.[0] ||                  // Array format (snake_case)
    asset.metadata?.response?.resultUrls?.[0] ||        // KIE nested path
    asset.metadata?.resultJson?.resultUrls?.[0] ||      // Sora/NanoBanana path
    asset.metadata?.resultUrls?.[0] ||                  // Metadata array
    asset.metadata?.resultUrl ||                        // Metadata single
    asset.metadata?.result_url ||                       // Metadata snake_case
    asset.metadata?.outputs?.[0]?.url ||                // Outputs array
    asset.apiResponse?.data?.resultUrl ||               // API response camelCase
    (asset.apiResponse as any)?.data?.result_url ||     // API response snake_case
    null
  );

  // Clean URL (remove null/undefined/empty)
  return url && url.trim() !== '' ? url : null;
};
```

---

### **Fix 3: Add Fallback Render for "Ready Video with No URL"**
**File**: `client/src/components/MediaPreviewCard.tsx`
**Line**: After line 141 (after video render)

**Add**:
```typescript
        {/* Ready State - Video */}
        {asset.status === 'ready' && asset.type === 'video' && mediaUrl && (
          <video
            src={mediaUrl}
            controls
            className="w-full h-full object-cover"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        )}

        {/* 🆕 Ready Video BUT No URL (Debug Case) */}
        {asset.status === 'ready' && asset.type === 'video' && !mediaUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-500/10">
            <VideoIcon className="h-8 w-8 text-yellow-400 mb-3" />
            <p className="text-sm text-yellow-300 font-medium mb-1">Video Ready - URL Missing</p>
            <p className="text-xs text-yellow-300/80 px-4 text-center">
              Generation complete but preview URL not found. Check console logs.
            </p>
          </div>
        )}
```

---

### **Fix 4: Force Query Refetch on Status Change**
**File**: `client/src/pages/AIStudioPage.tsx`
**Line**: 88-94

**Replace**:
```typescript
const { data: gallery, isLoading } = useQuery<GetMediaGalleryResponse>({
  queryKey: ['/api/ai/media'],
  refetchInterval: (data) => {
    // Poll every 10s if there are processing assets, otherwise don't poll
    const hasProcessing = data?.assets?.some(a => a.status === 'processing');
    return hasProcessing ? 10000 : false;
  },
  refetchIntervalInBackground: false,
});
```

**With**:
```typescript
const { data: gallery, isLoading } = useQuery<GetMediaGalleryResponse>({
  queryKey: ['/api/ai/media'],
  refetchInterval: (data) => {
    // Poll every 10s if there are processing assets, otherwise don't poll
    const hasProcessing = data?.assets?.some(a => a.status === 'processing');

    // 🔍 DEBUG: Log polling decision
    if (hasProcessing) {
      console.log('[AIStudio] Polling active - processing assets found:',
        data?.assets?.filter(a => a.status === 'processing').map(a => ({ id: a.id, type: a.type }))
      );
    }

    return hasProcessing ? 10000 : false;
  },
  refetchIntervalInBackground: false,
  // 🆕 Force at least ONE refetch after processing completes
  refetchOnMount: true,
  staleTime: 5000, // Override global Infinity to allow refetch
});
```

---

### **Fix 5: Apply Same Fixes to UGCAdPreviewModal**
**File**: `client/src/components/UGCAdPreviewModal.tsx`
**Line**: 81-105

**Update URL extraction** (same as Fix 2):
```typescript
const mediaUrl = useMemo(() => {
  if (!asset) return '';

  try {
    const url = (
      asset?.resultUrl ||
      (asset as any)?.result_url ||
      asset?.resultUrls?.[0] ||
      (asset as any)?.result_urls?.[0] ||
      asset?.metadata?.response?.resultUrls?.[0] ||
      asset?.metadata?.resultJson?.resultUrls?.[0] ||
      asset?.metadata?.resultUrls?.[0] ||
      asset?.metadata?.resultUrl ||
      asset?.metadata?.result_url ||
      asset?.metadata?.outputs?.[0]?.url ||
      asset?.metadata?.resources?.[0]?.url ||
      asset?.apiResponse?.data?.resultUrl ||
      (asset?.apiResponse as any)?.data?.result_url ||
      ''
    );

    console.log('[UGC Modal] Extracted mediaUrl:', url, 'from asset:', asset.id, 'keys:', Object.keys(asset));
    return url && url.trim() !== '' ? url : '';
  } catch (error) {
    console.error('[UGC Modal] Error extracting media URL:', error);
    setError(true);
    return '';
  }
}, [asset]);
```

---

## 🧪 Testing Steps

### **Step 1: Check Browser Console Logs**
1. Open `/ai-studio`
2. Open browser DevTools Console
3. Generate a video (or wait for existing one to complete)
4. Look for logs:
   ```
   [MediaPreviewCard] Video asset: { ..., resultUrl: '...', result_url: '...', extractedUrl: '...' }
   [AIStudio] Polling active - processing assets found: [...]
   [UGC Modal] Extracted mediaUrl: https://... from asset: xyz
   ```

### **Step 2: Identify Field Name**
From console logs, determine if the field is:
- ✅ `resultUrl` (camelCase) - Drizzle working correctly
- ❌ `result_url` (snake_case) - Drizzle serialization issue

### **Step 3: Verify URL Extraction**
Check `extractedUrl` in console - should match the `.mp4` URL from database.

### **Step 4: If Still Broken**
If logs show `extractedUrl: null` but `result_url: 'https://...'`:
- The fix above should catch it with snake_case fallback
- If not, there's a deeper serialization issue

---

## 🎯 Expected Outcome

**After Fix**:
1. ✅ Console logs show exact field names returned by API
2. ✅ URL extraction tries ALL possible paths (camelCase + snake_case)
3. ✅ Videos with `status='ready'` AND valid URL → display video player
4. ✅ Videos with `status='ready'` BUT no URL → show yellow warning
5. ✅ Polling continues until status changes, then refetches once more

**Success Indicators**:
- Video cards show `<video>` player with controls
- Modal displays full video preview
- No "stuck loading" or blank states
- Console logs confirm URL extraction

---

## 📊 Alternative Hypothesis

If the above fixes don't work, the issue may be:
- **CORS/CSP blocking video URLs** - Check Network tab for failed requests
- **Video format incompatible** - Browser can't play .mp4 codec
- **URL requires authentication** - KIE temp URLs expired

**Quick Test**:
```javascript
// In browser console:
const testUrl = "https://tempfile.aiquickdraw.com/v/6f00e7800edc1d6d653faf01f5b6a1ee_1762581052.mp4";
const video = document.createElement('video');
video.src = testUrl;
video.controls = true;
document.body.appendChild(video);
// Should play immediately if URL is valid
```

---

## 🚀 Deployment

**Files to modify**:
1. ✅ `client/src/components/MediaPreviewCard.tsx`
2. ✅ `client/src/components/UGCAdPreviewModal.tsx`
3. ✅ `client/src/pages/AIStudioPage.tsx`

**Commit message**:
```
Fix: UGC Video Loading - Enhanced URL Extraction + Debug Logging

- Add comprehensive URL extraction fallbacks (camelCase + snake_case)
- Add debug logging to identify exact field names from API
- Add fallback UI for "ready video with no URL" case
- Force query refetch after processing completes
- Override global staleTime for gallery query

Root cause: Drizzle ORM may return snake_case field names,
but frontend only checked camelCase. Now checks both.

Testing: Check browser console for [MediaPreviewCard] logs
```
