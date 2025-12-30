/**
 * Anki Scheduler - Full implementation based on Anki's source code
 * Reference: https://github.com/ankitects/anki/tree/main/rslib/src/scheduler/states
 */

import { Card, CardQueue, CardQueueType } from './db';

// Constants from Anki's review.rs
export const INITIAL_EASE_FACTOR = 2.5;
export const MINIMUM_EASE_FACTOR = 1.3;
export const EASE_FACTOR_AGAIN_DELTA = -0.2;
export const EASE_FACTOR_HARD_DELTA = -0.15;
export const EASE_FACTOR_EASY_DELTA = 0.15;

// Scheduler configuration (matches Anki defaults)
export interface SchedulerConfig {
  // Learning phase
  learnSteps: number[];        // Steps in minutes (default: [1, 10])
  graduatingIntervalGood: number;  // Days (default: 1)
  graduatingIntervalEasy: number;  // Days (default: 4)

  // Review phase
  hardMultiplier: number;      // Default: 1.2
  easyMultiplier: number;      // Default: 1.3
  intervalMultiplier: number;  // Default: 1.0
  maximumInterval: number;     // Days (default: 36500)

  // Lapse/Relearning phase
  relearnSteps: number[];      // Steps in minutes (default: [10])
  lapseMultiplier: number;     // Default: 0 (new interval = minimum)
  minimumLapseInterval: number; // Days (default: 1)
  leechThreshold: number;      // Default: 8
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  learnSteps: [1, 10],
  graduatingIntervalGood: 1,
  graduatingIntervalEasy: 4,
  hardMultiplier: 1.2,
  easyMultiplier: 1.3,
  intervalMultiplier: 1.0,
  maximumInterval: 36500,
  relearnSteps: [10],
  lapseMultiplier: 0,
  minimumLapseInterval: 1,
  leechThreshold: 8,
};

export type AnswerButton = 'again' | 'hard' | 'good' | 'easy';

// What the scheduler returns after answering
export interface ScheduleResult {
  queue: CardQueueType;
  learning_step: number;
  interval: number;
  ease_factor: number;
  next_review: string;      // ISO date string
  lapses: number;
  scheduledSecs?: number;   // For learning/relearning cards (seconds until next review)
}

// For displaying button previews
export interface ButtonPreview {
  label: string;
  interval: string;         // Human readable (e.g., "1m", "10m", "1d")
  scheduledSecs?: number;   // Seconds until due
  scheduledDays?: number;   // Days until due
}

/**
 * Convert minutes to seconds
 */
function minsToSecs(mins: number): number {
  return Math.round(mins * 60);
}

/**
 * Add seconds to current time and return ISO string
 */
function addSecs(secs: number): string {
  const date = new Date();
  date.setSeconds(date.getSeconds() + secs);
  return date.toISOString();
}

/**
 * Add days to current time and return ISO string
 */
function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  // Set to start of day for review cards
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Format interval for display
 */
export function formatInterval(secs?: number, days?: number): string {
  if (secs !== undefined) {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    if (secs < 86400) return `${Math.round(secs / 3600)}h`;
    return `${Math.round(secs / 86400)}d`;
  }
  if (days !== undefined) {
    if (days === 0) return 'now';
    if (days === 1) return '1d';
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}y`;
  }
  return '?';
}

/**
 * Apply fuzz to interval (from Anki's fuzz.rs)
 * Intervals < 2.5 days: no fuzz
 * 2.5-7 days: ±15%
 * 7-20 days: ±10%
 * > 20 days: ±5%
 */
function applyFuzz(interval: number, minimum: number, maximum: number): number {
  if (interval < 2.5) {
    return Math.round(interval);
  }

  // Calculate fuzz delta
  let delta = 1.0; // Base fuzz of 1 day
  const ranges = [
    { start: 2.5, end: 7.0, factor: 0.15 },
    { start: 7.0, end: 20.0, factor: 0.1 },
    { start: 20.0, end: Infinity, factor: 0.05 },
  ];

  for (const range of ranges) {
    delta += range.factor * Math.max(0, Math.min(interval, range.end) - range.start);
  }

  // Random value in range [interval - delta, interval + delta]
  const fuzzFactor = Math.random();
  const lower = Math.round(interval - delta);
  const upper = Math.round(interval + delta);

  let result = Math.floor(lower + fuzzFactor * (upper - lower + 1));
  return Math.max(minimum, Math.min(maximum, result));
}

/**
 * Get the learning step delay in seconds for a given remaining step count
 */
function getStepDelaySecs(steps: number[], remainingSteps: number): number | null {
  const totalSteps = steps.length;
  const currentIndex = totalSteps - remainingSteps;
  if (currentIndex >= 0 && currentIndex < totalSteps) {
    return minsToSecs(steps[currentIndex]);
  }
  return null;
}

/**
 * Get the next step delay in seconds (for Good button)
 */
function getNextStepDelaySecs(steps: number[], remainingSteps: number): number | null {
  const totalSteps = steps.length;
  const nextIndex = totalSteps - remainingSteps + 1;
  if (nextIndex >= 0 && nextIndex < totalSteps) {
    return minsToSecs(steps[nextIndex]);
  }
  return null; // No more steps, will graduate
}

/**
 * Get the hard step delay (average of current and next, or 1.5x current)
 */
function getHardStepDelaySecs(steps: number[], remainingSteps: number): number {
  const current = getStepDelaySecs(steps, remainingSteps) || minsToSecs(steps[0]);
  const next = getNextStepDelaySecs(steps, remainingSteps);

  if (next !== null) {
    return Math.round((current + next) / 2);
  }
  // 50% more than current, but at most 1 day more
  const DAY = 86400;
  return Math.min(Math.round(current * 1.5), current + DAY);
}

/**
 * Schedule a NEW card (never reviewed)
 */
function scheduleNew(card: Card, answer: AnswerButton, config: SchedulerConfig): ScheduleResult {
  const steps = config.learnSteps;

  if (steps.length === 0 || answer === 'easy') {
    // No learning steps or Easy: graduate immediately
    const interval = answer === 'easy'
      ? config.graduatingIntervalEasy
      : config.graduatingIntervalGood;
    return {
      queue: CardQueue.Review,
      learning_step: 0,
      interval: applyFuzz(interval, 1, config.maximumInterval),
      ease_factor: INITIAL_EASE_FACTOR,
      next_review: addDays(interval),
      lapses: 0,
    };
  }

  // Enter learning phase
  const remainingSteps = steps.length;
  let scheduledSecs: number;
  let newRemainingSteps: number;

  switch (answer) {
    case 'again':
      scheduledSecs = minsToSecs(steps[0]);
      newRemainingSteps = remainingSteps;
      break;
    case 'hard':
      scheduledSecs = getHardStepDelaySecs(steps, remainingSteps);
      newRemainingSteps = remainingSteps;
      break;
    case 'good':
      if (steps.length === 1) {
        // Only one step, graduate
        return {
          queue: CardQueue.Review,
          learning_step: 0,
          interval: config.graduatingIntervalGood,
          ease_factor: INITIAL_EASE_FACTOR,
          next_review: addDays(config.graduatingIntervalGood),
          lapses: 0,
        };
      }
      scheduledSecs = minsToSecs(steps[1]);
      newRemainingSteps = remainingSteps - 1;
      break;
    default:
      throw new Error(`Invalid answer: ${answer}`);
  }

  return {
    queue: CardQueue.Learning,
    learning_step: steps.length - newRemainingSteps,
    interval: 0,
    ease_factor: INITIAL_EASE_FACTOR,
    next_review: addSecs(scheduledSecs),
    lapses: 0,
    scheduledSecs,
  };
}

/**
 * Schedule a LEARNING card (in learning phase, not yet graduated)
 */
function scheduleLearning(card: Card, answer: AnswerButton, config: SchedulerConfig): ScheduleResult {
  const steps = config.learnSteps;
  const currentStep = card.learning_step;
  const remainingSteps = steps.length - currentStep;

  if (answer === 'easy') {
    // Graduate immediately with easy interval
    const interval = config.graduatingIntervalEasy;
    return {
      queue: CardQueue.Review,
      learning_step: 0,
      interval: applyFuzz(interval, 1, config.maximumInterval),
      ease_factor: INITIAL_EASE_FACTOR,
      next_review: addDays(interval),
      lapses: card.lapses,
    };
  }

  let scheduledSecs: number;
  let newStep: number;

  switch (answer) {
    case 'again':
      // Reset to first step
      scheduledSecs = minsToSecs(steps[0]);
      newStep = 0;
      break;
    case 'hard':
      // Repeat current step (with slightly longer delay)
      scheduledSecs = getHardStepDelaySecs(steps, remainingSteps);
      newStep = currentStep;
      break;
    case 'good':
      // Advance to next step
      const nextDelay = getNextStepDelaySecs(steps, remainingSteps);
      if (nextDelay === null) {
        // No more steps, graduate!
        const interval = config.graduatingIntervalGood;
        return {
          queue: CardQueue.Review,
          learning_step: 0,
          interval: applyFuzz(interval, 1, config.maximumInterval),
          ease_factor: INITIAL_EASE_FACTOR,
          next_review: addDays(interval),
          lapses: card.lapses,
        };
      }
      scheduledSecs = nextDelay;
      newStep = currentStep + 1;
      break;
    default:
      throw new Error(`Invalid answer: ${answer}`);
  }

  return {
    queue: CardQueue.Learning,
    learning_step: newStep,
    interval: 0,
    ease_factor: INITIAL_EASE_FACTOR,
    next_review: addSecs(scheduledSecs),
    lapses: card.lapses,
    scheduledSecs,
  };
}

/**
 * Schedule a REVIEW card (graduated, using spaced repetition)
 */
function scheduleReview(card: Card, answer: AnswerButton, config: SchedulerConfig): ScheduleResult {
  const currentInterval = Math.max(card.interval, 1);
  let newEase = card.ease_factor;
  let newInterval: number;
  let newLapses = card.lapses;

  switch (answer) {
    case 'again':
      // Lapse! Enter relearning
      newEase = Math.max(MINIMUM_EASE_FACTOR, card.ease_factor + EASE_FACTOR_AGAIN_DELTA);
      newLapses = card.lapses + 1;

      if (config.relearnSteps.length === 0) {
        // No relearning steps, stay in review with reduced interval
        newInterval = Math.max(
          config.minimumLapseInterval,
          Math.round(currentInterval * config.lapseMultiplier)
        );
        return {
          queue: CardQueue.Review,
          learning_step: 0,
          interval: newInterval,
          ease_factor: newEase,
          next_review: addDays(newInterval),
          lapses: newLapses,
        };
      }

      // Enter relearning with first step
      const relearnSecs = minsToSecs(config.relearnSteps[0]);
      return {
        queue: CardQueue.Relearning,
        learning_step: 0,
        interval: currentInterval, // Preserve original interval for after relearning
        ease_factor: newEase,
        next_review: addSecs(relearnSecs),
        lapses: newLapses,
        scheduledSecs: relearnSecs,
      };

    case 'hard':
      newEase = Math.max(MINIMUM_EASE_FACTOR, card.ease_factor + EASE_FACTOR_HARD_DELTA);
      newInterval = applyFuzz(
        currentInterval * config.hardMultiplier,
        currentInterval + 1,
        config.maximumInterval
      );
      break;

    case 'good':
      // Ease stays the same
      newInterval = applyFuzz(
        currentInterval * card.ease_factor,
        currentInterval + 1,
        config.maximumInterval
      );
      break;

    case 'easy':
      newEase = card.ease_factor + EASE_FACTOR_EASY_DELTA;
      newInterval = applyFuzz(
        currentInterval * card.ease_factor * config.easyMultiplier,
        currentInterval + 1,
        config.maximumInterval
      );
      break;

    default:
      throw new Error(`Invalid answer: ${answer}`);
  }

  return {
    queue: CardQueue.Review,
    learning_step: 0,
    interval: newInterval,
    ease_factor: newEase,
    next_review: addDays(newInterval),
    lapses: newLapses,
  };
}

/**
 * Schedule a RELEARNING card (lapsed, going through relearning steps)
 */
function scheduleRelearning(card: Card, answer: AnswerButton, config: SchedulerConfig): ScheduleResult {
  const steps = config.relearnSteps;
  const currentStep = card.learning_step;
  const remainingSteps = steps.length - currentStep;

  // Calculate the interval to use after relearning completes
  const postRelearnInterval = Math.max(
    config.minimumLapseInterval,
    Math.round(card.interval * config.lapseMultiplier) || config.minimumLapseInterval
  );

  if (answer === 'easy') {
    // Graduate immediately, add 1 day to the post-relearn interval
    const interval = postRelearnInterval + 1;
    return {
      queue: CardQueue.Review,
      learning_step: 0,
      interval: Math.min(interval, config.maximumInterval),
      ease_factor: card.ease_factor,
      next_review: addDays(interval),
      lapses: card.lapses,
    };
  }

  let scheduledSecs: number;
  let newStep: number;

  switch (answer) {
    case 'again':
      // Reset to first relearning step
      scheduledSecs = minsToSecs(steps[0]);
      newStep = 0;
      break;
    case 'hard':
      // Repeat current step
      scheduledSecs = getHardStepDelaySecs(steps, remainingSteps);
      newStep = currentStep;
      break;
    case 'good':
      // Advance to next step
      const nextDelay = getNextStepDelaySecs(steps, remainingSteps);
      if (nextDelay === null) {
        // No more steps, graduate back to review
        return {
          queue: CardQueue.Review,
          learning_step: 0,
          interval: postRelearnInterval,
          ease_factor: card.ease_factor,
          next_review: addDays(postRelearnInterval),
          lapses: card.lapses,
        };
      }
      scheduledSecs = nextDelay;
      newStep = currentStep + 1;
      break;
    default:
      throw new Error(`Invalid answer: ${answer}`);
  }

  return {
    queue: CardQueue.Relearning,
    learning_step: newStep,
    interval: card.interval, // Preserve for after relearning
    ease_factor: card.ease_factor,
    next_review: addSecs(scheduledSecs),
    lapses: card.lapses,
    scheduledSecs,
  };
}

/**
 * Main scheduling function - dispatches to appropriate handler based on card queue
 */
export function scheduleCard(
  card: Card,
  answer: AnswerButton,
  config: SchedulerConfig = DEFAULT_CONFIG
): ScheduleResult {
  switch (card.queue) {
    case CardQueue.New:
      return scheduleNew(card, answer, config);
    case CardQueue.Learning:
      return scheduleLearning(card, answer, config);
    case CardQueue.Review:
      return scheduleReview(card, answer, config);
    case CardQueue.Relearning:
      return scheduleRelearning(card, answer, config);
    default:
      throw new Error(`Unknown card queue: ${card.queue}`);
  }
}

/**
 * Get button previews for a card (what each button will do)
 */
export function getButtonPreviews(
  card: Card,
  config: SchedulerConfig = DEFAULT_CONFIG
): Record<AnswerButton, ButtonPreview> {
  const previews: Record<AnswerButton, ButtonPreview> = {
    again: { label: 'Again', interval: '' },
    hard: { label: 'Hard', interval: '' },
    good: { label: 'Good', interval: '' },
    easy: { label: 'Easy', interval: '' },
  };

  for (const answer of ['again', 'hard', 'good', 'easy'] as AnswerButton[]) {
    const result = scheduleCard(card, answer, config);
    if (result.scheduledSecs !== undefined) {
      previews[answer].interval = formatInterval(result.scheduledSecs);
      previews[answer].scheduledSecs = result.scheduledSecs;
    } else {
      const days = result.interval;
      previews[answer].interval = formatInterval(undefined, days);
      previews[answer].scheduledDays = days;
    }
  }

  return previews;
}

/**
 * Check if a card is in a learning state (learning or relearning)
 */
export function isLearningCard(card: Card): boolean {
  return card.queue === CardQueue.Learning || card.queue === CardQueue.Relearning;
}

/**
 * Check if a card is due for review now
 */
export function isDue(card: Card): boolean {
  return new Date(card.next_review) <= new Date();
}
