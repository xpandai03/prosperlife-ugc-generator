/**
 * Content Engine Page (Jan 2026)
 *
 * Pilot UI for the Content Engine feature:
 * - Create and manage Channel Configs (content direction settings)
 * - Generate SceneSpecs from configs
 * - Trigger video rendering
 * - View status and results
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WaveBackground } from "@/components/ui/wave-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sparkles,
  Video,
  Loader2,
  Plus,
  Play,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ==================== TYPES ====================

interface ChannelConfig {
  id: string;
  userId: string;
  name: string;
  niche: string;
  tone: string;
  cadence?: string;
  rendererPreference: 'automation' | 'code_based';
  defaultDuration: number;
  extraDirectives?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SceneObject {
  order: number;
  voiceoverText: string;
  visualIntent: string;
  durationHint?: number | null;
  styleHints?: Record<string, any> | null;
}

interface SceneSpec {
  id: string;
  channelConfigId: string;
  userId: string;
  status: 'draft' | 'approved' | 'rendering' | 'rendered' | 'posted' | 'failed';
  title: string;
  description?: string;
  tags?: string[];
  targetDuration: number;
  scenes: SceneObject[];
  rendererType: 'automation' | 'code_based';
  mediaAssetId?: string;
  metadata?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  renderedAt?: string;
}

// ==================== STATUS BADGE ====================

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    draft: { variant: 'secondary', icon: <Clock className="w-3 h-3 mr-1" /> },
    approved: { variant: 'outline', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
    rendering: { variant: 'default', icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" /> },
    rendered: { variant: 'default', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
    posted: { variant: 'default', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
    failed: { variant: 'destructive', icon: <XCircle className="w-3 h-3 mr-1" /> },
  };

  const config = variants[status] || variants.draft;

  return (
    <Badge variant={config.variant} className="flex items-center">
      {config.icon}
      {status}
    </Badge>
  );
}

// ==================== MAIN COMPONENT ====================

export default function ContentEnginePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [specDetailOpen, setSpecDetailOpen] = useState(false);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState<SceneSpec | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Form states for new config
  const [newConfig, setNewConfig] = useState({
    name: '',
    niche: '',
    tone: '',
    cadence: '',
    defaultDuration: 20, // Max provider limit
    rendererPreference: 'automation' as const,
  });

  // Selected config for generation
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  // ==================== QUERIES ====================

  // Fetch channel configs
  const { data: configsData, isLoading: configsLoading } = useQuery<{ configs: ChannelConfig[] }>({
    queryKey: ['/api/content-engine/configs'],
  });

  // Fetch scene specs with polling for rendering status
  const { data: specsData, isLoading: specsLoading } = useQuery<{ specs: SceneSpec[] }>({
    queryKey: ['/api/content-engine/specs'],
    refetchInterval: (data) => {
      const hasRendering = data?.specs?.some(s => s.status === 'rendering');
      return hasRendering ? 5000 : false;
    },
  });

  // ==================== MUTATIONS ====================

  // Create channel config
  const createConfigMutation = useMutation({
    mutationFn: async (config: typeof newConfig) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/content-engine/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create config');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-engine/configs'] });
      setConfigDialogOpen(false);
      setNewConfig({ name: '', niche: '', tone: '', cadence: '', defaultDuration: 60, rendererPreference: 'automation' });
      toast({ title: 'Config created', description: 'Channel config created successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Generate SceneSpec
  const generateSpecMutation = useMutation({
    mutationFn: async (channelConfigId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/content-engine/generate-spec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ channelConfigId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate spec');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-engine/specs'] });
      toast({ title: 'SceneSpec generated', description: 'New content spec created successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Generation failed', description: error.message, variant: 'destructive' });
    },
  });

  // Render SceneSpec
  const renderSpecMutation = useMutation({
    mutationFn: async (specId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/content-engine/render/${specId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ provider: 'veo3' }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start render');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-engine/specs'] });
      toast({ title: 'Render started', description: 'Video rendering has begun. This may take a few minutes.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Render failed', description: error.message, variant: 'destructive' });
    },
  });

  // Delete config
  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/content-engine/configs/${configId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete config');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-engine/configs'] });
      toast({ title: 'Config deleted', description: 'Channel config deleted successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ==================== RENDER ====================

  const configs = configsData?.configs || [];
  const specs = specsData?.specs || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <WaveBackground />

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-400" />
            Content Engine
          </h1>
          <p className="text-slate-400">
            Generate and render video content from structured scene specifications.
          </p>
        </div>

        <Tabs defaultValue="configs" className="space-y-6">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="configs" className="data-[state=active]:bg-purple-600">
              <Settings className="w-4 h-4 mr-2" />
              Channel Configs
            </TabsTrigger>
            <TabsTrigger value="specs" className="data-[state=active]:bg-purple-600">
              <Video className="w-4 h-4 mr-2" />
              Scene Specs
            </TabsTrigger>
          </TabsList>

          {/* ==================== CONFIGS TAB ==================== */}
          <TabsContent value="configs" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Your Channel Configs</h2>
              <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    New Config
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create Channel Config</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Define your content direction settings.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label className="text-slate-300">Name</Label>
                      <Input
                        value={newConfig.name}
                        onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                        placeholder="e.g., Productivity Channel"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Niche</Label>
                      <Input
                        value={newConfig.niche}
                        onChange={(e) => setNewConfig({ ...newConfig, niche: e.target.value })}
                        placeholder="e.g., productivity tips, fitness motivation"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Tone</Label>
                      <Input
                        value={newConfig.tone}
                        onChange={(e) => setNewConfig({ ...newConfig, tone: e.target.value })}
                        placeholder="e.g., casual, friendly, motivational"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Cadence (optional)</Label>
                      <Input
                        value={newConfig.cadence}
                        onChange={(e) => setNewConfig({ ...newConfig, cadence: e.target.value })}
                        placeholder="e.g., daily, 3x per week"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Default Duration (seconds)</Label>
                      <Select
                        value={String(newConfig.defaultDuration)}
                        onValueChange={(v) => setNewConfig({ ...newConfig, defaultDuration: parseInt(v) })}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="10">10 seconds</SelectItem>
                          <SelectItem value="15">15 seconds</SelectItem>
                          <SelectItem value="20">20 seconds (max)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">Provider limit: max 20s per video</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createConfigMutation.mutate(newConfig)}
                      disabled={createConfigMutation.isPending || !newConfig.name || !newConfig.niche || !newConfig.tone}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {createConfigMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Create Config
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {configsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : configs.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Settings className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                  <p className="text-slate-400">No channel configs yet. Create one to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {configs.map((config) => (
                  <Card key={config.id} className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-white text-lg">{config.name}</CardTitle>
                          <CardDescription className="text-slate-400">{config.niche}</CardDescription>
                        </div>
                        <Badge variant={config.isActive ? 'default' : 'secondary'}>
                          {config.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-slate-400">
                        <p><span className="text-slate-500">Tone:</span> {config.tone}</p>
                        <p><span className="text-slate-500">Duration:</span> {config.defaultDuration}s</p>
                        {config.cadence && <p><span className="text-slate-500">Cadence:</span> {config.cadence}</p>}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedConfigId(config.id);
                            generateSpecMutation.mutate(config.id);
                          }}
                          disabled={generateSpecMutation.isPending && selectedConfigId === config.id}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {generateSpecMutation.isPending && selectedConfigId === config.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-1" />
                          )}
                          Generate Spec
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteConfigMutation.mutate(config.id)}
                          disabled={deleteConfigMutation.isPending}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ==================== SPECS TAB ==================== */}
          <TabsContent value="specs" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Generated Scene Specs</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/content-engine/specs'] })}
                className="border-slate-600 text-slate-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {specsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : specs.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Video className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                  <p className="text-slate-400">No scene specs yet. Generate one from a channel config.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {specs.map((spec) => (
                  <Card key={spec.id} className="bg-slate-800/50 border-slate-700">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-medium">{spec.title}</h3>
                            <StatusBadge status={spec.status} />
                          </div>
                          <p className="text-slate-400 text-sm mb-2">{spec.description}</p>
                          <div className="flex gap-4 text-xs text-slate-500">
                            <span>{spec.scenes?.length || 0} scenes</span>
                            <span>{spec.targetDuration}s duration</span>
                            <span>{formatDistanceToNow(new Date(spec.createdAt))} ago</span>
                          </div>
                          {spec.errorMessage && (
                            <p className="text-red-400 text-sm mt-2">{spec.errorMessage}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSpec(spec);
                              setSpecDetailOpen(true);
                            }}
                            className="border-slate-600 text-slate-300"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {['draft', 'approved'].includes(spec.status) && (
                            <Button
                              size="sm"
                              onClick={() => renderSpecMutation.mutate(spec.id)}
                              disabled={renderSpecMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {renderSpecMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4 mr-1" />
                              )}
                              Render
                            </Button>
                          )}
                          {spec.status === 'rendered' && spec.mediaAssetId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                // Fetch the media asset to get the video URL
                                try {
                                  const authHeaders = await getAuthHeaders();
                                  const response = await fetch(`/api/ai/media/${spec.mediaAssetId}`, {
                                    headers: authHeaders,
                                  });
                                  if (response.ok) {
                                    const data = await response.json();
                                    if (data.asset?.resultUrl) {
                                      setPreviewVideoUrl(data.asset.resultUrl);
                                      setSelectedSpec(spec);
                                      setVideoPreviewOpen(true);
                                    }
                                  }
                                } catch (error) {
                                  console.error('Failed to fetch video:', error);
                                  toast({ title: 'Error', description: 'Failed to load video', variant: 'destructive' });
                                }
                              }}
                              className="border-green-600 text-green-400"
                            >
                              <Video className="w-4 h-4 mr-1" />
                              View Video
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ==================== SPEC DETAIL DIALOG ==================== */}
        <Dialog open={specDetailOpen} onOpenChange={setSpecDetailOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">{selectedSpec?.title}</DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedSpec?.description}
              </DialogDescription>
            </DialogHeader>
            {selectedSpec && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <StatusBadge status={selectedSpec.status} />
                  <span className="text-slate-500 text-sm">
                    {selectedSpec.targetDuration}s | {selectedSpec.scenes?.length || 0} scenes
                  </span>
                </div>

                {selectedSpec.tags && selectedSpec.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSpec.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-white font-medium">Scenes</h4>
                  {selectedSpec.scenes?.map((scene: SceneObject, index: number) => (
                    <Card key={index} className="bg-slate-800 border-slate-700">
                      <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="mt-1">
                            {scene.order}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-slate-300 text-sm mb-2">
                              <span className="text-slate-500">Voiceover:</span> "{scene.voiceoverText}"
                            </p>
                            <p className="text-slate-400 text-xs">
                              <span className="text-slate-500">Visual:</span> {scene.visualIntent}
                            </p>
                            {scene.durationHint && (
                              <p className="text-slate-500 text-xs mt-1">~{scene.durationHint}s</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ==================== VIDEO PREVIEW DIALOG ==================== */}
        <Dialog open={videoPreviewOpen} onOpenChange={setVideoPreviewOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-white">{selectedSpec?.title}</DialogTitle>
              <DialogDescription className="text-slate-400">
                Rendered video preview
              </DialogDescription>
            </DialogHeader>
            {previewVideoUrl && (
              <div className="py-4">
                <video
                  src={previewVideoUrl}
                  controls
                  autoPlay
                  className="w-full rounded-lg bg-black"
                  style={{ maxHeight: '60vh' }}
                >
                  Your browser does not support the video tag.
                </video>
                <div className="flex justify-between items-center mt-4">
                  <p className="text-slate-500 text-sm">
                    Duration: {selectedSpec?.targetDuration}s target
                  </p>
                  <a
                    href={previewVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 text-sm hover:underline"
                  >
                    Open in new tab
                  </a>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
