import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Video, Sparkles, Zap, TrendingUp, ListVideo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function HomePage() {
  const [urls, setUrls] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createBulkVideoMutation = useMutation({
    mutationFn: async (videoUrls: string[]) => {
      const response = await apiRequest("POST", "/api/videos/bulk", { 
        urls: videoUrls,
        autoExport: true // Enable auto-export by default
      });
      return response as { 
        tasks: Array<{ taskId: string; status: string; url: string }>, 
        failures: Array<{ url: string; error: string }>,
        successCount: number, 
        failureCount: number 
      };
    },
    onSuccess: (data) => {
      const { successCount, failureCount, failures } = data;
      
      if (failureCount > 0 && failures && failures.length > 0) {
        // Show detailed error for failures
        const failedUrls = failures.map(f => f.url).join(', ');
        toast({
          title: `Partially Successful`,
          description: `${successCount} video${successCount !== 1 ? 's' : ''} submitted. ${failureCount} failed: ${failedUrls.substring(0, 50)}${failedUrls.length > 50 ? '...' : ''}`,
          variant: failureCount === data.tasks.length + failureCount ? "destructive" : "default",
        });
      } else {
        toast({
          title: `Processing Started`,
          description: `${successCount} video${successCount !== 1 ? 's' : ''} submitted successfully.`,
        });
      }
      
      setUrls("");
      setLocation("/videos");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start processing. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!urls.trim()) {
      toast({
        title: "URLs Required",
        description: "Please enter at least one video URL.",
        variant: "destructive",
      });
      return;
    }

    // Parse URLs (one per line)
    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urlList.length === 0) {
      toast({
        title: "No Valid URLs",
        description: "Please enter at least one valid URL.",
        variant: "destructive",
      });
      return;
    }

    // Validate all URLs
    const invalidUrls = urlList.filter(url => !url.match(/^https?:\/\/.+/));
    if (invalidUrls.length > 0) {
      toast({
        title: "Invalid URLs",
        description: `${invalidUrls.length} URL${invalidUrls.length !== 1 ? 's are' : ' is'} invalid. Please use HTTP/HTTPS URLs.`,
        variant: "destructive",
      });
      return;
    }

    createBulkVideoMutation.mutate(urlList);
  };

  const urlCount = urls.split('\n').filter(url => url.trim().length > 0).length;

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
            Transform your long-form videos into viral-ready shorts with AI-powered analysis
          </p>
        </div>

        <Card data-testid="card-url-input">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListVideo className="h-5 w-5" />
              Submit Video URLs
            </CardTitle>
            <CardDescription>
              Enter one or more video URLs (one per line) to generate short clips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="video-urls">Video URLs</Label>
                <Textarea
                  id="video-urls"
                  placeholder="https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=...&#10;https://youtu.be/..."
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  className="min-h-32 text-base font-mono resize-y"
                  data-testid="input-video-urls"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Supports YouTube, S3, Google Cloud Storage, and public HTTP/HTTPS URLs
                  </p>
                  {urlCount > 0 && (
                    <p className="text-xs font-medium text-primary">
                      {urlCount} URL{urlCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={createBulkVideoMutation.isPending}
                data-testid="button-submit-urls"
              >
                {createBulkVideoMutation.isPending ? (
                  <>Processing {urlCount} video{urlCount !== 1 ? 's' : ''}...</>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Shorts {urlCount > 0 ? `(${urlCount})` : ''}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-card border border-card-border">
            <Zap className="h-6 w-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium text-foreground mb-1">AI-Powered</h3>
            <p className="text-xs text-muted-foreground">Automatic clip selection</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-card border border-card-border">
            <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium text-foreground mb-1">Virality Score</h3>
            <p className="text-xs text-muted-foreground">Ranked by engagement potential</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-card border border-card-border">
            <ListVideo className="h-6 w-6 text-primary mx-auto mb-2" />
            <h3 className="text-sm font-medium text-foreground mb-1">Bulk Processing</h3>
            <p className="text-xs text-muted-foreground">Submit multiple videos at once</p>
          </div>
        </div>
      </div>
    </div>
  );
}
