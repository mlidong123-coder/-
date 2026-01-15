
export interface Participant {
  id: string;
  name: string;
  department: string;
}

export interface Prize {
  id: string;
  name: string;
  totalCount: number;
  drawBatch: number; // 每次抽取人数
  image?: string;
}

export interface Winner {
  participantId: string;
  participantName: string;
  prizeId: string;
  prizeName: string;
  drawTime: number;
}

export interface RiggingConfig {
  forcedWinners: Record<string, string[]>; // PrizeID -> ParticipantIDs
  blacklist: string[]; // ParticipantIDs who can never win
}

export interface AppState {
  participants: Participant[];
  prizes: Prize[];
  winners: Winner[];
  rigging: RiggingConfig;
}
