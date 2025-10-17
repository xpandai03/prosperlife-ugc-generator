import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Video, Sparkles, Zap, TrendingUp, ListVideo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function HomePage() {
  const [urls, setUrls] = useState("");
  const [email, setEmail] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const processVideoMutation = useMutation({
    mutationFn: async (videoUrl: string) => {
      const response = await apiRequest("POST", "/api/process-video", {
        url: videoUrl,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      console.log(data);
      toast({
        title: "Processing Started",
        description:
          "Your video is being converted. This may take several minutes.",
      });

      setUrls("");
      setTimeout(() => {
        setLocation(`/details/${data.taskId}`);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to start processing. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!urls.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a video URL.",
        variant: "destructive",
      });
      return;
    }

    const url = urls.trim();

    // Validate URL
    if (!url.match(/^https?:\/\/.+/)) {
      toast({
        title: "Invalid URL",
        description: "Please use a valid HTTP/HTTPS URL.",
        variant: "destructive",
      });
      return;
    }

    processVideoMutation.mutate(url);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            YouTube to Shorts Converter
          </h1>
          <p className="text-muted-foreground">
            Transform your long-form videos into viral-ready shorts with
            AI-powered analysis
          </p>
        </div>

        <Card data-testid="card-url-input">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Submit Video URL
            </CardTitle>
            <CardDescription>
              Enter a YouTube or video URL to generate viral-ready short clips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="video-urls">Video URL</Label>
                <Textarea
                  id="video-urls"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  className="min-h-24 text-base font-mono resize-none"
                  data-testid="input-video-urls"
                />
                <p className="text-xs text-muted-foreground">
                  Supports YouTube, S3, Google Cloud Storage, and public
                  HTTP/HTTPS URLs
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">
                  We'll notify you when your video is ready
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={processVideoMutation.isPending}
                data-testid="button-submit-urls"
              >
                {processVideoMutation.isPending ? (
                  <>Processing Video...</>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Convert to Shorts
                  </>
                )}
              </Button>

              <Button
                asChild
                variant="outline"
                className="w-full h-12 text-base"
                data-testid="button-view-videos"
              >
                <Link href="/videos">
                  <ListVideo className="h-5 w-5 mr-2" />
                  View All Videos
                </Link>
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-card border border-card-border">
            <Zap className="h-6 w-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium text-foreground mb-1">
              AI-Powered
            </h3>
            <p className="text-xs text-muted-foreground">
              Automatic clip selection
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-card border border-card-border">
            <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium text-foreground mb-1">
              Virality Score
            </h3>
            <p className="text-xs text-muted-foreground">
              Ranked by engagement potential
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-card border border-card-border">
            <Video className="h-6 w-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium text-foreground mb-1">
              Auto-Export
            </h3>
            <p className="text-xs text-muted-foreground">
              Automatic conversion & export
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
