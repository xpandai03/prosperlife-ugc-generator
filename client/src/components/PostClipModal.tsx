import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Sparkles } from 'lucide-react';

interface PostClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  exportUrl: string | null;
}

export function PostClipModal({
  isOpen,
  onClose,
  projectId,
  exportUrl
}: PostClipModalProps) {
  const [caption, setCaption] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // AI Caption Generation mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/caption/generate', {
        projectId,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to generate caption');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      setCaption(data.caption);
      toast({
        title: 'Caption generated! ✨',
        description: 'You can edit it before posting.',
      });
    },
    onError: (error: Error) => {
      console.error('Caption generation failed:', error);
      toast({
        title: 'Failed to generate caption',
        description: error.message || 'Using fallback caption.',
        variant: 'destructive',
      });
      // Set fallback caption
      setCaption('Check out my latest clip! 🎥✨');
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/social/post', {
        projectId,
        platform: 'instagram',
        caption,
      });

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts', projectId] });
    },
  });

  const handleGenerateCaption = () => {
    generateMutation.mutate();
  };

  const handlePost = () => {
    postMutation.mutate();
  };

  const handleClose = () => {
    if (!postMutation.isPending) {
      setCaption('');
      postMutation.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby="post-modal-description">
        <DialogHeader>
          <DialogTitle id="post-modal-title">Post Clip to Instagram</DialogTitle>
          <DialogDescription id="post-modal-description">
            Your clip will be posted as a Reel to Instagram. This typically takes 2-5 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {postMutation.isIdle && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="caption">Caption (optional)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateCaption}
                    disabled={generateMutation.isPending || postMutation.isPending}
                    className="text-xs h-7 gap-1"
                    aria-label="Generate caption with AI"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="caption"
                  placeholder="Add a caption or generate with AI..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={2200}
                  rows={4}
                  disabled={postMutation.isPending || generateMutation.isPending}
                  aria-label="Instagram Reel caption"
                  aria-describedby="caption-counter"
                />
                <p id="caption-counter" className="text-xs text-muted-foreground" role="status" aria-live="polite">
                  {caption.length} / 2200 characters
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  disabled={postMutation.isPending}
                  aria-label="Cancel and close modal"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePost}
                  disabled={postMutation.isPending || !exportUrl}
                  className="flex-1"
                  aria-label="Post clip to Instagram as a Reel"
                  aria-busy={postMutation.isPending}
                >
                  {postMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Posting...
                    </>
                  ) : (
                    'Post to Instagram'
                  )}
                </Button>
              </div>
            </>
          )}

          {postMutation.isSuccess && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20" role="status" aria-live="polite">
              <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
              <AlertDescription className="space-y-2">
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Successfully posted to Instagram!
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Your Reel has been published and should appear on Instagram shortly.
                </p>
                {postMutation.data.platformUrl && (
                  <Button
                    variant="link"
                    className="h-auto p-0 text-green-700"
                    asChild
                  >
                    <a
                      href={postMutation.data.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                      aria-label="View your post on Instagram in a new tab"
                    >
                      View on Instagram
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {postMutation.isError && (
            <Alert variant="destructive" role="alert" aria-live="assertive">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                <p className="font-semibold">Failed to post to Instagram</p>
                <p className="text-sm mt-1">
                  {postMutation.error instanceof Error
                    ? postMutation.error.message
                    : 'An unknown error occurred'}
                </p>
                <p className="text-xs mt-2 opacity-90">
                  Common issues: Network connection, Instagram API rate limits, or invalid video format.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => postMutation.reset()}
                    aria-label="Try posting again"
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {(postMutation.isSuccess || postMutation.isError) && (
          <Button onClick={handleClose} className="w-full">
            Close
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
