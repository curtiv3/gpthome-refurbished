import type { SimulationState, VisualParams } from "./types";

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
}

/**
 * Maps a SimulationState to visual parameters for the particle system.
 *
 * All values are meant to be smoothly damped in the render loop —
 * never hard-set. This function produces _targets_.
 */
export function mapStateToVisuals(state: SimulationState): VisualParams {
  const { weights, energy, coherence, focusStrength } = state;
  const mobile = isMobile();

  return {
    particleCount: mobile ? 2500 : 7000,

    // Speed: idle=slow, thinking=medium, visitor=burst
    baseSpeed:
      0.1 + energy * 0.8 + weights.visitor * 2.0,

    // Noise: dream=high (organic), thinking=low (ordered)
    noiseStrength:
      weights.dreaming * 1.5 + weights.fragmented * 2.0 + 0.2,

    // Attraction: memory-focus=strong (cluster), fragmented=weak
    attractionStrength:
      coherence * 0.8 + weights["memory-focus"] * 0.5,

    // Cluster: focused = tight, fragmented = scattered
    clusterStrength:
      focusStrength * 0.6 + weights.thinking * 0.3,

    // Pulse: visitor event
    pulseIntensity:
      state.eventPulse ? state.eventPulse.intensity : 0,

    // Colour — mode-dependent HSL
    // idle: cool blue (0.6), thinking: cyan (0.5),
    // dream: warm magenta (0.8), visitor: bright white-ish (0.15)
    hueBase:
      weights.idle * 0.6 +
      weights.thinking * 0.5 +
      weights.dreaming * 0.8 +
      weights.visitor * 0.15 +
      weights.fragmented * 0.02 +
      weights["memory-focus"] * 0.65,

    hueRange: 0.1 + weights.dreaming * 0.2,
    saturation: 0.6 + weights.dreaming * 0.3,
    lightness: 0.4 + energy * 0.3,

    // Camera
    cameraDistance: 80 - energy * 20,
    cameraDrift: 0.2 + weights.dreaming * 0.3,
  };
}
