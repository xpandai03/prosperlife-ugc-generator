/**
 * CreditBalance Component (Phase 9: XPAND Credits)
 *
 * Displays user's current credit balance with optional click-to-buy
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";

interface CreditBalanceData {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
}

interface CreditBalanceProps {
  variant?: "default" | "compact" | "minimal";
  showBuyButton?: boolean;
  className?: string;
}

export function CreditBalance({
  variant = "default",
  showBuyButton = true,
  className = "",
}: CreditBalanceProps) {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<CreditBalanceData>({
    queryKey: ["/api/credits"],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (!user) return null;

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently fail
  }

  const balance = data.balance;

  // Minimal variant - just the number
  if (variant === "minimal") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 text-sm ${className}`}>
              <Coins className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">{balance.toLocaleString()}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{balance.toLocaleString()} XPAND Credits</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Compact variant - icon + number + small buy link
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5">
                <Coins className="h-4 w-4 text-yellow-500" />
                <span className="font-medium text-white">{balance.toLocaleString()}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{balance.toLocaleString()} XPAND Credits</p>
              <p className="text-xs text-gray-400">
                Used: {data.lifetimeUsed.toLocaleString()} | Purchased: {data.lifetimePurchased.toLocaleString()}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {showBuyButton && (
          <Link href="/settings/billing">
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-blue-400 hover:text-blue-300">
              Buy Credits
            </Button>
          </Link>
        )}
      </div>
    );
  }

  // Default variant - full display
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg px-4 py-2 border border-yellow-500/30">
        <Coins className="h-5 w-5 text-yellow-500" />
        <div>
          <div className="text-lg font-bold text-white">{balance.toLocaleString()}</div>
          <div className="text-xs text-gray-400">XPAND Credits</div>
        </div>
      </div>
      {showBuyButton && (
        <Link href="/settings/billing">
          <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Coins className="h-4 w-4 mr-1" />
            Buy Credits
          </Button>
        </Link>
      )}
    </div>
  );
}

export default CreditBalance;
