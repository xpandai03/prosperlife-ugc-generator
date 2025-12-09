/**
 * InsufficientCreditsDialog (Phase 9: XPAND Credits)
 *
 * Modal shown when user tries to use a feature but lacks credits
 */

import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins, CreditCard, TrendingUp } from "lucide-react";

interface InsufficientCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required: number;
  balance: number;
  featureName?: string;
}

export function InsufficientCreditsDialog({
  open,
  onOpenChange,
  required,
  balance,
  featureName = "this feature",
}: InsufficientCreditsDialogProps) {
  const shortfall = required - balance;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <Coins className="h-6 w-6 text-orange-600 dark:text-orange-500" />
          </div>
          <AlertDialogTitle className="text-center">
            Insufficient Credits
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            You need{" "}
            <span className="font-semibold text-foreground">
              {required.toLocaleString()} credits
            </span>{" "}
            for {featureName}, but you only have{" "}
            <span className="font-semibold text-foreground">
              {balance.toLocaleString()} credits
            </span>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-4 border border-yellow-500/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Required</span>
            <span className="font-semibold">{required.toLocaleString()} credits</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Your balance</span>
            <span className="font-semibold text-yellow-600">{balance.toLocaleString()} credits</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-yellow-500/30">
            <span className="text-sm text-muted-foreground">You need</span>
            <span className="font-bold text-red-500">+{shortfall.toLocaleString()} more</span>
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-blue-600/10 to-purple-600/10 p-4 border border-blue-500/20">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue-500" />
            Buy Credits to Continue
          </h4>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Starter Pack</span>
              <span>100 credits - $2.99</span>
            </div>
            <div className="flex justify-between">
              <span>Basic Pack</span>
              <span>500 credits - $12.99</span>
            </div>
            <div className="flex justify-between font-medium text-foreground">
              <span>Pro Pack (Best Value)</span>
              <span>1,500 credits - $34.99</span>
            </div>
            <div className="flex justify-between">
              <span>Business Pack</span>
              <span>5,000 credits - $99.99</span>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-3">
            Credits never expire. Buy once, use anytime.
          </p>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="mt-0">Maybe Later</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link href="/settings/billing">
              <a className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Buy Credits
              </a>
            </Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default InsufficientCreditsDialog;
