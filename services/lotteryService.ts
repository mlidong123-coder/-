
import { AppState, Participant, Prize, Winner, RiggingConfig } from '../types';

export const performDraw = (
  state: AppState,
  prizeId: string
): { winners: Participant[]; error?: string } => {
  const prize = state.prizes.find(p => p.id === prizeId);
  if (!prize) return { winners: [], error: '奖项不存在' };

  // 1. 已中奖名单
  const alreadyWonIds = new Set(state.winners.map(w => w.participantId));
  
  // 2. 排除黑名单和已中奖者
  const eligiblePool = state.participants.filter(p => 
    !alreadyWonIds.has(p.id) && !state.rigging.blacklist.includes(p.id)
  );

  if (eligiblePool.length === 0) {
    return { winners: [], error: '没有符合条件的参会人员' };
  }

  const winners: Participant[] = [];
  const countToDraw = Math.min(prize.drawBatch, eligiblePool.length);

  // 3. 处理内定人员
  const forcedForThisPrize = state.rigging.forcedWinners[prizeId] || [];
  const forcedCandidates = eligiblePool.filter(p => forcedForThisPrize.includes(p.id));

  // 优先选取内定人员
  for (const forced of forcedCandidates) {
    if (winners.length < countToDraw) {
      winners.push(forced);
    }
  }

  // 4. 随机抽取剩余名额
  const remainingCount = countToDraw - winners.length;
  if (remainingCount > 0) {
    const remainingPool = eligiblePool.filter(p => !winners.find(w => w.id === p.id));
    const shuffled = [...remainingPool].sort(() => Math.random() - 0.5);
    winners.push(...shuffled.slice(0, remainingCount));
  }

  return { winners };
};

export const STORAGE_KEY = 'ANNUAL_GALA_LOTTERY_DATA';

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const loadState = (): AppState | null => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};
