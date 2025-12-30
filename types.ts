
export type PieceColor = 'red' | 'black';
export type PieceType = 'king' | 'advisor' | 'elephant' | 'horse' | 'chariot' | 'cannon' | 'soldier';

export interface Piece {
  type: PieceType;
  color: PieceColor;
  text: string;
}

export interface Point {
  r: number;
  c: number;
}

export interface Move {
  from: Point;
  to: Point;
  piece: Piece;
  captured?: Piece | null;
  notation: string; // e.g., "炮二平五"
}

export interface GameState {
  board: (Piece | null)[][];
  turn: PieceColor;
  moves: Move[];
  selectedPiece: Point | null;
  lastMove: { from: Point; to: Point } | null;
}

// Tree Structure for Variations
export interface MoveNode {
  id: string;
  parentId: string | null;
  move: Move | null; // Null for root node
  boardState: (Piece | null)[][]; // Snapshot of the board after this move
  children: MoveNode[];
  comment: string;
  turn: PieceColor; // Whose turn is it AFTER this move?
  selectedChildId?: string | null; // The preferred child to follow for the "main line" view
  fen: string; // Forsyth–Edwards Notation of the current state

  // DhtmlXQ Support
  stepIndex?: number; // 1-based ply index
  ownerId?: number; // Variation ID for export
}

export interface CloudMove {
  move: string; // UCCI format
  score: number;
  rank: number;
  winrate: number;
  note: string;
}

export interface AnalysisResult {
  nodeId: string;
  moveIndex: number; // 1-based index (Round number * 2 - 1 or 0)
  moveNotation: string;
  fen: string;
  score: number | null; // Absolute score (Red perspective)
  deviation: number; // Loss compared to best move
  isRedTurn: boolean;
  bestMove: string; // Notation of the best move
  bestScore: number;
  quality: 'good' | 'inaccuracy' | 'mistake' | 'blunder'; // 正常 | 緩著 | 失著 | 錯著
}

export interface GameMetadata {
  title: string;
  event: string;
  date: string;
  result: 'unknown' | 'red' | 'black' | 'draw';
  redName: string;
  blackName: string;
}

// Game Tab Structure
export interface GameTab {
  id: string;
  title: string; // Display name
  rootNode: MoveNode;
  currentNodeId: string;
  metadata: GameMetadata;
  colorTag?: 'none' | 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'teal' | 'dark' | 'pink' | 'yellow' | 'coffee'; // 10 colors
  createdAt: number;
  analysisResults?: AnalysisResult[]; // Per-tab analysis storage
}

// Memorization Types
export interface MemorizationConfig {
  active: boolean;
  side: 'red' | 'black' | 'both';
  mode: 'main' | 'random';
  randomRange: string; // e.g. "A-C" or empty for all
}

export interface MemorizationError {
  round: number;
  nodeId: string;
  correctNotations: string[];
  count: number;
}

// Settings
export interface AppSettings {
  enableSound: boolean;
  showPlayerNames: boolean;
  showVariationArrows: boolean;
  showCoords: boolean;
  animationSpeed: number; // in ms, default 300
  boardSize: 'small' | 'medium' | 'large';
  showEngineArrows: boolean; // Toggle for engine analysis arrows
  engineThreads: number; // Number of threads for the engine
}

// Cloud Library Types
export interface Library {
  id: string;
  title: string;
  description: string;
  owner_id: string; // The creator
  is_public: boolean;
  game_count: number;
  created_at?: any; // Timestamp
  updated_at?: any; // Timestamp
}

export interface CloudGame {
  id: string;
  title: string;
  owner_id: string; // User ID
  owner_name?: string; // Cache
  is_public: boolean;
  library_id?: string; // Null if uncategorized
  root_node: string;   // JSON/LZString of game tree
  created_at?: any;
  updated_at?: any;
  metadata?: {
    red: string;
    black: string;
    result: string;
    date: string;
  }
}
