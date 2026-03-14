"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import ParticleField from "./ParticleField";
import type { VisualParams } from "./types";

/** Slow camera auto-drift for ambient feel. */
function CameraDrift({ drift }: { drift: number }) {
  const groupRef = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * drift * 0.08;
  });
  return <group ref={groupRef} />;
}

interface Props {
  params: VisualParams;
  className?: string;
}

export default function ParticleScene({ params, className }: Props) {
  return (
    <div className={className}>
      <Canvas
        camera={{
          position: [0, 20, params.cameraDistance],
          fov: 60,
          near: 0.1,
          far: 300,
        }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.05} />
        <ParticleField params={params} />
        <CameraDrift drift={params.cameraDrift} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          autoRotate
          autoRotateSpeed={0.15 + params.cameraDrift * 0.3}
          minDistance={20}
          maxDistance={150}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>
    </div>
  );
}
