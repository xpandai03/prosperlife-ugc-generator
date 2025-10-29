import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, ExternalLink, Instagram, Youtube } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Platform icons mapping
const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
    </svg>
  ),
  youtube: Youtube,
  facebook: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  twitter: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  linkedin: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  threads: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 14.5c-.85 2.013-2.756 3.292-4.925 3.292-2.925 0-5.002-2.126-5.002-5.125 0-2.999 2.077-5.125 5.002-5.125 1.697 0 3.147.722 3.984 1.982l-1.688 1.078c-.5-.756-1.322-1.184-2.296-1.184-1.659 0-2.816 1.246-2.816 3.249s1.157 3.249 2.816 3.249c1.155 0 2.082-.544 2.476-1.453h-2.476v-1.868h4.925v.905z"/>
    </svg>
  ),
  pinterest: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
    </svg>
  ),
  reddit: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  ),
  bluesky: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/>
    </svg>
  ),
};

// Platform colors
const platformColors: Record<string, string> = {
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  tiktok: 'bg-black',
  youtube: 'bg-red-600',
  facebook: 'bg-blue-600',
  twitter: 'bg-black',
  linkedin: 'bg-blue-700',
  threads: 'bg-black',
  pinterest: 'bg-red-700',
  reddit: 'bg-orange-600',
  bluesky: 'bg-sky-500',
};

// Available platforms to connect
const AVAILABLE_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', description: 'Connect your Instagram Business account' },
  { id: 'tiktok', name: 'TikTok', description: 'Connect your TikTok account' },
  { id: 'youtube', name: 'YouTube', description: 'Connect your YouTube channel' },
];

interface ConnectedAccount {
  _id: string;
  platform: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  isActive: boolean;
}

export default function SocialAccountsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch connected accounts on mount
  useEffect(() => {
    fetchConnectedAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      const response = await fetch('/api/social/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching accounts:', errorData);
        // Don't show toast for profile not configured - this is expected for new users
        if (!errorData.message?.includes('profile')) {
          toast({
            title: 'Error',
            description: errorData.message || 'Failed to load connected accounts',
            variant: 'destructive',
          });
        }
      } else {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      // Only show error toast for unexpected errors
      if (error.message && !error.message.includes('profile')) {
        toast({
          title: 'Error',
          description: 'Failed to load connected accounts',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    setConnectingPlatform(platform);

    try {
      const response = await fetch(`/api/social/connect/${platform}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to generate connect URL');
      }

      const data = await response.json();

      // Open OAuth URL in new window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.connectUrl,
        `Connect ${platform}`,
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );

      if (!popup) {
        toast({
          title: 'Pop-up blocked',
          description: 'Please allow pop-ups for this site to connect accounts',
          variant: 'destructive',
        });
        setConnectingPlatform(null);
        return;
      }

      // Listen for OAuth callback
      const checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopupClosed);
          setConnectingPlatform(null);
          // Refresh accounts after a delay
          setTimeout(() => {
            fetchConnectedAccounts();
          }, 1000);
        }
      }, 500);

    } catch (error: any) {
      console.error('Error connecting account:', error);
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to connect account',
        variant: 'destructive',
      });
      setConnectingPlatform(null);
    }
  };

  const isConnected = (platform: string) => {
    return accounts.some(acc => acc.platform === platform && acc.isActive);
  };

  const getConnectedAccount = (platform: string) => {
    return accounts.find(acc => acc.platform === platform && acc.isActive);
  };

  const PlatformIcon = ({ platform }: { platform: string }) => {
    const Icon = platformIcons[platform];
    return Icon ? <Icon className="w-5 h-5" /> : null;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Social Accounts</h1>
        <p className="text-muted-foreground mt-2">
          Connect your social media accounts to post directly from Streamline
        </p>
      </div>

      {/* Connected Accounts Summary */}
      {accounts.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Connected Accounts ({accounts.length})
            </CardTitle>
            <CardDescription>
              Your connected social media accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account._id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full text-white ${platformColors[account.platform]}`}>
                      <PlatformIcon platform={account.platform} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">{account.platform}</p>
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                          Connected
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        @{account.username}
                      </p>
                    </div>
                  </div>
                  {account.profilePicture && (
                    <img
                      src={account.profilePicture}
                      alt={account.displayName}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Platforms */}
      <Card>
        <CardHeader>
          <CardTitle>Connect New Account</CardTitle>
          <CardDescription>
            Choose a platform to connect your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {AVAILABLE_PLATFORMS.map((platform) => {
              const connected = isConnected(platform.id);
              const account = getConnectedAccount(platform.id);
              const isConnecting = connectingPlatform === platform.id;

              return (
                <div
                  key={platform.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full text-white ${platformColors[platform.id]}`}>
                      <PlatformIcon platform={platform.id} />
                    </div>
                    <div>
                      <p className="font-medium">{platform.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {connected ? `Connected as @${account?.username}` : platform.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnecting}
                    variant={connected ? "outline" : "default"}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : connected ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Reconnect
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Connect
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> You'll be redirected to authorize Streamline to post on your behalf.
          We'll never post without your explicit permission.
        </p>
      </div>
    </div>
  );
}
