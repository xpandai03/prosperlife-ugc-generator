import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Sparkles, Home, XCircle } from "lucide-react";

interface CaptionSettings {
  systemPrompt: string;
  autoGenerate: boolean;
}

export default function CaptionSettingsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);

  // Fetch current caption settings
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery<CaptionSettings>({
    queryKey: ["/api/user/caption-settings"],
  });

  // Initialize local state when data loads
  useEffect(() => {
    if (settings) {
      setSystemPrompt(settings.systemPrompt);
      setAutoGenerate(settings.autoGenerate);
    }
  }, [settings]);

  // Update caption settings mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/user/caption-settings", {
        systemPrompt,
        autoGenerate,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || "Failed to save settings");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/caption-settings"] });
      toast({
        title: "Settings saved! ✨",
        description: "Your caption preferences have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  const handleBackToHome = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-8 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-8 w-8" />
              Caption Assistant
            </h1>
            <p className="text-gray-400 mt-1">
              Configure AI-powered caption generation for your posts
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleBackToHome}
            className="text-white border-white/20 hover:bg-white/10"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load caption settings. Please refresh the page.
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Card */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Caption Generation Settings</CardTitle>
            <CardDescription className="text-gray-400">
              Customize how AI generates captions for your Instagram posts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              // Loading skeleton
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[300px]" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
              </div>
            ) : (
              <>
                {/* Auto-generate toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                  <div className="space-y-1">
                    <Label htmlFor="auto-generate" className="text-white font-medium">
                      Auto-generate captions
                    </Label>
                    <p className="text-sm text-gray-400">
                      Automatically generate captions when posting with an empty caption field
                    </p>
                  </div>
                  <Switch
                    id="auto-generate"
                    checked={autoGenerate}
                    onCheckedChange={setAutoGenerate}
                  />
                </div>

                {/* System prompt textarea */}
                <div className="space-y-2">
                  <Label htmlFor="system-prompt" className="text-white font-medium">
                    Caption Style (System Prompt)
                  </Label>
                  <p className="text-sm text-gray-400 mb-2">
                    Customize the AI's writing style. The AI will follow these instructions when
                    generating captions.
                  </p>
                  <Textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    maxLength={1000}
                    placeholder="Write an engaging Instagram caption for this video. Be creative, use relevant emojis, and include a call-to-action."
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 resize-none"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-gray-400">
                      Examples: "Write casual captions with lots of emojis" or "Write professional
                      LinkedIn-style captions"
                    </p>
                    <p className={systemPrompt.length > 900 ? "text-yellow-500" : "text-gray-400"}>
                      {systemPrompt.length} / 1000 characters
                    </p>
                  </div>
                </div>

                {/* Save button */}
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="text-blue-100 font-medium">How it works:</p>
                <ul className="text-blue-200/80 space-y-1 list-disc list-inside">
                  <li>
                    With auto-generate ON: Leave caption empty when posting, and AI will create one
                    for you
                  </li>
                  <li>Click "Generate with AI" button in the posting modal to preview and edit</li>
                  <li>Manual captions always take priority over auto-generation</li>
                  <li>All generated captions are editable before posting</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
