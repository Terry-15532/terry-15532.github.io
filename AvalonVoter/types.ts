export enum GamePhase {
  LOBBY = 'LOBBY',
  TEAM_SELECTION = 'TEAM_SELECTION',
  VOTING = 'VOTING',
  RESULT_REVEAL = 'RESULT_REVEAL',
}

export interface Player {
  id: string; // Peer ID
  name: string;
  avatarSeed: string;
  isHost: boolean;
  isConnected: boolean;
}

export interface MissionResult {
  roundNumber: number;
  team: string[]; // List of player IDs
  votes: {
    black: number; // Success
    red: number;   // Fail
  };
  flavorText?: string;
  timestamp: number;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentLeaderId: string;
  currentTeam: string[]; // IDs of players selected for the mission
  votesReceived: number; // Count of votes received so far (Host only knows truth, Clients just know count if public or strictly hidden)
  missionHistory: MissionResult[];
  roomId: string;
}

// Network Messages
export type Message =
  | { type: 'JOIN'; payload: { name: string; avatarSeed: string } }
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'UPDATE_TEAM'; payload: string[] } // Leader updates team selection
  | { type: 'START_VOTE'; payload: { team: string[]; flavorText: string } }
  | { type: 'SUBMIT_VOTE'; payload: { vote: 'BLACK' | 'RED' } }
  | { type: 'RESET_ROUND'; payload: null }
  | { type: 'HEARTBEAT'; payload: null };
