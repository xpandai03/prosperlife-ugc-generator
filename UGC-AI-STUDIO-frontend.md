PHASE 4.4: AI STUDIO FRONTEND IMPLEMENTATION PLAN

 📋 Overview

 Goal: Build a complete AI Studio frontend page (/ai-studio) that
 connects to Phase 4.3 backend APIs for AI image/video generation,
 integrated with existing caption and scheduling features.

 Time Estimate: 4-5 hours

 Stack: React 18 + TypeScript + TanStack Query v5 + Wouter + Radix UI
  + Tailwind CSS

 ---
 🎯 What We're Building

 A new page at /ai-studio with:
 1. Generation Form - Prompt input, provider selector, generate
 button
 2. Media Gallery - Grid view of all user's generated assets
 3. Status Updates - Real-time polling (10s interval) for processing
 status
 4. Media Preview Cards - Image/video display with actions (Caption,
 Post, Download)
 5. Usage Limits - Free tier enforcement (10/month) with upgrade
 dialog
 6. Integration - Connect to Phase 2 (captions) and Phase 3
 (scheduling)

 ---
 📁 File Structure

 New Files (2)

 client/src/
 ├── pages/
 │   └── AIStudioPage.tsx          (NEW - Main page, ~300 lines)
 └── components/
     └── MediaPreviewCard.tsx      (NEW - Gallery card, ~200 lines)

 Modified Files (3)

 client/src/
 ├── App.tsx                        (ADD /ai-studio route)
 ├── components/
 │   ├── ui/mini-navbar.tsx        (ADD nav link)
 │   └── LimitReachedDialog.tsx    (ADD "media" limitType support)

 ---
 🔧 Phase 4.4.1: Create AIStudioPage Component (90 min)

 File: client/src/pages/AIStudioPage.tsx

 Key Features:
 - Black background with WaveBackground component
 - Glass-morphism generation form card (top section)
 - Gallery grid below (responsive: 1 col mobile, 2 cols tablet, 3
 cols desktop)
 - TanStack Query for data fetching with 10s polling
 - Form validation (10-1000 chars, provider/type combinations)
 - Loading/Empty/Error states

 State Management:
 const [prompt, setPrompt] = useState("");
 const [provider, setProvider] = useState<string>("kie-4o-image");
 const [type, setType] = useState<'image' | 'video'>('image');
 const [referenceImageUrl, setReferenceImageUrl] = useState("");
 const [showLimitDialog, setShowLimitDialog] = useState(false);

 Queries/Mutations:
 // Gallery data with polling
 const { data: gallery, isLoading } = useQuery<{ assets: MediaAsset[]
  }>({
   queryKey: ['/api/ai/media'],
   refetchInterval: 10000, // 10s polling for status updates
 });

 // Generation mutation
 const generateMutation = useMutation({
   mutationFn: async (params) => {
     const res = await apiRequest('POST', '/api/ai/generate-media',
 params);
     return await res.json();
   },
   onSuccess: () => {
     setPrompt(""); // Clear form
     queryClient.invalidateQueries({ queryKey: ['/api/ai/media'] });
     toast({ title: 'Generation started! ✨' });
   },
   onError: (error: any) => {
     if (error.message.includes('limit')) {
       setShowLimitDialog(true);
     } else {
       toast({ title: 'Failed', description: error.message, variant:
 'destructive' });
     }
   },
 });

 UI Structure:
 <div className="min-h-screen bg-black">
   <WaveBackground />

   <div className="relative z-50 max-w-7xl mx-auto px-4 md:px-6 
 lg:px-8 pt-24 pb-12">
     {/* Header */}
     <div className="mb-8">
       <h1 className="text-3xl font-bold text-white mb-2">AI
 Studio</h1>
       <p className="text-white/70">Generate images and videos with
 AI</p>
     </div>

     {/* Generation Form Card */}
     <Card className="bg-white/10 backdrop-blur-md border-white/20 
 mb-12">
       <CardContent className="p-6">
         <form onSubmit={handleGenerate} className="space-y-6">
           {/* Type Selector (Image/Video) */}
           <div className="flex gap-4">
             <Button
               type="button"
               variant={type === 'image' ? 'default' : 'outline'}
               onClick={() => handleTypeChange('image')}
             >
               <Image className="h-4 w-4 mr-2" />
               Image
             </Button>
             <Button
               type="button"
               variant={type === 'video' ? 'default' : 'outline'}
               onClick={() => handleTypeChange('video')}
             >
               <Video className="h-4 w-4 mr-2" />
               Video
             </Button>
           </div>

           {/* Provider Selector */}
           <div className="space-y-2">
             <Label className="text-white">AI Provider</Label>
             <Select value={provider} onValueChange={setProvider}>
               <SelectTrigger className="bg-white/10 border-white/20 
 text-white">
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

           {/* Prompt Input */}
           <div className="space-y-2">
             <Label className="text-white">Prompt</Label>
             <Textarea
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               placeholder="Describe your vision... (10-1000
 characters)"
               rows={4}
               maxLength={1000}
               className="bg-white/10 border-white/20 text-white
 placeholder:text-white/50"
             />
             <p className="text-xs text-white/50">{prompt.length} /
 1000</p>
           </div>

           {/* Generate Button */}
           <Button
             type="submit"
             className="w-full"
             disabled={generateMutation.isPending || prompt.length < 
 10}
           >
             {generateMutation.isPending ? (
               <>
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 Generating...
               </>
             ) : (
               <>
                 <Sparkles className="h-4 w-4 mr-2" />
                 Generate
               </>
             )}
           </Button>
         </form>
       </CardContent>
     </Card>

     {/* Gallery Section */}
     <div>
       <h2 className="text-2xl font-semibold text-white mb-6">Your
 Generations</h2>

       {isLoading && (
         <div className="flex justify-center py-12">
           <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
         </div>
       )}

       {!isLoading && (!gallery?.assets || gallery.assets.length ===
 0) && (
         <div className="text-center py-16">
           <div className="inline-flex items-center justify-center 
 w-20 h-20 rounded-2xl bg-white/5 mb-6">
             <Sparkles className="h-10 w-10 text-gray-400" />
           </div>
           <h3 className="text-xl font-medium text-white mb-2">No
 generations yet</h3>
           <p className="text-gray-400">Create your first
 AI-generated media above</p>
         </div>
       )}

       {gallery?.assets && gallery.assets.length > 0 && (
         <div className="grid grid-cols-1 md:grid-cols-2 
 lg:grid-cols-3 gap-6">
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
     limitType="media"
     limit={10}
   />
 </div>

 Helper Functions:
 const handleTypeChange = (newType: 'image' | 'video') => {
   setType(newType);
   if (newType === 'video') {
     setProvider('kie-veo3'); // Only video provider
   } else {
     setProvider('kie-4o-image'); // Default image provider
   }
 };

 const handleGenerate = async (e: React.FormEvent) => {
   e.preventDefault();

   if (prompt.length < 10 || prompt.length > 1000) {
     toast({
       title: 'Invalid prompt',
       description: 'Prompt must be 10-1000 characters',
       variant: 'destructive'
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

 ---
 🃏 Phase 4.4.2: Create MediaPreviewCard Component (60 min)

 File: client/src/components/MediaPreviewCard.tsx

 Key Features:
 - Displays image or video preview
 - Status badge (processing/ready/error)
 - Action buttons (Generate Caption, Schedule Post, Download)
 - Integrates with Phase 2 (caption generation) and Phase 3
 (scheduling)
 - Truncated prompt display with tooltip

 Component Structure:
 import { Card, CardContent, CardFooter } from
 "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Loader2, CheckCircle2, XCircle, Sparkles, Calendar,
 Download, Image as ImageIcon, Video as VideoIcon } from
 "lucide-react";

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

 export function MediaPreviewCard({ asset }: { asset: MediaAsset }) {
   const [showPostModal, setShowPostModal] = useState(false);

   return (
     <Card className="bg-white/5 backdrop-blur-md border-white/10 
 overflow-hidden">
       {/* Media Preview */}
       <div className="relative aspect-video bg-black/20">
         {asset.status === 'processing' && (
           <div className="absolute inset-0 flex flex-col 
 items-center justify-center">
             <Loader2 className="h-8 w-8 text-white animate-spin 
 mb-2" />
             <p className="text-sm text-white/70">Generating...</p>
           </div>
         )}

         {asset.status === 'ready' && asset.resultUrl && (
           <>
             {asset.type === 'image' && (
               <img
                 src={asset.resultUrl}
                 alt={asset.prompt}
                 className="w-full h-full object-cover"
               />
             )}
             {asset.type === 'video' && (
               <video
                 src={asset.resultUrl}
                 controls
                 className="w-full h-full"
                 preload="metadata"
               />
             )}
           </>
         )}

         {asset.status === 'error' && (
           <div className="absolute inset-0 flex flex-col 
 items-center justify-center bg-red-500/10">
             <XCircle className="h-8 w-8 text-red-400 mb-2" />
             <p className="text-sm text-red-300 px-4 text-center">
               {asset.errorMessage || 'Generation failed'}
             </p>
           </div>
         )}

         {/* Status Badge */}
         <div className="absolute top-3 right-3">
           <Badge
             variant={asset.status === 'ready' ? 'default' : 
 'secondary'}
             className="bg-black/60 backdrop-blur-sm"
           >
             {asset.status === 'processing' && <Loader2 
 className="h-3 w-3 mr-1 animate-spin" />}
             {asset.status === 'ready' && <CheckCircle2 
 className="h-3 w-3 mr-1" />}
             {asset.status === 'error' && <XCircle className="h-3 w-3
  mr-1" />}
             {asset.status}
           </Badge>
         </div>

         {/* Type Badge */}
         <div className="absolute top-3 left-3">
           <Badge variant="outline" className="bg-black/60 
 backdrop-blur-sm">
             {asset.type === 'image' ? (
               <><ImageIcon className="h-3 w-3 mr-1" />Image</>
             ) : (
               <><VideoIcon className="h-3 w-3 mr-1" />Video</>
             )}
           </Badge>
         </div>
       </div>

       {/* Card Content */}
       <CardContent className="p-4">
         <p className="text-sm text-white/90 line-clamp-2 mb-2">
           {asset.prompt}
         </p>
         <div className="flex items-center gap-2 text-xs 
 text-white/60">
           <span>{asset.provider}</span>
           <span>•</span>
           <span>{formatDistanceToNow(new Date(asset.createdAt), {
 addSuffix: true })}</span>
         </div>
       </CardContent>

       {/* Actions */}
       {asset.status === 'ready' && (
         <CardFooter className="p-4 pt-0 flex flex-wrap gap-2">
           <Button
             size="sm"
             variant="outline"
             className="flex-1"
             onClick={() => setShowPostModal(true)}
           >
             <Calendar className="h-3 w-3 mr-1" />
             Post
           </Button>

           <Button
             size="sm"
             variant="outline"
             className="flex-1"
             asChild
           >
             <a href={asset.resultUrl} download target="_blank" 
 rel="noopener noreferrer">
               <Download className="h-3 w-3 mr-1" />
               Download
             </a>
           </Button>
         </CardFooter>
       )}

       {/* Post Modal (reuse existing PostClipModal or create 
 MediaPostModal) */}
       {showPostModal && (
         <PostClipModal
           isOpen={showPostModal}
           onClose={() => setShowPostModal(false)}
           projectId={asset.id}
           exportUrl={asset.resultUrl}
         />
       )}
     </Card>
   );
 }

 ---
 🔀 Phase 4.4.3: Update App.tsx Routing (15 min)

 File: client/src/App.tsx

 Changes:
 // ADD import
 import AIStudioPage from "@/pages/AIStudioPage";

 // ADD route (after /videos route)
 <Route path="/ai-studio">
   <ProtectedRoute>
     <AIStudioPage />
   </ProtectedRoute>
 </Route>

 Full Context (for placement):
 <Route path="/videos">
   <ProtectedRoute>
     <VideoListPage />
   </ProtectedRoute>
 </Route>

 {/* ADD THIS */}
 <Route path="/ai-studio">
   <ProtectedRoute>
     <AIStudioPage />
   </ProtectedRoute>
 </Route>

 <Route path="/socials">
   <ProtectedRoute>
     <SocialAccountsPage />
   </ProtectedRoute>
 </Route>

 ---
 🧭 Phase 4.4.4: Update Mini Navbar (10 min)

 File: client/src/components/ui/mini-navbar.tsx

 Changes:
 // ADD import
 import { Sparkles } from "lucide-react";

 // UPDATE navLinksData array
 const navLinksData = [
   { label: 'My Videos', href: '/videos' },
   { label: 'AI Studio', href: '/ai-studio' }, // ADD THIS
   { label: 'Socials', href: '/socials' },
   { label: 'Pricing', href: '/pricing' },
   { label: 'Settings', href: '/settings/billing' },
 ];

 ---
 🚫 Phase 4.4.5: Update LimitReachedDialog (15 min)

 File: client/src/components/LimitReachedDialog.tsx

 Changes:
 // UPDATE interface
 interface LimitReachedDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   limitType?: "video" | "post" | "media"; // ADD "media"
   current?: number;
   limit?: number;
 }

 // ADD media-specific messaging in component body
 const limitMessages = {
   video: {
     title: 'Video Limit Reached',
     description: 'You\'ve reached your free tier limit of 3 videos 
 per month.',
     benefits: [
       '✓ Unlimited video processing',
       '✓ Priority processing speed',
       '✓ Advanced clip selection',
     ]
   },
   post: {
     title: 'Post Limit Reached',
     description: 'You\'ve reached your free tier limit of 3 posts 
 per month.',
     benefits: [
       '✓ Unlimited social media posts',
       '✓ Advanced scheduling',
       '✓ Priority support',
     ]
   },
   media: { // ADD THIS
     title: 'Media Generation Limit Reached',
     description: 'You\'ve reached your free tier limit of 10 AI 
 generations per month.',
     benefits: [
       '✓ Unlimited AI image generation',
       '✓ Unlimited AI video generation',
       '✓ Priority generation queue',
     ]
   },
 };

 const message = limitMessages[limitType || 'video'];

 // Use message.title, message.description, message.benefits in JSX

 ---
 🧪 Phase 4.4.6: Testing & QA (90 min)

 Test Cases

 1. Generation Flow (Happy Path)
 - Open /ai-studio page
 - Page loads with form and empty gallery
 - Enter prompt "A futuristic cityscape at sunset" (10+ chars)
 - Select "KIE 4O Image" provider
 - Click "Generate"
 - Toast shows "Generation started! ✨"
 - Form clears
 - Gallery shows new card with "processing" status
 - After ~30s, card updates to "ready" with image preview
 - Image loads correctly

 2. Video Generation
 - Select "Video" type
 - Provider auto-switches to "KIE Veo3"
 - Enter prompt
 - Generate
 - Video card shows processing → ready
 - Video controls work (play/pause)

 3. Usage Limits (Free Tier)
 - Generate 10 images/videos
 - On 11th attempt, limit dialog appears
 - Dialog shows "10 generations/month" message
 - "Upgrade to Pro" button redirects to /pricing

 4. Error Handling
 - Test with invalid prompt (< 10 chars) → validation error
 - Test with API error → toast shows error message
 - Test with generation failure → card shows error state

 5. Integration with Phase 2 (Caption)
 - Click "Post" on ready card
 - PostClipModal opens with caption generation button
 - Caption generates correctly from media

 6. Integration with Phase 3 (Scheduling)
 - In PostClipModal, select "Schedule for later"
 - Pick future date/time
 - Post schedules correctly

 7. Navigation
 - "AI Studio" link appears in navbar
 - Clicking navigates to /ai-studio
 - Protected route redirects to /welcome if not logged in

 8. Responsive Design
 - Mobile (< 768px): 1 column gallery
 - Tablet (768-1024px): 2 column gallery
 - Desktop (> 1024px): 3 column gallery
 - Form fields responsive

 9. Status Polling
 - Gallery auto-updates every 10s
 - Processing cards update to ready automatically
 - No manual refresh needed

 10. Empty States
 - New user sees "No generations yet" message
 - After deleting all, empty state reappears

 ---
 📊 Phase 4.4.7: Performance Optimization (30 min)

 Image Optimization:
 // Add loading="lazy" for images
 <img
   src={asset.resultUrl}
   alt={asset.prompt}
   loading="lazy"
   className="w-full h-full object-cover"
 />

 Query Optimization:
 // Only poll when tab is active
 const { data: gallery } = useQuery({
   queryKey: ['/api/ai/media'],
   refetchInterval: 10000,
   refetchIntervalInBackground: false, // Don't poll in background
 });

 // Stop polling when no processing assets
 const hasProcessing = gallery?.assets.some(a => a.status ===
 'processing');
 refetchInterval: hasProcessing ? 10000 : false,

 Memoization:
 import { useMemo } from 'react';

 // Memoize filtered/sorted assets
 const sortedAssets = useMemo(() => {
   return gallery?.assets.sort((a, b) =>
     new Date(b.createdAt).getTime() - new
 Date(a.createdAt).getTime()
   ) || [];
 }, [gallery?.assets]);

 ---
 🚀 Deployment Checklist

 Pre-Deployment:
 - All TypeScript errors resolved (npm run check)
 - Build succeeds (npm run build)
 - No console errors in dev mode
 - All imports correct (no missing dependencies)

 Post-Deployment (Render):
 - Verify backend endpoints exist:
   - POST /api/ai/generate-media
   - GET /api/ai/media/:id
   - GET /api/ai/media
 - Test end-to-end flow on production
 - Monitor Render logs for errors
 - Test free tier limits (10 generations)
 - Test Pro user (unlimited)

 Environment Variables (No new vars needed):
 - ✅ KIE_API_KEY (already exists)
 - ✅ GEMINI_API_KEY (already exists)
 - ✅ OPENAI_API_KEY (for caption integration)

 ---
 📋 Success Criteria

 Phase 4.4 is complete when:
 1. ✅ /ai-studio page accessible and protected (auth required)
 2. ✅ Generation form validates and submits correctly
 3. ✅ Gallery displays all user's media assets
 4. ✅ Status polling updates cards every 10s
 5. ✅ Image and video previews work correctly
 6. ✅ Usage limits enforced (10/month free)
 7. ✅ Integration with caption generation works
 8. ✅ Integration with scheduling/posting works
 9. ✅ Navigation link appears in navbar
 10. ✅ Responsive design (mobile/tablet/desktop)
 11. ✅ No regressions in existing pages
 12. ✅ All TypeScript types correct
 13. ✅ Build succeeds without errors

 ---
 ⚠️ Important Notes

 DO NOT:
 - ❌ Modify existing pages (HomePage, VideoListPage, etc.)
 - ❌ Change existing API routes or contracts
 - ❌ Break backward compatibility
 - ❌ Modify Phase 2 (caption) or Phase 3 (scheduling) logic

 DO:
 - ✅ Reuse existing UI components (Card, Button, Input, etc.)
 - ✅ Follow existing patterns (WaveBackground, glass-morphism)
 - ✅ Use TanStack Query for all API calls
 - ✅ Handle loading/error/empty states consistently
 - ✅ Add comprehensive TypeScript types
 - ✅ Test on all screen sizes

 ---
 📦 Dependencies (Already Installed)

 No new npm packages needed:
 - ✅ React 18
 - ✅ TypeScript
 - ✅ TanStack Query v5
 - ✅ Wouter (routing)
 - ✅ Radix UI (components)
 - ✅ Tailwind CSS (styling)
 - ✅ Lucide React (icons)
 - ✅ date-fns (date formatting)

 ---
 🎯 Time Breakdown

 | Phase | Task                      | Time     |
 |-------|---------------------------|----------|
 | 4.4.1 | Create AIStudioPage       | 90 min   |
 | 4.4.2 | Create MediaPreviewCard   | 60 min   |
 | 4.4.3 | Update App.tsx routing    | 15 min   |
 | 4.4.4 | Update mini-navbar        | 10 min   |
 | 4.4.5 | Update LimitReachedDialog | 15 min   |
 | 4.4.6 | Testing & QA              | 90 min   |
 | 4.4.7 | Performance optimization  | 30 min   |
 | Total |                           | ~5 hours |

 ---
 ✅ Ready to Implement

 This plan provides:
 - ✅ Complete file structure
 - ✅ Exact component code patterns
 - ✅ API integration details
 - ✅ Comprehensive testing checklist
 - ✅ No breaking changes to existing features
 - ✅ Follows existing codebase conventions

 Shall we proceed with implementation?