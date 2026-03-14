export type SimMode =
  | "idle"
  | "thinking"
  | "dreaming"
  | "visitor"
  | "memory-focus"
  | "fragmented";

export interface SimulationState {
  mode: SimMode;
  energy: number;
  coherence: number;
  memoryDensity: number;
  focusStrength: number;
  recentThoughts: number;
  recentDreams: number;
  recentVisitors: number;
  mood: string;
  eventPulse: { type: string; intensity: number } | null;
  weights: Record<SimMode, number>;
}

export interface VisualParams {
  particleCount: number;
  baseSpeed: number;
  noiseStrength: number;
  attractionStrength: number;
  clusterStrength: number;
  pulseIntensity: number;
  hueBase: number;
  hueRange: number;
  saturation: number;
  lightness: number;
  cameraDistance: number;
  cameraDrift: number;
}

export const DEFAULT_STATE: SimulationState = {
  mode: "idle",
  energy: 0,
  coherence: 0.5,
  memoryDensity: 0,
  focusStrength: 0.4,
  recentThoughts: 0,
  recentDreams: 0,
  recentVisitors: 0,
  mood: "neutral",
  eventPulse: null,
  weights: {
    idle: 1,
    thinking: 0,
    dreaming: 0,
    visitor: 0,
    "memory-focus": 0,
    fragmented: 0,
  },
};
