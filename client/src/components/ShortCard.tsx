import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Play, Sparkles } from "lucide-react";
import { VideoPreview } from "./VideoPreview";
import { PostToSocialButton } from "./PostToSocialButton";
import type { Project, Export } from "@shared/schema";

interface ShortCardProps {
  project: Project;
  exportData?: Export;
  onExport?: (projectId: string) => void;
  isExporting?: boolean;
}

export function ShortCard({ project, exportData, onExport, isExporting }: ShortCardProps) {
  const getViralityColor = (score: number | null) => {
    if (!score) return "bg-muted-foreground/10 text-muted-foreground";
    if (score >= 80) return "bg-chart-3/10 text-chart-3 border-chart-3/20";
    if (score >= 60) return "bg-chart-4/10 text-chart-4 border-chart-4/20";
    if (score >= 40) return "bg-chart-2/10 text-chart-2 border-chart-2/20";
    return "bg-muted/50 text-muted-foreground";
  };

  const canDownload = exportData?.status === "ready" && exportData.srcUrl;
  const isProcessingExport = exportData?.status === "processing" || isExporting;
  const hasVideo = exportData?.srcUrl;

  return (
    <Card className="overflow-hidden" data-testid={`card-short-${project.id}`}>
      {hasVideo ? (
        <div className="relative">
          <VideoPreview src={exportData.srcUrl!} title={project.name} />
          {project.viralityScore !== null && (
            <div className="absolute top-3 right-3 z-10">
              <Badge className={`gap-1.5 ${getViralityColor(project.viralityScore)}`} data-testid={`badge-virality-${project.id}`}>
                <Sparkles className="h-3 w-3" />
                <span className="text-xs font-semibold">{project.viralityScore}%</span>
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-[9/16] bg-muted relative group">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center group-hover:bg-primary/80 transition-colors">
              <Play className="h-7 w-7 text-foreground group-hover:text-primary-foreground transition-colors" />
            </div>
          </div>
          {project.viralityScore !== null && (
            <div className="absolute top-3 right-3">
              <Badge className={`gap-1.5 ${getViralityColor(project.viralityScore)}`} data-testid={`badge-virality-${project.id}`}>
                <Sparkles className="h-3 w-3" />
                <span className="text-xs font-semibold">{project.viralityScore}%</span>
              </Badge>
            </div>
          )}
        </div>
      )}
      
      <CardContent className="p-4">
        <h4 className="text-sm font-medium text-foreground line-clamp-2">
          {project.name}
        </h4>
        {project.viralityScore !== null && (
          <p className="text-xs text-muted-foreground mt-1">
            Virality Score: {project.viralityScore}/100
          </p>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex gap-2">
        {canDownload ? (
          <>
            <Button
              asChild
              className="flex-1"
              size="sm"
              data-testid={`button-download-${project.id}`}
            >
              <a href={exportData.srcUrl!} target="_blank" rel="noopener noreferrer" download>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
            <PostToSocialButton
              projectId={project.id}
              exportUrl={exportData?.srcUrl || null}
              disabled={exportData?.status !== 'ready'}
            />
          </>
        ) : onExport ? (
          <Button
            onClick={() => onExport(project.id)}
            disabled={isProcessingExport || (exportData?.status === "processing")}
            className="flex-1"
            size="sm"
            data-testid={`button-export-${project.id}`}
          >
            {isProcessingExport ? (
              <>Processing...</>
            ) : exportData?.status === "error" ? (
              <>Failed - Retry</>
            ) : exportData?.status === "processing" ? (
              <>Processing...</>
            ) : (
              <>Export Short</>
            )}
          </Button>
        ) : (
          <Button
            disabled
            className="flex-1"
            size="sm"
            variant="outline"
          >
            {exportData?.status === "processing" ? "Exporting..." : "Exported"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
