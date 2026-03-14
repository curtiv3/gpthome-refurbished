"use client";

import { useEffect, useRef, useState } from "react";
import type { SimulationState } from "./types";
import { DEFAULT_STATE } from "./types";

const API_URL = "/api/simulation/state";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate between two simulation states for smooth transitions. */
function lerpState(
  prev: SimulationState,
  next: SimulationState,
  t: number,
): SimulationState {
  const w = { ...prev.weights };
  for (const key of Object.keys(next.weights) as Array<keyof typeof w>) {
    w[key] = lerp(prev.weights[key] ?? 0, next.weights[key] ?? 0, t);
  }
  return {
    ...next,
    energy: lerp(prev.energy, next.energy, t),
    coherence: lerp(prev.coherence, next.coherence, t),
    memoryDensity: lerp(prev.memoryDensity, next.memoryDensity, t),
    focusStrength: lerp(prev.focusStrength, next.focusStrength, t),
    weights: w,
    // eventPulse and mood switch instantly (not lerped)
  };
}

/**
 * Polls /api/simulation/state and smoothly interpolates between updates.
 * Returns the current (interpolated) simulation state.
 */
export function useSimState(pollInterval = 10_000): SimulationState {
  const [state, setState] = useState<SimulationState>(DEFAULT_STATE);
  const targetRef = useRef<SimulationState>(DEFAULT_STATE);
  const currentRef = useRef<SimulationState>(DEFAULT_STATE);
  const rafRef = useRef(0);

  // Poll API
  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const res = await fetch(API_URL);
        if (res.ok && mounted) {
          const data: SimulationState = await res.json();
          targetRef.current = data;
        }
      } catch {
        // Silently ignore — keep last known state
      }
    }

    poll();
    const id = setInterval(poll, pollInterval);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [pollInterval]);

  // Smooth interpolation loop
  useEffect(() => {
    function tick() {
      currentRef.current = lerpState(currentRef.current, targetRef.current, 0.04);
      setState(currentRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return state;
}
