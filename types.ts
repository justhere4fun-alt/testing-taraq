export interface Player {
  id: string;
  name: string;
  hearts: number;
  isDead: boolean;
  avatarSeed: number; // For randomizing avatar appearance if we had images, or just color
  avatarUrl?: string;
  isHost?: boolean; // If this player is the host (useful for UI badges)
  peerId?: string; // If connected via network
}

export enum GamePhase {
  LOBBY = 'LOBBY', // New phase for setup/connection
  SETUP = 'SETUP', // Host setting up players
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

export type SplitAction = Record<string, number>; // playerId -> amount (positive for heal, negative for harm)

// Networking Types

export type NetworkMode = 'OFFLINE' | 'HOST' | 'CLIENT';

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  diceValue: number | null;
  isRolling: boolean;
  logs: LogEntry[];
  turnCount: number;
  winner: Player | null;
  aiCommentary: string;
  isSplitMode: boolean;
  splitActions: SplitAction;
}

export type NetworkMessage = 
  | { type: 'JOIN'; payload: { name: string; avatarUrl?: string; peerId: string } }
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'ACTION_ROLL' }
  | { type: 'ACTION_DECIDE'; payload: { targetId: string; action: 'ADD' | 'REMOVE' } }
  | { type: 'ACTION_SPLIT_ADJUST'; payload: { targetId: string; delta: number } }
  | { type: 'ACTION_SPLIT_TOGGLE'; payload: boolean }
  | { type: 'ACTION_SPLIT_COMMIT' }
  | { type: 'KICK_PLAYER'; payload: { id: string } };
