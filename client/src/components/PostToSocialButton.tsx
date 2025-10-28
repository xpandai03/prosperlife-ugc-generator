import { useState } from 'react';
import { Button } from './ui/button';
import { Upload } from 'lucide-react';
import { PostClipModal } from './PostClipModal';

interface PostToSocialButtonProps {
  projectId: string;
  exportUrl: string | null;
  disabled?: boolean;
}

export function PostToSocialButton({
  projectId,
  exportUrl,
  disabled
}: PostToSocialButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    if (!exportUrl) {
      alert('Please export this clip before posting to social media.');
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled || !exportUrl}
        variant="outline"
        size="sm"
        className="gap-2"
        aria-label={!exportUrl ? "Export the clip first to enable Instagram posting" : "Open dialog to post clip to Instagram"}
        title={!exportUrl ? "Please export this clip before posting to social media" : "Post to Instagram"}
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        Post to Instagram
      </Button>

      {showModal && (
        <PostClipModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          projectId={projectId}
          exportUrl={exportUrl}
        />
      )}
    </>
  );
}
