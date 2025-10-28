import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SocialPostsHistoryProps {
  projectId: string;
}

export function SocialPostsHistory({ projectId }: SocialPostsHistoryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['social-posts', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/social/posts/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      return await response.json();
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading posts...</div>;
  }

  if (!data?.posts?.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Social Media Posts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.posts.map((post: any) => (
          <div
            key={post.id}
            className="flex items-center justify-between py-2 border-b last:border-0"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">{post.platform}</span>
                <Badge
                  variant={
                    post.status === 'published'
                      ? 'default'
                      : post.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {post.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </p>
            </div>

            {post.platformPostUrl && (
              <a
                href={post.platformPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
