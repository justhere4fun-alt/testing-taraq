export interface Player {
  id: string;
  name: string;
  hearts: number;
  isDead: boolean;
  avatarSeed: number; // For randomizing avatar appearance if we had images, or just color
  avatarUrl?: string;
}

export enum GamePhase {
  SETUP = 'SETUP',
  ROLL = 'ROLL',
  DECIDE = 'DECIDE',
  GAME_OVER = 'GAME_OVER',
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'neutral' | 'positive' | 'negative' | 'death' | 'commentary';
}

export interface TurnState {
  diceValue: number | null;
  currentPlayerId: string;
}