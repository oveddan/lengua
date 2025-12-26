import { Card } from './db';

/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Quality ratings:
 * 0 - Complete blackout, no recall
 * 1 - Incorrect, but recognized upon seeing answer
 * 2 - Incorrect, but answer seemed easy to recall
 * 3 - Correct with serious difficulty
 * 4 - Correct with some hesitation
 * 5 - Perfect response
 *
 * Simplified for UI: Again (0), Hard (2), Good (4), Easy (5)
 */

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;
export type SimpleQuality = 'again' | 'hard' | 'good' | 'easy';

const qualityMap: Record<SimpleQuality, Quality> = {
  again: 0,
  hard: 2,
  good: 4,
  easy: 5,
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export interface SM2Result {
  interval: number;
  ease_factor: number;
  next_review: string;
  review_count: number;
}

/**
 * Calculate next review parameters using SM-2 algorithm
 */
export function calculateSM2(
  quality: Quality,
  currentInterval: number,
  currentEaseFactor: number,
  reviewCount: number
): SM2Result {
  let interval: number;
  let easeFactor = currentEaseFactor;

  // If quality < 3, the response was incorrect - reset
  if (quality < 3) {
    interval = 1;
    reviewCount = 0;
  } else {
    // Correct response
    if (reviewCount === 0) {
      interval = 1;
    } else if (reviewCount === 1) {
      interval = 6;
    } else {
      interval = Math.round(currentInterval * easeFactor);
    }

    // Update ease factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // Minimum ease factor is 1.3
    easeFactor = Math.max(1.3, easeFactor);

    reviewCount += 1;
  }

  // For "easy" responses, give a bonus
  if (quality === 5) {
    interval = Math.round(interval * 1.3);
  }

  const nextReview = addDays(new Date(), interval);

  return {
    interval,
    ease_factor: Math.round(easeFactor * 100) / 100, // Round to 2 decimal places
    next_review: nextReview.toISOString(),
    review_count: reviewCount,
  };
}

/**
 * Convenience function using simple quality names
 */
export function reviewCard(card: Card, simpleQuality: SimpleQuality): SM2Result {
  const quality = qualityMap[simpleQuality];
  return calculateSM2(quality, card.interval, card.ease_factor, card.review_count);
}

/**
 * Get human-readable next review time
 */
export function formatNextReview(nextReview: string): string {
  const date = new Date(nextReview);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Now';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.round(diffDays / 7)} weeks`;
  return `In ${Math.round(diffDays / 30)} months`;
}

/**
 * Preview what intervals each button would give
 */
export function previewIntervals(card: Card): Record<SimpleQuality, number> {
  return {
    again: calculateSM2(0, card.interval, card.ease_factor, card.review_count).interval,
    hard: calculateSM2(2, card.interval, card.ease_factor, card.review_count).interval,
    good: calculateSM2(4, card.interval, card.ease_factor, card.review_count).interval,
    easy: calculateSM2(5, card.interval, card.ease_factor, card.review_count).interval,
  };
}
