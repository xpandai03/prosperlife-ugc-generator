import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { PollingIndicator } from "@/components/PollingIndicator";
import { ShortCard } from "@/components/ShortCard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import type { Task, Project, Export } from "@shared/schema";

interface VideoDetailResponse {
  task: Task;
  projects: Project[];
  exports: Export[];
}

export default function VideoDetailPage() {
  const [, params] = useRoute("/details/:id");
  const taskId = params?.id;
  const { toast } = useToast();
  const [isPolling, setIsPolling] = useState(false);

  const { data, isLoading } = useQuery<VideoDetailResponse>({
    queryKey: ["/api/videos", taskId],
    enabled: !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      
      const hasProcessing = data.task.status === "processing" || 
                           data.task.autoExportStatus === "processing" ||
                           data.exports.some(e => e.status === "processing");
      
      setIsPolling(hasProcessing);
      return hasProcessing ? 15000 : false;
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest("POST", `/api/videos/${taskId}/export`, { projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", taskId] });
      toast({
        title: "Export Started",
        description: "Your short is being exported. This may take a few moments.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to start export. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-medium text-foreground mb-2">Video Not Found</h2>
          <p className="text-muted-foreground mb-6">The requested video could not be found.</p>
          <Button asChild>
            <Link href="/videos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Videos
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { task, projects, exports } = data;
  
  // Determine unified pipeline status
  const isAutoExport = task.autoExportRequested === "true";
  const getPipelineStatus = () => {
    if (task.status === "processing") return "Converting video...";
    if (task.status === "error") return "Conversion failed";
    
    if (isAutoExport) {
      if (task.autoExportStatus === "processing") {
        const completedExports = exports.filter(e => e.status === "complete").length;
        const totalExports = projects.length;
        return totalExports > 0 ? `Exporting ${completedExports}/${totalExports} shorts...` : "Exporting...";
      }
      if (task.autoExportStatus === "complete") return "All shorts ready for download";
      if (task.autoExportStatus === "partial_error") return "Some exports failed";
      if (task.autoExportStatus === "error") return "Export failed";
      if (task.autoExportStatus === "pending" && task.status === "complete") return "Starting auto-export...";
    }
    
    if (task.status === "complete") return "Conversion complete";
    return task.status;
  };

  const pipelineStatus = getPipelineStatus();
  const showExportButtons = !isAutoExport && task.status === "complete";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild data-testid="button-back">
            <Link href="/videos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Videos
            </Link>
          </Button>
        </div>

        <Card className="mb-8" data-testid="card-task-details">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="mb-2">
                  {isAutoExport ? "Auto-Convert & Export" : "Video Processing Status"}
                </CardTitle>
                <CardDescription className="font-mono text-xs break-all">
                  {task.sourceVideoUrl}
                </CardDescription>
              </div>
              {isAutoExport && task.autoExportStatus ? (
                <StatusBadge status={task.autoExportStatus} />
              ) : (
                <StatusBadge status={task.status} />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isAutoExport ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{pipelineStatus}</p>
                  {task.autoExportStatus === "processing" && (
                    <p className="text-xs text-muted-foreground">
                      {exports.filter(e => e.status === "complete").length} of {projects.length} complete
                    </p>
                  )}
                </div>
                <ProgressBar 
                  status={task.autoExportStatus === "complete" || task.autoExportStatus === "partial_error" ? "complete" : "processing"} 
                />
              </div>
            ) : (
              <ProgressBar status={task.status} />
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pipeline Status</p>
                <p className="text-sm font-medium text-foreground capitalize">{pipelineStatus}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Submitted</p>
                <p className="text-sm font-medium text-foreground">
                  {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Task ID</p>
                <p className="text-sm font-medium text-foreground font-mono">{task.id.substring(0, 12)}...</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {isAutoExport && task.autoExportStatus === "complete" ? "Ready to Download" : "Shorts Generated"}
                </p>
                <p className="text-sm font-medium text-foreground">{projects.length}</p>
              </div>
            </div>

            {task.status === "error" && task.errorMessage && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium mb-1">Conversion Error</p>
                <p className="text-sm text-destructive/80">{task.errorMessage}</p>
              </div>
            )}

            {isAutoExport && task.autoExportStatus === "error" && task.autoExportError && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium mb-1">Export Error</p>
                <p className="text-sm text-destructive/80">{task.autoExportError}</p>
              </div>
            )}

            {isAutoExport && task.autoExportStatus === "partial_error" && task.autoExportError && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-500 font-medium mb-1">Partial Export Success</p>
                <p className="text-sm text-amber-600/80 dark:text-amber-500/80">{task.autoExportError}</p>
              </div>
            )}

            {isPolling && <PollingIndicator />}
          </CardContent>
        </Card>

        {projects.length > 0 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">Generated Shorts</h2>
              <p className="text-sm text-muted-foreground">
                {projects.length} short{projects.length !== 1 ? "s" : ""} extracted from your video
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-shorts">
              {projects.map((project) => {
                const exportData = exports.find(e => e.projectId === project.id);
                return (
                  <ShortCard
                    key={project.id}
                    project={project}
                    exportData={exportData}
                    onExport={showExportButtons ? exportMutation.mutate : undefined}
                    isExporting={exportMutation.isPending && exportMutation.variables === project.id}
                  />
                );
              })}
            </div>
          </div>
        )}

        {task.status === "complete" && projects.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Shorts Generated</h3>
              <p className="text-sm text-muted-foreground">
                The video was processed but no short clips were extracted.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
