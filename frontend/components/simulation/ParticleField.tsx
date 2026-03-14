"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VisualParams } from "./types";

// --- Soft circular sprite (generated once, reused) ---
let _spriteTexture: THREE.Texture | null = null;
function getSpriteTexture(): THREE.Texture {
  if (_spriteTexture) return _spriteTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.6)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  _spriteTexture = new THREE.CanvasTexture(canvas);
  return _spriteTexture;
}

// --- Simple pseudo-noise (no allocation) ---
function noise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// --- Pre-allocated temp vars (ZERO GC in render loop) ---
const _hsl = { h: 0, s: 0, l: 0 };

interface Props {
  params: VisualParams;
}

/**
 * Core particle system — Casberry-style.
 * Single Points mesh, BufferGeometry, all updates via typed arrays.
 * NO `new` in the render loop. NO allocations. Pure math.
 */
export default function ParticleField({ params }: Props) {
  const pointsRef = useRef<THREE.Points>(null);

  // Current (damped) visual params — mutated in-place, never re-created
  const current = useRef({
    baseSpeed: 0.1,
    noiseStrength: 0.2,
    attractionStrength: 0.4,
    clusterStrength: 0.3,
    pulseIntensity: 0,
    hueBase: 0.6,
    hueRange: 0.1,
    saturation: 0.6,
    lightness: 0.4,
  });

  const count = params.particleCount;

  // Pre-allocate geometry arrays once
  const { positions, colors, seeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sd = new Float32Array(count * 2); // per-particle random seeds

    for (let i = 0; i < count; i++) {
      // Spherical initial distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 15 + Math.random() * 25;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      col[i * 3] = 0.4;
      col[i * 3 + 1] = 0.5;
      col[i * 3 + 2] = 0.8;

      sd[i * 2] = Math.random() * 1000;
      sd[i * 2 + 1] = Math.random() * 1000;
    }
    return { positions: pos, colors: col, seeds: sd };
  }, [count]);

  // Animation loop — called every frame
  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const colAttr = geo.attributes.color as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;

    const t =
      performance.now() * 0.001; // seconds

    // Smooth damp current params toward targets (NEVER hard-set)
    const damp = Math.min(1, delta * 1.5); // ~0.025 at 60fps
    const c = current.current;
    c.baseSpeed += (params.baseSpeed - c.baseSpeed) * damp;
    c.noiseStrength += (params.noiseStrength - c.noiseStrength) * damp;
    c.attractionStrength += (params.attractionStrength - c.attractionStrength) * damp;
    c.clusterStrength += (params.clusterStrength - c.clusterStrength) * damp;
    c.pulseIntensity += (params.pulseIntensity - c.pulseIntensity) * damp;
    c.hueBase += (params.hueBase - c.hueBase) * damp;
    c.hueRange += (params.hueRange - c.hueRange) * damp;
    c.saturation += (params.saturation - c.saturation) * damp;
    c.lightness += (params.lightness - c.lightness) * damp;

    const speed = c.baseSpeed;
    const noiseStr = c.noiseStrength;
    const attraction = c.attractionStrength;
    const cluster = c.clusterStrength;
    const pulse = c.pulseIntensity;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const s0 = seeds[i * 2];
      const s1 = seeds[i * 2 + 1];

      // Read current position
      let x = posArr[i3];
      let y = posArr[i3 + 1];
      let z = posArr[i3 + 2];

      // Distance from origin
      const dist = Math.sqrt(x * x + y * y + z * z) || 0.001;

      // Spherical angle for this particle (slow orbit)
      const angle = (i / count) * Math.PI * 2 + t * speed * 0.3;
      const elev = Math.sin(s0 * 0.1 + t * speed * 0.15) * 0.8;

      // Target radius with noise
      const nv = noise(s0 + t * 0.2, s1 + t * 0.15);
      const targetR = 20 + nv * noiseStr * 15;

      // Drift toward orbital position
      const targetX =
        Math.cos(angle) * Math.cos(elev) * targetR;
      const targetY = Math.sin(elev) * targetR;
      const targetZ =
        Math.sin(angle) * Math.cos(elev) * targetR;

      // Blend current → target (soft follow, not snap)
      const follow = 0.008 + speed * 0.004;
      x += (targetX - x) * follow;
      y += (targetY - y) * follow;
      z += (targetZ - z) * follow;

      // Attraction toward center
      const attrForce = attraction * 0.002;
      x -= x * attrForce;
      y -= y * attrForce;
      z -= z * attrForce;

      // Cluster effect: particles group into bands
      const clusterGroup = Math.floor(i / 50);
      const clusterAngle = clusterGroup * 1.618 + t * 0.1;
      x += Math.cos(clusterAngle) * cluster * 0.3;
      z += Math.sin(clusterAngle) * cluster * 0.3;

      // Event pulse: radial shockwave
      if (pulse > 0.01) {
        const pulseWave = Math.sin(t * 8 - dist * 0.3) * pulse * 2;
        const nx = dist > 0.001 ? x / dist : 0;
        const ny = dist > 0.001 ? y / dist : 0;
        const nz = dist > 0.001 ? z / dist : 0;
        x += nx * pulseWave;
        y += ny * pulseWave;
        z += nz * pulseWave;
      }

      posArr[i3] = x;
      posArr[i3 + 1] = y;
      posArr[i3 + 2] = z;

      // --- Colour ---
      _hsl.h = c.hueBase + (i / count) * c.hueRange + Math.sin(t * 0.5 + s0) * 0.05;
      _hsl.s = c.saturation;
      _hsl.l = c.lightness + Math.sin(t + i * 0.01) * 0.08;

      // HSL → RGB (inline, zero alloc)
      const hh = ((_hsl.h % 1) + 1) % 1;
      const ss = Math.max(0, Math.min(1, _hsl.s));
      const ll = Math.max(0, Math.min(1, _hsl.l));
      const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
      const p = 2 * ll - q;

      colArr[i3] = hue2rgb(p, q, hh + 1 / 3);
      colArr[i3 + 1] = hue2rgb(p, q, hh);
      colArr[i3 + 2] = hue2rgb(p, q, hh - 1 / 3);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={getSpriteTexture()}
        size={2.2}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// HSL helper — zero allocation
function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}
