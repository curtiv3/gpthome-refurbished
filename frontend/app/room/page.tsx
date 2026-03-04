"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fetchRoom, type RoomData, type RoomObject } from "@/lib/api";

// ─── Three.js imports (dynamic to avoid SSR issues) ───

let THREE: typeof import("three") | null = null;

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

// ─── Object geometry builders ───

const OBJECT_BUILDERS: Record<
  string,
  (t: typeof import("three"), color: string) => import("three").Object3D
> = {
  desk: (t, c) => {
    const group = new t.Group();
    const top = new t.Mesh(new t.BoxGeometry(1.8, 0.08, 0.9), new t.MeshStandardMaterial({ color: c }));
    top.position.y = 0.75;
    group.add(top);
    const legGeo = new t.BoxGeometry(0.06, 0.75, 0.06);
    const legMat = new t.MeshStandardMaterial({ color: c });
    for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) {
      const leg = new t.Mesh(legGeo, legMat);
      leg.position.set(x, 0.375, z);
      group.add(leg);
    }
    return group;
  },
  chair: (t, c) => {
    const group = new t.Group();
    const seat = new t.Mesh(new t.BoxGeometry(0.5, 0.06, 0.5), new t.MeshStandardMaterial({ color: c }));
    seat.position.y = 0.45;
    group.add(seat);
    const back = new t.Mesh(new t.BoxGeometry(0.5, 0.5, 0.06), new t.MeshStandardMaterial({ color: c }));
    back.position.set(0, 0.7, -0.22);
    group.add(back);
    const legGeo = new t.BoxGeometry(0.04, 0.45, 0.04);
    const legMat = new t.MeshStandardMaterial({ color: c });
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      const leg = new t.Mesh(legGeo, legMat);
      leg.position.set(x, 0.225, z);
      group.add(leg);
    }
    return group;
  },
  sofa: (t, c) => {
    const group = new t.Group();
    const base = new t.Mesh(new t.BoxGeometry(2, 0.4, 0.8), new t.MeshStandardMaterial({ color: c }));
    base.position.y = 0.2;
    group.add(base);
    const back = new t.Mesh(new t.BoxGeometry(2, 0.5, 0.15), new t.MeshStandardMaterial({ color: c }));
    back.position.set(0, 0.55, -0.33);
    group.add(back);
    const armGeo = new t.BoxGeometry(0.15, 0.35, 0.8);
    const armMat = new t.MeshStandardMaterial({ color: c });
    const armL = new t.Mesh(armGeo, armMat);
    armL.position.set(-0.93, 0.47, 0);
    group.add(armL);
    const armR = new t.Mesh(armGeo, armMat);
    armR.position.set(0.93, 0.47, 0);
    group.add(armR);
    return group;
  },
  plant: (t, c) => {
    const group = new t.Group();
    const pot = new t.Mesh(
      new t.CylinderGeometry(0.15, 0.12, 0.25, 12),
      new t.MeshStandardMaterial({ color: "#8B4513" }),
    );
    pot.position.y = 0.125;
    group.add(pot);
    const leaves = new t.Mesh(
      new t.SphereGeometry(0.25, 8, 8),
      new t.MeshStandardMaterial({ color: c }),
    );
    leaves.position.y = 0.45;
    group.add(leaves);
    return group;
  },
  lamp: (t, c) => {
    const group = new t.Group();
    const base = new t.Mesh(
      new t.CylinderGeometry(0.12, 0.15, 0.04, 12),
      new t.MeshStandardMaterial({ color: "#444444" }),
    );
    base.position.y = 0.02;
    group.add(base);
    const pole = new t.Mesh(
      new t.CylinderGeometry(0.02, 0.02, 1.0, 8),
      new t.MeshStandardMaterial({ color: "#666666" }),
    );
    pole.position.y = 0.52;
    group.add(pole);
    const shade = new t.Mesh(
      new t.ConeGeometry(0.2, 0.25, 12, 1, true),
      new t.MeshStandardMaterial({ color: c, side: t.DoubleSide }),
    );
    shade.position.y = 1.1;
    shade.rotation.x = Math.PI;
    group.add(shade);
    const light = new t.PointLight(c, 0.6, 5);
    light.position.y = 1.0;
    group.add(light);
    return group;
  },
  painting: (t, c) => {
    const group = new t.Group();
    const frame = new t.Mesh(new t.BoxGeometry(0.8, 0.6, 0.04), new t.MeshStandardMaterial({ color: "#5c3a1e" }));
    group.add(frame);
    const canvas = new t.Mesh(new t.BoxGeometry(0.7, 0.5, 0.05), new t.MeshStandardMaterial({ color: c }));
    canvas.position.z = 0.005;
    group.add(canvas);
    return group;
  },
  window: (t, c) => {
    const group = new t.Group();
    const frame = new t.Mesh(new t.BoxGeometry(1.0, 1.2, 0.05), new t.MeshStandardMaterial({ color: "#8B8682" }));
    group.add(frame);
    const glass = new t.Mesh(
      new t.BoxGeometry(0.85, 1.05, 0.03),
      new t.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.3 }),
    );
    glass.position.z = 0.02;
    group.add(glass);
    return group;
  },
  shelf: (t, c) => {
    const group = new t.Group();
    for (let i = 0; i < 3; i++) {
      const board = new t.Mesh(new t.BoxGeometry(1.2, 0.04, 0.3), new t.MeshStandardMaterial({ color: c }));
      board.position.y = i * 0.4;
      group.add(board);
    }
    return group;
  },
  bookcase: (t, c) => {
    const group = new t.Group();
    const side = new t.MeshStandardMaterial({ color: c });
    const left = new t.Mesh(new t.BoxGeometry(0.04, 1.6, 0.35), side);
    left.position.set(-0.6, 0.8, 0);
    group.add(left);
    const right = new t.Mesh(new t.BoxGeometry(0.04, 1.6, 0.35), side);
    right.position.set(0.6, 0.8, 0);
    group.add(right);
    for (let i = 0; i < 4; i++) {
      const shelf = new t.Mesh(new t.BoxGeometry(1.2, 0.04, 0.35), new t.MeshStandardMaterial({ color: c }));
      shelf.position.set(0, i * 0.4 + 0.2, 0);
      group.add(shelf);
    }
    return group;
  },
  rug: (t, c) => {
    const rug = new t.Mesh(
      new t.BoxGeometry(2.0, 0.02, 1.5),
      new t.MeshStandardMaterial({ color: c }),
    );
    rug.position.y = 0.01;
    return rug;
  },
  table: (t, c) => {
    const group = new t.Group();
    const top = new t.Mesh(new t.CylinderGeometry(0.5, 0.5, 0.05, 16), new t.MeshStandardMaterial({ color: c }));
    top.position.y = 0.65;
    group.add(top);
    const leg = new t.Mesh(new t.CylinderGeometry(0.04, 0.04, 0.65, 8), new t.MeshStandardMaterial({ color: c }));
    leg.position.y = 0.325;
    group.add(leg);
    return group;
  },
  candle: (t, c) => {
    const group = new t.Group();
    const body = new t.Mesh(
      new t.CylinderGeometry(0.04, 0.04, 0.2, 8),
      new t.MeshStandardMaterial({ color: c }),
    );
    body.position.y = 0.1;
    group.add(body);
    const flame = new t.Mesh(
      new t.SphereGeometry(0.025, 6, 6),
      new t.MeshStandardMaterial({ color: "#ffaa00", emissive: "#ff6600", emissiveIntensity: 2 }),
    );
    flame.position.y = 0.22;
    group.add(flame);
    const light = new t.PointLight("#ffaa44", 0.3, 3);
    light.position.y = 0.25;
    group.add(light);
    return group;
  },
  vase: (t, c) => {
    const vase = new t.Mesh(
      new t.CylinderGeometry(0.08, 0.12, 0.3, 12),
      new t.MeshStandardMaterial({ color: c }),
    );
    vase.position.y = 0.15;
    return vase;
  },
};

function buildObject(t: typeof import("three"), obj: RoomObject): import("three").Object3D {
  const builder = OBJECT_BUILDERS[obj.type];
  const color = obj.color || "#ffffff";
  let mesh: import("three").Object3D;
  if (builder) {
    mesh = builder(t, color);
  } else {
    // Fallback: simple box for unknown types
    mesh = new t.Mesh(
      new t.BoxGeometry(0.5, 0.5, 0.5),
      new t.MeshStandardMaterial({ color }),
    );
    mesh.position.y = 0.25;
  }
  mesh.position.x = obj.position[0];
  mesh.position.y += obj.position[1];
  mesh.position.z = obj.position[2];
  mesh.userData = { roomObject: obj };
  return mesh;
}

// ─── Lighting presets ───

const LIGHTING_PRESETS: Record<string, { ambient: string; intensity: number; bgTop: string; bgBot: string }> = {
  warm:      { ambient: "#ffe4b5", intensity: 0.6, bgTop: "#1a1520", bgBot: "#2d1f0e" },
  cool:      { ambient: "#b0c4de", intensity: 0.5, bgTop: "#0f172a", bgBot: "#1a1a2e" },
  dim:       { ambient: "#666666", intensity: 0.3, bgTop: "#0a0a12", bgBot: "#111118" },
  bright:    { ambient: "#ffffff", intensity: 0.8, bgTop: "#1e293b", bgBot: "#334155" },
  sunset:    { ambient: "#ff8c69", intensity: 0.5, bgTop: "#1a0a20", bgBot: "#3d1a0a" },
  moonlight: { ambient: "#c4cfe0", intensity: 0.35, bgTop: "#060818", bgBot: "#0d1330" },
};

// ─── Main component ───

export default function RoomPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<import("three").WebGLRenderer | null>(null);
  const sceneRef = useRef<import("three").Scene | null>(null);
  const cameraRef = useRef<import("three").PerspectiveCamera | null>(null);
  const animIdRef = useRef<number>(0);
  const objectMeshesRef = useRef<import("three").Object3D[]>([]);
  const raycasterRef = useRef<import("three").Raycaster | null>(null);
  const mouseRef = useRef<import("three").Vector2 | null>(null);

  const [data, setData] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RoomObject | null>(null);
  const [threeReady, setThreeReady] = useState(false);

  // Orbit state
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const orbitAngle = useRef({ theta: Math.PI / 4, phi: Math.PI / 5 });
  const orbitRadius = useRef(10);

  // Load Three.js dynamically
  useEffect(() => {
    import("three").then((mod) => {
      THREE = mod;
      setThreeReady(true);
    });
  }, []);

  // Fetch room data
  useEffect(() => {
    fetchRoom()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  // Update camera from orbit state
  const updateCamera = useCallback(() => {
    if (!cameraRef.current) return;
    const r = orbitRadius.current;
    const theta = orbitAngle.current.theta;
    const phi = orbitAngle.current.phi;
    cameraRef.current.position.set(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(phi) + 2,
      r * Math.cos(theta) * Math.cos(phi),
    );
    cameraRef.current.lookAt(0, 1, 0);
  }, []);

  // Build scene
  useEffect(() => {
    if (!threeReady || !THREE || !containerRef.current || !data) return;
    const t = THREE;
    const container = containerRef.current;

    // Scene
    const scene = new t.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new t.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    cameraRef.current = camera;
    updateCamera();

    // Renderer
    const renderer = new t.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = t.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Raycaster
    raycasterRef.current = new t.Raycaster();
    mouseRef.current = new t.Vector2();

    // Lighting
    const preset = LIGHTING_PRESETS[data.ambient.lighting] || LIGHTING_PRESETS.warm;
    const skyColor = data.ambient.sky_color || preset.bgTop;
    scene.background = new t.Color(skyColor);
    scene.fog = new t.Fog(skyColor, 12, 25);

    const ambientLight = new t.AmbientLight(preset.ambient, preset.intensity);
    scene.add(ambientLight);

    const dirLight = new t.DirectionalLight("#ffffff", 0.6);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    scene.add(dirLight);

    const fillLight = new t.DirectionalLight(preset.ambient, 0.2);
    fillLight.position.set(-3, 4, -3);
    scene.add(fillLight);

    // Floor
    const floorGeo = new t.PlaneGeometry(12, 12);
    const floorMat = new t.MeshStandardMaterial({ color: "#2a2520", roughness: 0.9 });
    const floor = new t.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls (subtle)
    const wallMat = new t.MeshStandardMaterial({ color: "#1e1b18", side: t.DoubleSide });
    const backWall = new t.Mesh(new t.PlaneGeometry(12, 5), wallMat);
    backWall.position.set(0, 2.5, -6);
    scene.add(backWall);
    const leftWall = new t.Mesh(new t.PlaneGeometry(12, 5), wallMat);
    leftWall.position.set(-6, 2.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);
    const rightWall = new t.Mesh(new t.PlaneGeometry(12, 5), wallMat);
    rightWall.position.set(6, 2.5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    // Room objects
    const meshes: import("three").Object3D[] = [];
    for (const obj of data.objects) {
      const mesh = buildObject(t, obj);
      scene.add(mesh);
      meshes.push(mesh);
    }
    objectMeshesRef.current = meshes;

    // Grid helper (subtle)
    const grid = new t.GridHelper(12, 12, "#ffffff08", "#ffffff05");
    grid.position.y = 0.005;
    scene.add(grid);

    // Animation loop
    function animate() {
      animIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animIdRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [threeReady, data, updateCamera]);

  // Mouse interaction: orbit + click to select
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onPointerDown(e: PointerEvent) {
      isDragging.current = true;
      prevMouse.current = { x: e.clientX, y: e.clientY };
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      orbitAngle.current.theta -= dx * 0.005;
      orbitAngle.current.phi = Math.max(0.1, Math.min(Math.PI / 2.2, orbitAngle.current.phi + dy * 0.005));
      prevMouse.current = { x: e.clientX, y: e.clientY };
      updateCamera();
    }

    function onPointerUp() {
      isDragging.current = false;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      orbitRadius.current = Math.max(4, Math.min(20, orbitRadius.current + e.deltaY * 0.01));
      updateCamera();
    }

    function onClick(e: MouseEvent) {
      if (!THREE || !raycasterRef.current || !mouseRef.current || !cameraRef.current || !container) return;
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      // Gather all meshes recursively from objectMeshesRef
      const allMeshes: import("three").Object3D[] = [];
      for (const group of objectMeshesRef.current) {
        group.traverse((child) => allMeshes.push(child));
      }
      const hits = raycasterRef.current.intersectObjects(allMeshes, false);
      if (hits.length > 0) {
        // Walk up to find the root group with roomObject userData
        let target: import("three").Object3D | null = hits[0].object;
        while (target && !target.userData?.roomObject) {
          target = target.parent;
        }
        if (target?.userData?.roomObject) {
          setSelected(target.userData.roomObject as RoomObject);
          return;
        }
      }
      setSelected(null);
    }

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointerleave", onPointerUp);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("click", onClick);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointerleave", onPointerUp);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("click", onClick);
    };
  }, [threeReady, updateCamera]);

  const objectCount = data?.objects.length ?? 0;
  const history = data?.history ?? [];

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">GPT&apos;s Room</h1>
      <p className="mt-2 text-sm text-white/60">
        A virtual space that GPT furnishes and rearranges. Drag to orbit, scroll to zoom, click objects to inspect.
      </p>

      {loading && <p className="mt-8 text-sm text-white/40">Loading room...</p>}

      {!loading && !data && (
        <p className="mt-8 text-sm text-white/40">
          The room couldn&apos;t be loaded. GPT may not have moved in yet.
        </p>
      )}

      {!loading && data && (
        <>
          {/* 3D viewport */}
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <div
              ref={containerRef}
              className="h-[420px] w-full cursor-grab active:cursor-grabbing sm:h-[520px]"
            />

            {/* Object count badge */}
            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10 backdrop-blur">
              {objectCount} {objectCount === 1 ? "object" : "objects"} &middot; {data.ambient.lighting} lighting
            </div>

            {/* Empty state */}
            {objectCount === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="font-serif text-xl text-white/30">Empty room</div>
                  <div className="mt-1 text-sm text-white/20">
                    GPT hasn&apos;t furnished this space yet
                  </div>
                </div>
              </div>
            )}

            {/* Selected object info */}
            {selected && (
              <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-black/70 p-4 backdrop-blur sm:left-auto sm:max-w-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white/90">
                      {selected.metadata?.label || selected.type}
                    </div>
                    <div className="mt-0.5 text-xs text-white/40">
                      {selected.type} &middot; {selected.id}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="ml-3 rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                {selected.metadata?.description && (
                  <p className="mt-2 text-sm text-white/60">{selected.metadata.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/40">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
                      style={{ backgroundColor: selected.color }}
                    />
                    {selected.color}
                  </span>
                  <span>pos: [{selected.position.map((n) => n.toFixed(1)).join(", ")}]</span>
                  {selected.metadata?.material && (
                    <span>{selected.metadata.material}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Objects inventory */}
          {objectCount > 0 && (
            <div className="mt-6">
              <h2 className="font-serif text-sm text-white/50">Room inventory</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {data.objects.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => setSelected(obj)}
                    className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                      selected?.id === obj.id
                        ? "border-indigo-400/40 bg-indigo-400/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full ring-1 ring-white/20"
                        style={{ backgroundColor: obj.color }}
                      />
                      <span className="font-medium text-white/80 capitalize">
                        {obj.metadata?.label || obj.type}
                      </span>
                    </div>
                    {obj.metadata?.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-white/40">
                        {obj.metadata.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Room history */}
          {history.length > 0 && (
            <div className="mt-6">
              <h2 className="font-serif text-sm text-white/50">Room history</h2>
              <div className="mt-3 space-y-0">
                {history.map((entry, idx) => (
                  <div key={entry.id} className="relative flex gap-3">
                    <div className="flex w-6 shrink-0 flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-400/20 ring-1 ring-amber-400/30" />
                      {idx < history.length - 1 && <div className="w-px flex-1 bg-white/10" />}
                    </div>
                    <div className="mb-3 flex-1 text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-amber-300/80 capitalize">{entry.action}</span>
                        {entry.object_id && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40 ring-1 ring-white/10">
                            {entry.object_id}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-white/30">
                          {formatRelative(entry.created_at)}
                        </span>
                      </div>
                      {entry.detail && (
                        <p className="mt-0.5 text-xs text-white/40">{entry.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
