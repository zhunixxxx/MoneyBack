import type { DiningInvoice } from './types.js';

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function toCents(amount: number): number {
  return Math.round(roundAmount(amount) * 100);
}

export interface MatchCandidate {
  id: string;
  amount: number;
}

export interface MatchCombination {
  ids: string[];
  total: number;
  isExact: boolean;
}

export function findBestInvoiceCombination(
  candidates: MatchCandidate[],
  targetAmount: number
): MatchCombination | null {
  const target = toCents(targetAmount);
  if (target <= 0 || candidates.length === 0) return null;

  const items = candidates
    .map((c) => ({ id: c.id, cents: toCents(c.amount) }))
    .filter((c) => c.cents > 0);

  if (items.length === 0) return null;

  const maxItem = Math.max(...items.map((i) => i.cents));
  const cap = Math.max(target, maxItem);
  const dp: (string[] | null)[] = Array(cap + 1).fill(null);
  dp[0] = [];

  for (const item of items) {
    for (let sum = cap; sum >= item.cents; sum--) {
      if (dp[sum - item.cents] !== null && dp[sum] === null) {
        dp[sum] = [...dp[sum - item.cents]!, item.id];
      }
    }
  }

  if (dp[target]) {
    return {
      ids: dp[target]!,
      total: roundAmount(target / 100),
      isExact: true,
    };
  }

  for (let sum = target - 1; sum >= 0; sum--) {
    if (dp[sum]) {
      return {
        ids: dp[sum]!,
        total: roundAmount(sum / 100),
        isExact: false,
      };
    }
  }

  let bestSingle = items[0];
  for (const item of items) {
    if (Math.abs(item.cents - target) < Math.abs(bestSingle.cents - target)) {
      bestSingle = item;
    }
  }

  return {
    ids: [bestSingle.id],
    total: roundAmount(bestSingle.cents / 100),
    isExact: bestSingle.cents === target,
  };
}

export function matchDiningInvoices(
  invoices: DiningInvoice[],
  targetAmount: number,
  options?: { startDate?: string; endDate?: string }
): MatchCombination | null {
  let available = invoices.filter(
    (inv) => inv.status === 'available' && inv.extractedAmount != null && inv.extractedAmount > 0
  );

  if (options?.startDate && options?.endDate) {
    available = [...available].sort((a, b) => {
      const aInRange = isDateInRange(a.invoiceDate, options.startDate!, options.endDate!);
      const bInRange = isDateInRange(b.invoiceDate, options.startDate!, options.endDate!);
      if (aInRange !== bInRange) return aInRange ? -1 : 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  } else {
    available = [...available].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  return findBestInvoiceCombination(
    available.map((inv) => ({ id: inv.id, amount: inv.extractedAmount! })),
    targetAmount
  );
}

function isDateInRange(date: string | null | undefined, start: string, end: string): boolean {
  if (!date) return false;
  return date >= start && date <= end;
}
