        console.error('[Background] Max retries reached, marking as 
 failed:', assetId);
         return;
       }

       // Exponential backoff: 2s, 4s, 6s
       await new Promise(resolve => setTimeout(resolve, 2000 *
 retryCount));
     }
   }
 }

 Error Responses:

 // 400 - Validation error
 {
   "error": "Invalid input",
   "details": [{ "path": ["prompt"], "message": "Prompt must be at 
 least 10 characters" }]
 }

 // 403 - Usage limit
 {
   "error": "Monthly media generation limit reached",
   "message": "Free plan allows 10 AI generations per month. Upgrade 
 to Pro for unlimited.",
   "limit": 10
 }

 // 404 - Not found
 {
   "error": "Media asset not found"
 }

 // 500 - Server error
 {
   "error": "Failed to start media generation",
   "details": "KIE API Error: Invalid prompt"
 }

 Success Criteria:
 - ✅ POST /api/ai/generate-media creates asset and starts background
  job
 - ✅ GET /api/ai/media/:id returns current status
 - ✅ GET /api/ai/media returns gallery list
 - ✅ Usage limits enforced (10/month free, unlimited pro)
 - ✅ Validation catches invalid inputs
 - ✅ Background job polls every 30s
 - ✅ Retry logic works (3x with backoff)
 - ✅ Errors logged with context

 Time Estimate: 3 hours

 ---
 PHASE 4.4 — FRONTEND AI STUDIO PAGE (5 hours)

 4.4.1 Create AI Studio Page (client/src/pages/AIStudioPage.tsx)

 File: client/src/pages/AIStudioPage.tsx (NEW)

 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from
 "@tanstack/react-query";
 import { apiRequest } from "@/lib/queryClient";
 import { useToast } from "@/hooks/use-toast";
 import { Button } from "@/components/ui/button";
 import { Textarea } from "@/components/ui/textarea";
 import { Label } from "@/components/ui/label";
 import { Input } from "@/components/ui/input";
 import { Select, SelectContent, SelectItem, SelectTrigger,
 SelectValue } from "@/components/ui/select";
 import { Card, CardContent, CardDescription, CardFooter, CardHeader,
  CardTitle } from "@/components/ui/card";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 import { WaveBackground } from "@/components/WaveBackground";
 import { LimitReachedDialog } from
 "@/components/LimitReachedDialog";
 import { MediaPreviewCard } from "@/components/MediaPreviewCard";
 import { Loader2, Sparkles, Image, Video, Calendar } from
 "lucide-react";
 import { useLocation } from "wouter";

 interface MediaAsset {
   id: string;
   provider: string;
   type: 'image' | 'video';
   prompt: string;
   status: 'processing' | 'ready' | 'error';
   resultUrl?: string;
   errorMessage?: string;
   createdAt: string;
 }

 export default function AIStudioPage() {
   const [prompt, setPrompt] = useState("");
   const [provider, setProvider] = useState<string>("kie-4o-image");
   const [type, setType] = useState<'image' | 'video'>('image');
   const [referenceImageUrl, setReferenceImageUrl] = useState("");
   const [showLimitDialog, setShowLimitDialog] = useState(false);
   const [, setLocation] = useLocation();

   const { toast } = useToast();
   const queryClient = useQueryClient();

   // Fetch user's media gallery
   const { data: gallery, isLoading: galleryLoading } = useQuery<{
 assets: MediaAsset[] }>({
     queryKey: ['/api/ai/media'],
     refetchInterval: 10000, // Refresh every 10s to show status 
 updates
   });

   // Generate media mutation
   const generateMutation = useMutation({
     mutationFn: async (params: {
       prompt: string;
       provider: string;
       type: string;
       referenceImageUrl?: string;
     }) => {
       const response = await apiRequest('POST',
 '/api/ai/generate-media', params);
       return await response.json();
     },
     onSuccess: (data) => {
       toast({
         title: 'Generation started! ✨',
         description: 'Your AI media is being generated. Check the 
 gallery below for progress.',
       });

       // Reset form
       setPrompt("");
       setReferenceImageUrl("");

       // Refresh gallery
       queryClient.invalidateQueries({ queryKey: ['/api/ai/media']
 });
     },
     onError: (error: any) => {
       console.error('Generation error:', error);

       // Check for usage limits
       if (error.message.includes('limit')) {
         setShowLimitDialog(true);
         return;
       }

       toast({
         title: 'Generation failed',
         description: error.message,
         variant: 'destructive',
       });
     },
   });

   const handleGenerate = () => {
     if (!prompt || prompt.length < 10) {
       toast({
         title: 'Invalid prompt',
         description: 'Prompt must be at least 10 characters',
         variant: 'destructive',
       });
       return;
     }

     generateMutation.mutate({
       prompt,
       provider,
       type,
       referenceImageUrl: referenceImageUrl || undefined,
     });
   };

   // Update provider when type changes
   const handleTypeChange = (newType: 'image' | 'video') => {
     setType(newType);
     if (newType === 'video') {
       setProvider('kie-veo3');
     } else {
       setProvider('kie-4o-image');
     }
   };

   return (
     <div className="min-h-screen w-full bg-black">
       <WaveBackground />

       <div className="relative z-50 container mx-auto px-4 py-8">
         {/* Header */}
         <div className="mb-8 text-center">
           <h1 className="text-4xl font-bold text-white mb-2">
             AI Studio <Sparkles className="inline h-8 w-8 
 text-yellow-400" />
           </h1>
           <p className="text-white/70">
             Generate stunning images and videos with AI
           </p>
         </div>

         {/* Generation Form */}
         <Card className="bg-white/10 backdrop-blur-md 
 border-white/20 text-white mb-8 max-w-2xl mx-auto">
           <CardHeader>
             <CardTitle className="text-white">Create New
 Media</CardTitle>
             <CardDescription className="text-white/70">
               Describe what you want to generate
             </CardDescription>
           </CardHeader>

           <CardContent className="space-y-4">
             {/* Type Selection */}
             <div className="space-y-2">
               <Label htmlFor="type" className="text-white">Media
 Type</Label>
               <div className="flex gap-2">
                 <Button
                   variant={type === 'image' ? 'default' : 'outline'}
                   className="flex-1"
                   onClick={() => handleTypeChange('image')}
                 >
                   <Image className="mr-2 h-4 w-4" />
                   Image
                 </Button>
                 <Button
                   variant={type === 'video' ? 'default' : 'outline'}
                   className="flex-1"
                   onClick={() => handleTypeChange('video')}
                 >
                   <Video className="mr-2 h-4 w-4" />
                   Video (8s)
                 </Button>
               </div>
             </div>

             {/* Provider Selection */}
             <div className="space-y-2">
               <Label htmlFor="provider" className="text-white">AI
 Provider</Label>
               <Select value={provider} onValueChange={setProvider}>
                 <SelectTrigger className="bg-white/10 
 border-white/20 text-white">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {type === 'image' && (
                     <>
                       <SelectItem value="kie-4o-image">KIE 4O Image
 (Fast)</SelectItem>
                       <SelectItem value="kie-flux-kontext">KIE Flux
 Kontext (HD)</SelectItem>
                       <SelectItem value="gemini-flash">Gemini 2.5
 Flash</SelectItem>
                     </>
                   )}
                   {type === 'video' && (
                     <SelectItem value="kie-veo3">KIE Veo3 (8
 seconds)</SelectItem>
                   )}
                 </SelectContent>
               </Select>
             </div>

             {/* Prompt */}
             <div className="space-y-2">
               <Label htmlFor="prompt" 
 className="text-white">Prompt</Label>
               <Textarea
                 id="prompt"
                 placeholder="Describe your vision in detail... 
 (e.g., 'A serene mountain landscape at sunset with vibrant orange 
 and pink clouds')"
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 maxLength={1000}
                 rows={4}
                 className="bg-white/10 border-white/20 text-white
 placeholder:text-white/50"
               />
               <p className="text-xs text-white/50">
                 {prompt.length} / 1000 characters
               </p>
             </div>

             {/* Reference Image (Optional) */}
             <div className="space-y-2">
               <Label htmlFor="referenceImage" 
 className="text-white">
                 Reference Image URL (Optional)
               </Label>
               <Input
                 id="referenceImage"
                 type="url"
                 placeholder="https://example.com/product-image.jpg"
                 value={referenceImageUrl}
                 onChange={(e) =>
 setReferenceImageUrl(e.target.value)}
                 className="bg-white/10 border-white/20 text-white
 placeholder:text-white/50"
               />
               <p className="text-xs text-white/50">
                 For image-to-video or styled image generation
               </p>
             </div>
           </CardContent>

           <CardFooter>
             <Button
               onClick={handleGenerate}
               disabled={generateMutation.isPending || !prompt || 
 prompt.length < 10}
               className="w-full bg-blue-600 hover:bg-blue-700 
 text-white"
               size="lg"
             >
               {generateMutation.isPending ? (
                 <>
                   <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                   Generating...
                 </>
               ) : (
                 <>
                   <Sparkles className="mr-2 h-5 w-5" />
                   Generate {type === 'image' ? 'Image' : 'Video'}
                 </>
               )}
             </Button>
           </CardFooter>
         </Card>

         {/* Gallery */}
         <div className="max-w-6xl mx-auto">
           <h2 className="text-2xl font-bold text-white mb-4">Your
 Generations</h2>

           {galleryLoading && (
             <div className="text-center py-8">
               <Loader2 className="h-8 w-8 animate-spin text-white 
 mx-auto" />
             </div>
           )}

           {!galleryLoading && gallery?.assets.length === 0 && (
             <Alert className="bg-white/10 border-white/20 
 text-white">
               <Sparkles className="h-4 w-4" />
               <AlertDescription>
                 No generations yet. Create your first AI media
 above!
               </AlertDescription>
             </Alert>
           )}

           {!galleryLoading && gallery && gallery.assets.length > 0
 && (
             <div className="grid grid-cols-1 md:grid-cols-2 
 lg:grid-cols-3 gap-4">
               {gallery.assets.map((asset) => (
                 <MediaPreviewCard key={asset.id} asset={asset} />
               ))}
             </div>
           )}
         </div>
       </div>

       {/* Usage Limit Dialog */}
       <LimitReachedDialog
         open={showLimitDialog}
         onOpenChange={setShowLimitDialog}
       />
     </div>
   );
 }

 4.4.2 Create Media Preview Card Component

 File: client/src/components/MediaPreviewCard.tsx (NEW)

 import { useState } from "react";
 import { Card, CardContent, CardFooter, CardHeader } from
 "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Loader2, Sparkles, Calendar, CheckCircle2, XCircle,
 ExternalLink } from "lucide-react";
 import { PostClipModal } from "./PostClipModal"; // Reuse from Phase
  3
 import { useMutation } from "@tanstack/react-query";
 import { apiRequest } from "@/lib/queryClient";
 import { useToast } from "@/hooks/use-toast";

 interface MediaAsset {
   id: string;
   provider: string;
   type: 'image' | 'video';
   prompt: string;
   status: 'processing' | 'ready' | 'error';
   resultUrl?: string;
   errorMessage?: string;
   createdAt: string;
 }

 interface MediaPreviewCardProps {
   asset: MediaAsset;
 }

 export function MediaPreviewCard({ asset }: MediaPreviewCardProps) {
   const [showPostModal, setShowPostModal] = useState(false);
   const [showCaption, setShowCaption] = useState(false);
   const [generatedCaption, setGeneratedCaption] = useState("");
   const { toast } = useToast();

   // Generate caption mutation (Phase 2 integration)
   const generateCaptionMutation = useMutation({
     mutationFn: async () => {
       // Note: This assumes we'll extend caption service to accept 
 media URLs
       // For MVP, can use a generic caption based on the prompt
       const response = await apiRequest('POST',
 '/api/caption/generate-from-media', {
         mediaId: asset.id,
         prompt: asset.prompt,
       });
       return await response.json();
     },
     onSuccess: (data) => {
       setGeneratedCaption(data.caption);
       setShowCaption(true);
       toast({
         title: 'Caption generated! ✨',
         description: 'Ready to post to Instagram',
       });
     },
     onError: (error: any) => {
       toast({
         title: 'Caption generation failed',
         description: error.message,
         variant: 'destructive',
       });
     },
   });

   const providerName = asset.provider.replace('kie-',
 '').toUpperCase();

   return (
     <>
       <Card className="bg-white/10 backdrop-blur-md border-white/20 
 text-white overflow-hidden">
         <CardHeader className="p-4 pb-2">
           <div className="flex items-center justify-between">
             <Badge variant={asset.status === 'ready' ? 'default' : 
 'secondary'}>
               {asset.status === 'processing' && <Loader2 
 className="h-3 w-3 animate-spin mr-1" />}
               {asset.status === 'ready' && <CheckCircle2 
 className="h-3 w-3 mr-1" />}
               {asset.status === 'error' && <XCircle className="h-3 
 w-3 mr-1" />}
               {asset.status}
             </Badge>
             <span className="text-xs 
 text-white/50">{providerName}</span>
           </div>
         </CardHeader>

         <CardContent className="p-4 pt-2">
           {/* Media Preview */}
           {asset.status === 'ready' && asset.resultUrl && (
             <div className="rounded-lg overflow-hidden mb-3 
 bg-black/20">
               {asset.type === 'image' ? (
                 <img
                   src={asset.resultUrl}
                   alt={asset.prompt}
                   className="w-full h-48 object-cover"
                 />
               ) : (
                 <video
                   src={asset.resultUrl}
                   controls
                   className="w-full h-48"
                   preload="metadata"
                 />
               )}
             </div>
           )}

           {asset.status === 'processing' && (
             <div className="h-48 bg-black/20 rounded-lg flex 
 items-center justify-center">
               <div className="text-center">
                 <Loader2 className="h-8 w-8 animate-spin text-white 
 mx-auto mb-2" />
                 <p className="text-sm 
 text-white/70">Generating...</p>
               </div>
             </div>
           )}

           {asset.status === 'error' && (
             <div className="h-48 bg-red-500/10 rounded-lg flex 
 items-center justify-center">
               <div className="text-center p-4">
                 <XCircle className="h-8 w-8 text-red-400 mx-auto 
 mb-2" />
                 <p className="text-sm 
 text-red-300">{asset.errorMessage || 'Generation failed'}</p>
               </div>
             </div>
           )}

           {/* Prompt */}
           <p className="text-sm text-white/80 line-clamp-2 mb-2">
             {asset.prompt}
           </p>

           <p className="text-xs text-white/50">
             {new Date(asset.createdAt).toLocaleDateString()}
           </p>
         </CardContent>

         {asset.status === 'ready' && asset.resultUrl && (
           <CardFooter className="p-4 pt-2 flex gap-2">
             <Button
               variant="outline"
               size="sm"
               onClick={() => generateCaptionMutation.mutate()}
               disabled={generateCaptionMutation.isPending}
               className="flex-1"
             >
               {generateCaptionMutation.isPending ? (
                 <>
                   <Loader2 className="h-3 w-3 animate-spin mr-1" />
                   Generating...
                 </>
               ) : (
                 <>
                   <Sparkles className="h-3 w-3 mr-1" />
                   Caption
                 </>
               )}
             </Button>

             <Button
               size="sm"
               onClick={() => setShowPostModal(true)}
               className="flex-1 bg-blue-600 hover:bg-blue-700"
             >
               <Calendar className="h-3 w-3 mr-1" />
               Post
             </Button>

             <Button
               variant="ghost"
               size="sm"
               asChild
             >
               <a href={asset.resultUrl} target="_blank" 
 rel="noopener noreferrer">
                 <ExternalLink className="h-3 w-3" />
               </a>
             </Button>
           </CardFooter>
         )}
       </Card>

       {/* Post Modal (Phase 3 integration) */}
       {/* Note: PostClipModal expects projectId and exportUrl */}
       {/* For AI-generated media, we'll need to adapt or create new
 modal */}
       {showPostModal && (
         <PostClipModal
           isOpen={showPostModal}
           onClose={() => setShowPostModal(false)}
           projectId={asset.id} // Use mediaAssetId
           exportUrl={asset.resultUrl || null}
         />
       )}
     </>
   );
 }

 4.4.3 Update App Routes

 File: client/src/App.tsx (MODIFY)

 import AIStudioPage from "@/pages/AIStudioPage";

 // Add route
 <Route path="/ai-studio">
   <ProtectedRoute>
     <AIStudioPage />
   </ProtectedRoute>
 </Route>

 4.4.4 Update Navigation

 File: client/src/components/ui/mini-navbar.tsx (MODIFY)

 // Add AI Studio link
 <Link href="/ai-studio" className="...">
   <Sparkles className="h-5 w-5" />
   <span>AI Studio</span>
 </Link>

 Success Criteria:
 - ✅ /ai-studio page accessible and protected
 - ✅ Generation form with provider/type selection
 - ✅ Prompt validation (10-1000 chars)
 - ✅ Gallery shows all user generations
 - ✅ Status updates every 10s (polling)
 - ✅ Loading states during generation
 - ✅ Error states displayed
 - ✅ "Generate Caption" button integrates with Phase 2
 - ✅ "Post" button integrates with Phase 3
 - ✅ Responsive layout (mobile/desktop)

 Time Estimate: 5 hours

 ---
 PHASE 4.5 — INTEGRATION & TESTING (2 hours)

 4.5.1 Caption Integration

 Update: server/routes.ts (add new endpoint)

 /**
  * POST /api/caption/generate-from-media
  * 
  * Generate caption for AI-generated media (Phase 4 + Phase 2 
 integration)
  */
 app.post("/api/caption/generate-from-media", requireAuth, async
 (req, res) => {
   try {
     const { mediaId, prompt } = req.body;

     const mediaAsset = await storage.getMediaAsset(mediaId);
     if (!mediaAsset || mediaAsset.userId !== req.userId) {
       return res.status(404).json({ error: "Media asset not found"
 });
     }

     // Generate caption based on original prompt
     const { openaiService } = await import("./services/openai.js");
     const user = await storage.getUser(req.userId!);

     const result = await openaiService.generateCaption({
       projectName: `AI ${mediaAsset.type}: ${prompt}`,
       userSystemPrompt: user?.captionSystemPrompt || undefined,
     });

     res.json({
       success: true,
       caption: result.caption,
       metadata: result.metadata,
     });

   } catch (error: any) {
     console.error("[Caption From Media] Error:", error);
     res.status(500).json({
       error: "Failed to generate caption",
       details: error.message,
     });
   }
 });

 4.5.2 Posting Integration

 Adapt PostClipModal or create MediaPostModal:

 Since PostClipModal expects projectId (from Klap videos), we have
 two options:

 Option A: Create unified posting interface that accepts both Klap
 projects and AI media
 Option B: Create separate MediaPostModal for AI-generated content

 Recommended: Option B (cleaner separation)

 File: client/src/components/MediaPostModal.tsx (NEW)

 // Similar to PostClipModal but accepts mediaAssetId instead of 
 projectId
 // Uses asset.resultUrl as video/image source
 // Supports both Phase 2 (captions) and Phase 3 (scheduling)

 4.5.3 Test Matrix

 | Test Case                             | Provider     | Type  |
 Expected Result                  | Status |
 |---------------------------------------|--------------|-------|----
 ------------------------------|--------|
 | Happy Path: Generate Image            | kie-4o-image | image |
 resultUrl received, status=ready | ⏳      |
 | Happy Path: Generate Video            | kie-veo3     | video |
 resultUrl received, status=ready | ⏳      |
 | Happy Path: Gemini Image              | gemini-flash | image |
 Synchronous result               | ⏳      |
 | Error: Invalid Prompt (< 10 chars)    | any          | any   | 400
  validation error             | ⏳      |
 | Error: Usage Limit Reached            | any          | any   | 403
  limit dialog                 | ⏳      |
 | Error: Provider Timeout               | kie-veo3     | video |
 Retry 3x, then status=error      | ⏳      |
 | Integration: Generate → Caption       | kie-4o-image | image |
 Caption appears in modal         | ⏳      |
 | Integration: Generate → Schedule Post | kie-veo3     | video |
 Scheduled in Late.dev            | ⏳      |
 | Integration: Generate → Post Now      | kie-4o-image | image |
 Instagram post created           | ⏳      |
 | Reference Image: With URL             | kie-veo3     | video |
 Image-to-video                   | ⏳      |
 | Polling: Status Updates               | kie-4o-image | image |
 Gallery refreshes status         | ⏳      |

 4.5.4 Manual QA Steps (on Render)

 1. Deploy Phase 4 changes to Render
   - Push to GitHub
   - Verify auto-deploy completes
   - Check logs for errors
 2. Run migration
 npx tsx scripts/migrate-media-assets.ts
 3. Test image generation (KIE 4O)
   - Navigate to /ai-studio
   - Select "Image" type
   - Provider: "KIE 4O Image"
   - Prompt: "A serene mountain landscape at sunset"
   - Click "Generate"
   - Expected: Asset appears in gallery with "processing" status
   - Wait 2-3 minutes
   - Expected: Status updates to "ready", image preview loads
 4. Test video generation (KIE Veo3)
   - Type: "Video"
   - Provider: "KIE Veo3"
   - Prompt: "A 8-second selfie-style review of creatine gummies"
   - Click "Generate"
   - Expected: Processing status
   - Wait 3-5 minutes
   - Expected: Video preview playable
 5. Test Gemini fallback
   - Provider: "Gemini 2.5 Flash"
   - Type: "Image"
   - Prompt: "Stylized product photo of supplements"
   - Expected: Faster response (< 30s), synchronous
 6. Test usage limits
   - Create 10 generations as free user
   - Attempt 11th generation
   - Expected: 403 error, limit dialog appears
 7. Test caption integration
   - Click "Caption" on a ready image
   - Expected: Caption generated based on prompt
 8. Test scheduling integration
   - Click "Post" on a ready video
   - Select "Schedule for later"
   - Choose future time
   - Expected: Scheduled post created in Late.dev

 4.5.5 Expected Logs

 Successful Generation:
 [AI Generate] Request from user: abc-123
 [AI Generate] Starting generation: { provider: 'kie-4o-image', type:
  'image' }
 [AI Generate] Created media asset: xyz-789
 [Background] Processing media generation: xyz-789
 [KIE Service] Generating image: { prompt: 'A serene mountain...' }
 [KIE Service] Image generation started: task_4o_abc123
 [Background] Poll status: { assetId: 'xyz-789', attempt: 1, status:
 'processing' }
 [Background] Poll status: { assetId: 'xyz-789', attempt: 2, status:
 'ready' }
 [Background] Generation complete: xyz-789

 Error Case:
 [Background] Generation attempt failed: { assetId: 'xyz-789',
 attempt: 1, error: 'KIE API Error: Prompt violates content policy' }
 [Background] Generation attempt failed: { assetId: 'xyz-789',
 attempt: 2, error: 'KIE API Error: Prompt violates content policy' }
 [Background] Generation attempt failed: { assetId: 'xyz-789',
 attempt: 3, error: 'KIE API Error: Prompt violates content policy' }
 [Background] Max retries reached, marking as failed: xyz-789

 Success Criteria:
 - ✅ All test matrix cases pass
 - ✅ Manual QA steps complete without errors
 - ✅ Logs show expected patterns
 - ✅ No console errors in browser
 - ✅ Gallery updates in real-time
 - ✅ Usage limits enforced correctly
 - ✅ Integration with Phase 2/3 works seamlessly

 Time Estimate: 2 hours

 ---
 ENVIRONMENT VARIABLES REQUIRED

 Production .env (Render)

 # Existing variables (no changes)
 DATABASE_URL=postgresql://...
 KLAP_API_KEY=kak_xxxxx
 LATE_API_KEY=sk_xxxxx
 STRIPE_API_KEY=sk_live_xxxxx
 OPENAI_API_KEY=sk-proj-xxxxx
 SUPABASE_URL=https://xxxxx.supabase.co

 # NEW: KIE.ai Configuration
 KIE_API_KEY=bf9eb8e5c9173d3792cd7f27e3a4a011

 # NEW: Gemini Configuration
 GEMINI_API_KEY=AIzaSyxxxxx
 GEMINI_MODEL=gemini-2.5-flash

 # Optional: Customize models
 OPENAI_MODEL=gpt-4o

 Frontend .env (no changes needed)

 # Existing variables work as-is
 VITE_SUPABASE_URL=https://xxxxx.supabase.co
 VITE_SUPABASE_ANON_KEY=eyJxxxxx

 ---
 FILES AFFECTED

 New Files (11 total)

 Backend:
 1. server/services/kie.ts - KIE.ai API integration
 2. server/services/gemini.ts - Gemini 2.5 Flash integration
 3. server/services/mediaGen.ts - Media generation orchestrator
 4. server/validators/mediaGen.ts - Validation schemas
 5. db/migrations/0006_media_assets.sql - SQL migration
 6. scripts/migrate-media-assets.ts - Migration script

 Frontend:
 7. client/src/pages/AIStudioPage.tsx - Main AI Studio page
 8. client/src/components/MediaPreviewCard.tsx - Gallery card
 component
 9. client/src/components/MediaPostModal.tsx - Posting modal for AI
 media

 Documentation:
 10. PHASE4_AI_MEDIA_BUILD_PLAN.md - This document
 11. PHASE4_TESTING_GUIDE.md - Detailed testing procedures

 Modified Files (5 total)

 1. shared/schema.ts - Add mediaAssets table + relations
 2. server/storage.ts - Add media asset CRUD methods
 3. server/routes.ts - Add 3 new API endpoints + background job
 4. client/src/App.tsx - Add /ai-studio route
 5. client/src/components/ui/mini-navbar.tsx - Add AI Studio link

 ---
 RISK & MITIGATION

 | Risk                            | Impact | Probability |
 Mitigation
     |
 |---------------------------------|--------|-------------|----------
 ---------------------------------------------------------------|
 | KIE.ai API downtime             | High   | Medium      | Implement
  Gemini fallback for images; retry logic for videos            |
 | KIE.ai rate limits exceeded     | Medium | Low         | Monitor
 usage, implement exponential backoff, clear error messages      |
 | Gemini base64 upload complexity | Medium | High        | Use
 Supabase Storage (already configured); implement upload helper
 |
 | Long generation times (> 5 min) | Low    | Medium      | Set
 20-minute timeout, clear progress indicators, background processing
 |
 | Usage limit abuse               | High   | Low         | Enforce
 10/month free tier, track per user/month, verify Pro status     |
 | Media URL expiration (14 days)  | Medium | High        | Display
 expiration warnings, allow re-generation for Pro users          |
 | Phase 2/3 integration breaking  | High   | Low         | Extensive
  testing, fallback to basic posting if caption fails           |
 | Database migration issues       | High   | Low         | Test on
 staging first, rollback script available                        |

 ---
 TIME ESTIMATES

 | Phase | Tasks                 | Estimated Time | Critical Path |
 |-------|-----------------------|----------------|---------------|
 | 4.1   | Backend Service Layer | 4 hours        | Yes           |
 | 4.2   | Database Migration    | 1 hour         | Yes           |
 | 4.3   | API Layer             | 3 hours        | Yes           |
 | 4.4   | Frontend AI Studio    | 5 hours        | Yes           |
 | 4.5   | Integration & Testing | 2 hours        | Yes           |
 | Total |                       | 15 hours       | ~2 days       |

 Breakdown:
 - Day 1 AM: Phase 4.1 + 4.2 (5 hours)
 - Day 1 PM: Phase 4.3 (3 hours)
 - Day 2 AM: Phase 4.4 (5 hours)
 - Day 2 PM: Phase 4.5 (2 hours)

 ---
 SUCCESS CRITERIA BY PHASE

 Phase 4.1: Backend Services ✅

 - KIE service generates video via Veo3 API
 - KIE service generates images via 4O Image and Flux Kontext APIs
 - Gemini service generates images as fallback
 - Media orchestrator routes to correct provider
 - Polling checks status every 30 seconds
 - 3x retry with exponential backoff works
 - Storage methods save/retrieve media assets

 Phase 4.2: Database ✅

 - media_assets table created with all columns
 - 6 indexes created for query optimization
 - user_usage.media_generations_created column added
 - Migration runs without errors on production DB
 - Rollback script tested and available

 Phase 4.3: API Endpoints ✅

 - POST /api/ai/generate-media creates asset and starts background
 job
 - GET /api/ai/media/:id returns current status
 - GET /api/ai/media returns gallery list ordered by date
 - Usage limits enforced (10/month free, unlimited pro)
 - Validation catches invalid inputs (prompt length, provider/type
 mismatch)
 - Background job polls every 30s
 - Errors logged with full context

 Phase 4.4: Frontend ✅

 - /ai-studio page accessible and protected
 - Generation form with provider/type selection
 - Prompt validation (10-1000 chars)
 - Gallery shows all user generations
 - Status updates every 10s (real-time polling)
 - Loading states during generation
 - Error states displayed clearly
 - "Generate Caption" button works (Phase 2 integration)
 - "Post" button works (Phase 3 integration)
 - Responsive layout (mobile/desktop)
 - Navigation link added to navbar

 Phase 4.5: Integration & Testing ✅

 - All test matrix cases pass
 - Manual QA completed on Render
 - Caption integration works seamlessly
 - Scheduling integration works seamlessly
 - Usage limits prevent over-generation
 - No console errors in browser
 - Gallery updates in real-time
 - Logs show expected patterns

 ---
 DEPLOYMENT CHECKLIST

 Pre-Deployment

 - All code reviewed and tested locally
 - Environment variables added to Render dashboard
 - Migration script tested on staging database
 - Rollback plan documented and tested

 Deployment

 - Push Phase 4 changes to GitHub main branch
 - Verify Render auto-deploy starts
 - Monitor build logs for errors
 - Run migration: npx tsx scripts/migrate-media-assets.ts
 - Verify migration success in database
 - Check Render service logs for startup errors

 Post-Deployment

 - Test image generation (KIE 4O)
 - Test video generation (KIE Veo3)
 - Test Gemini fallback
 - Test usage limits (free tier)
 - Test caption integration
 - Test scheduling integration
 - Monitor logs for unexpected errors
 - Verify gallery updates in real-time
 - Test on mobile devices

 Rollback (if needed)

 # Run rollback SQL
 psql $DATABASE_URL -f db/rollback/0006_media_assets.sql

 # Revert code changes
 git revert <commit-hash>
 git push origin main

 ---
 NEXT STEPS AFTER PHASE 4

 Phase 5: Analytics & Insights

 - Track generation metrics (success rate, avg time, provider usage)
 - Dashboard showing usage trends
 - Popular prompts analysis

 Phase 6: Enhanced Features

 - Batch generation (multiple variants at once)
 - Prompt templates library
 - Style presets (e.g., "Cinematic", "Minimalist", "Vibrant")
 - Image editing (Flux Kontext masking)

 Phase 7: Optimization

 - Webhook support for faster status updates
 - Caching frequently used prompts
 - CDN integration for faster media delivery
 - Cost optimization (model selection based on user tier)

 ---
 CONCLUSION

 This implementation plan provides a complete, actionable roadmap for
  Phase 4: AI Image & Video Generator. All architectural decisions
 align with existing patterns from Phases 1-3, ensuring seamless
 integration and maintainability.

 Key Highlights:
 - Provider Flexibility: KIE.ai primary, Gemini fallback
 - Async Architecture: Background jobs with polling (30s interval)
 - Usage Limits: 10 generations/month free, unlimited pro
 - Full Integration: Works with Caption Assistant (Phase 2) and
 Scheduled Posting (Phase 3)
 - Robust Error Handling: 3x retry, exponential backoff, graceful
 failures
 - Real-Time Updates: Gallery polls every 10s for status changes
 - Production-Ready: Comprehensive testing, rollback plan, deployment
  checklist

 Estimated Timeline: 15 hours (~2 days) from start to production
 deployment.

 Ready to execute! 🚀