const TOTAL_POSSIBLE_BLOCKS = 21; // 7 days x 3 slots
const HOURS_PER_BLOCK = 2; // each slot represents ~2 hours

function computeFragmentationIndex(busyBlocks, maxFreeBlockHours) {
  const busyCount  = busyBlocks.length;
  const freeBlocks = Math.max(TOTAL_POSSIBLE_BLOCKS - busyCount, 0);
  const raw        = freeBlocks / TOTAL_POSSIBLE_BLOCKS;

  const multiplier = maxFreeBlockHours === 3 ? 0.8
                   : maxFreeBlockHours === 1 ? 1.2
                   : 1.0;

  return Math.min(raw * multiplier, 1);
}

/**
 * Fragmentation score: 0 (no fragmentation) → 100 (fully fragmented).
 * More busy blocks = higher fragmentation.
 */
function computeFragmentationScore(busyBlocks) {
  const busyCount = Math.min(busyBlocks.length, TOTAL_POSSIBLE_BLOCKS);
  return Math.round((busyCount / TOTAL_POSSIBLE_BLOCKS) * 100);
}

/**
 * Total free hours based on free block count and maxFreeBlockHours cap.
 */
function computeTotalFreeHours(busyBlocks, maxFreeBlockHours) {
  const freeBlocks = Math.max(TOTAL_POSSIBLE_BLOCKS - busyBlocks.length, 0);
  return freeBlocks * Math.min(maxFreeBlockHours, HOURS_PER_BLOCK);
}

const DAY_TO_INDEX = {
  MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6,
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6
};

/**
 * Maps busy blocks to a 21-slot week (7 days x 3 slots).
 * If severity is 'high' (full day), marks all 3 slots of that day as busy.
 * Otherwise (medium/partial), marks only 1 slot.
 */
function mapBlocksToSlots(busyBlocks) {
  const occupied = new Array(TOTAL_POSSIBLE_BLOCKS).fill(false);
  for (const block of busyBlocks) {
    const dayCode = (block.day || '').toUpperCase();
    const dayIdx = DAY_TO_INDEX[dayCode] ?? DAY_TO_INDEX[block.day?.toLowerCase()];
    if (dayIdx === undefined) continue;

    const baseIdx = dayIdx * 3;
    if (block.severity === 'high') {
      occupied[baseIdx] = true;
      occupied[baseIdx + 1] = true;
      occupied[baseIdx + 2] = true;
    } else {
      // For partial/medium, we assume they take the afternoon slot (middle)
      occupied[baseIdx + 1] = true;
    }
  }
  return occupied;
}

/**
 * Max continuous free block: longest run of consecutive free slots across the week.
 * Uses the mapped 21-slot occupancy array to find the true longest run.
 */
function computeMaxContinuousBlock(busyBlocks, maxFreeBlockHours) {
  const occupied = mapBlocksToSlots(busyBlocks);

  let maxRun = 0;
  let currentRun = 0;
  for (const isBusy of occupied) {
    if (!isBusy) {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  // Each slot is 2 hours. Cap by maxFreeBlockHours if requested,
  // but usually maxFreeBlockHours is the intern's self-reported limit.
  return maxRun * HOURS_PER_BLOCK;
}

function computeAvailabilityStatus(busyBlocks, fragmentationIndex, weekStatusToggle) {
  if (weekStatusToggle === 'heavy_week' || weekStatusToggle === 'busy') return 'unavailable';

  // We use the 21-slot occupancy for a more accurate count
  const occupied = mapBlocksToSlots(busyBlocks);
  const busyCount = occupied.filter(Boolean).length;

  if (busyCount >= 14)                             return 'unavailable';
  if (busyCount >= 7 || fragmentationIndex > 0.6)  return 'partial';
  return 'available';
}

function computeAvailabilityScore(availabilityStatus, fragmentationIndex, maxFreeBlockHours) {
  if (availabilityStatus === 'unavailable') {
    return Math.round(10 * (1 - fragmentationIndex));
  }
  if (availabilityStatus === 'partial') {
    return Math.round(25 - (10 * fragmentationIndex));
  }
  const hoursBonus = (maxFreeBlockHours - 1) * 6;
  return Math.min(28 + hoursBonus, 40);
}

/**
 * @param {Array}  busyBlocks
 * @param {number} maxFreeBlockHours
 * @param {string} weekStatusToggle
 * @returns {{ fragmentationIndex, availabilityStatus, availabilityScore, totalFreeHours, fragmentationScore, maxContinuousBlock }}
 */
function computeAvailabilityIntelligence(busyBlocks, maxFreeBlockHours, weekStatusToggle) {
  const safeBlocks = busyBlocks || [];

  const fragmentationIndex   = computeFragmentationIndex(safeBlocks, maxFreeBlockHours);
  const availabilityStatus   = computeAvailabilityStatus(safeBlocks, fragmentationIndex, weekStatusToggle);
  const availabilityScore    = computeAvailabilityScore(availabilityStatus, fragmentationIndex, maxFreeBlockHours);
  const totalFreeHours       = computeTotalFreeHours(safeBlocks, maxFreeBlockHours);
  const fragmentationScore   = computeFragmentationScore(safeBlocks);
  const maxContinuousBlock   = computeMaxContinuousBlock(safeBlocks, maxFreeBlockHours);

  return { fragmentationIndex, availabilityStatus, availabilityScore, totalFreeHours, fragmentationScore, maxContinuousBlock };
}

module.exports = { computeAvailabilityIntelligence };
