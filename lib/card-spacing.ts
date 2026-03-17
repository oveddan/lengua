export interface CardLike {
  id: string;
  spanish_word: string;
}

export function getBaseWord(word: string): string {
  const base = word.split('(')[0].trim().toLowerCase();
  return base.split(' ').slice(0, 3).join(' ');
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shuffleWithSpacing(cards: CardLike[]): CardLike[] {
  if (cards.length <= 1) return cards;

  // Shuffle first to ensure random base ordering.
  // Without this, cards with unique base words retain their database order
  // because the interleaving algorithm picks deterministically on ties.
  const randomized = shuffleArray(cards);

  // Group cards by base word
  const groups = new Map<string, CardLike[]>();
  for (const card of randomized) {
    const base = getBaseWord(card.spanish_word);
    if (!groups.has(base)) {
      groups.set(base, []);
    }
    groups.get(base)!.push(card);
  }

  // Shuffle within each group
  const groupArrays: CardLike[][] = [];
  for (const [, groupCards] of groups) {
    groupArrays.push(shuffleArray(groupCards));
  }

  // Sort groups by size (largest first for better spacing)
  groupArrays.sort((a, b) => b.length - a.length);

  // Build result by interleaving groups
  const result: CardLike[] = [];
  const groupIndices = groupArrays.map(() => 0);

  while (result.length < cards.length) {
    let bestGroup = -1;
    let bestScore = -1;

    for (let g = 0; g < groupArrays.length; g++) {
      if (groupIndices[g] >= groupArrays[g].length) continue;

      const candidate = groupArrays[g][groupIndices[g]];
      const candidateBase = getBaseWord(candidate.spanish_word);

      // Calculate score based on distance from last card of same group
      let minDistance = result.length + 1;
      for (let i = result.length - 1; i >= 0 && i >= result.length - 5; i--) {
        if (getBaseWord(result[i].spanish_word) === candidateBase) {
          minDistance = result.length - i;
          break;
        }
      }

      if (minDistance > bestScore) {
        bestScore = minDistance;
        bestGroup = g;
      }
    }

    if (bestGroup >= 0) {
      result.push(groupArrays[bestGroup][groupIndices[bestGroup]]);
      groupIndices[bestGroup]++;
    }
  }

  return result;
}
