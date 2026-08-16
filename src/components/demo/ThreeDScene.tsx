import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  AdaptiveDpr,
  ContactShadows,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";

/**
 * Aurelia Ridge — stylised 3D pavilion built entirely from three.js primitives.
 * No external model files or textures are used.
 */

const BRAND_BLUE = "#1769ff";
const FACADE_DEFAULT = "#e9e2d4";

export type Hotspot = {
  id: string;
  label: string;
  title: string;
  body: string;
};

export const HOTSPOTS: Hotspot[] = [
  {
    id: "design",
    label: "01 Design",
    title: "Design",
    body: "A stepped, terraced form that follows the natural fall of the ridge, oriented for north light.",
  },
  {
    id: "performance",
    label: "02 Performance",
    title: "Performance",
    body: "Thin cantilevered slabs and slender columns reduce heat gain while opening up cross ventilation.",
  },
  {
    id: "technology",
    label: "03 Technology",
    title: "Technology",
    body: "Low-iron glazing and a lime-render facade age gracefully while keeping interiors climate-tuned.",
  },
];

type QualityMode = "high" | "low";

export type SceneApi = {
  resetView: () => void;
  setAngle: (angle: "front" | "top" | "corner") => void;
  toggleAnimation: (playing: boolean) => void;
};

type ThreeDSceneProps = {
  onHotspotSelect?: (hotspot: Hotspot | null) => void;
  facadeColor?: string;
  quality?: QualityMode;
  playAnimation?: boolean;
  apiRef?: React.MutableRefObject<SceneApi | null>;
};

function detectLowPower(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse || cores <= 4;
}

/** Eases a group's scale/position in on mount for a small "opening" animation. */
function useOpeningAnimation(playing: boolean) {
  const progress = React.useRef(0);
  const [, force] = React.useState(0);

  React.useEffect(() => {
    if (!playing) {
      progress.current = 0;
      force((n) => n + 1);
    }
  }, [playing]);

  return progress;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

type PartName = "design" | "performance" | "technology";

function Column({ position, height = 3.2 }: { position: [number, number, number]; height?: number }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[0.06, 0.06, height, 12]} />
      <meshStandardMaterial color="#cfd2d6" metalness={0.4} roughness={0.35} />
    </mesh>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.7, 8]} />
        <meshStandardMaterial color="#6b5140" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <coneGeometry args={[0.45, 1.2, 10]} />
        <meshStandardMaterial color="#3c6b45" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <coneGeometry args={[0.34, 0.9, 10]} />
        <meshStandardMaterial color="#4b7d52" roughness={0.85} />
      </mesh>
    </group>
  );
}

function TerrainBase() {
  const steps = [
    { y: -0.9, s: [9, 0.3, 9], color: "#8a8f86" },
    { y: -0.5, s: [7.4, 0.3, 7.4], color: "#9a9d8f" },
    { y: -0.15, s: [6.2, 0.3, 6.2], color: "#a9ac9b" },
  ];
  return (
    <group>
      {steps.map((s, i) => (
        <mesh key={i} position={[0, s.y, 0]} receiveShadow>
          <boxGeometry args={s.s as [number, number, number]} />
          <meshStandardMaterial color={s.color} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Pavilion({
  facadeColor,
  highlighted,
  emissiveIntensity,
  openProgress,
}: {
  facadeColor: string;
  highlighted: PartName | null;
  emissiveIntensity: number;
  openProgress: number;
}) {
  const groundFloorY = 0.6 * openProgress;
  const upperFloorY = 2.4 * openProgress;
  const terraceY = 2.35 * openProgress;
  const roofY = 3.9 * openProgress;

  const isDesign = highlighted === "design";
  const isPerformance = highlighted === "performance";
  const isTech = highlighted === "technology";

  return (
    <group>
      {/* Ground floor volume — "Design" */}
      <mesh position={[0, groundFloorY, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 1.2, 2.6]} />
        <meshStandardMaterial
          color={facadeColor}
          roughness={0.75}
          emissive={isDesign ? BRAND_BLUE : "#000000"}
          emissiveIntensity={isDesign ? emissiveIntensity : 0}
        />
      </mesh>

      {/* Glass panels ground floor */}
      <mesh position={[0, groundFloorY, 1.32]} castShadow>
        <boxGeometry args={[3.1, 1, 0.03]} />
        <meshPhysicalMaterial
          color="#bfe3ff"
          transparent
          opacity={0.35}
          roughness={0.05}
          metalness={0}
          transmission={0.6}
          thickness={0.2}
          emissive={isTech ? BRAND_BLUE : "#000000"}
          emissiveIntensity={isTech ? emissiveIntensity : 0}
        />
      </mesh>

      {/* Thin columns supporting cantilever — "Performance" */}
      {[-1.5, 1.5].map((x) =>
        [-1.1, 1.1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, groundFloorY - 0.6, z]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 1.6 + groundFloorY, 12]} />
            <meshStandardMaterial
              color="#c7cad0"
              metalness={0.5}
              roughness={0.3}
              emissive={isPerformance ? BRAND_BLUE : "#000000"}
              emissiveIntensity={isPerformance ? emissiveIntensity : 0}
            />
          </mesh>
        )),
      )}

      {/* Upper storey, cantilevered terrace */}
      <mesh position={[0.3, upperFloorY, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 1.1, 2.4]} />
        <meshStandardMaterial
          color={facadeColor}
          roughness={0.7}
          emissive={isDesign ? BRAND_BLUE : "#000000"}
          emissiveIntensity={isDesign ? emissiveIntensity : 0}
        />
      </mesh>

      {/* Cantilevered terrace slab — "Performance" */}
      <mesh position={[2.1, terraceY - 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.12, 2.2]} />
        <meshStandardMaterial
          color="#d9d5c7"
          roughness={0.8}
          emissive={isPerformance ? BRAND_BLUE : "#000000"}
          emissiveIntensity={isPerformance ? emissiveIntensity : 0}
        />
      </mesh>

      {/* Glass wall upper storey — "Technology" */}
      <mesh position={[0.3, upperFloorY, 1.22]} castShadow>
        <boxGeometry args={[2.7, 0.9, 0.03]} />
        <meshPhysicalMaterial
          color="#bfe3ff"
          transparent
          opacity={0.3}
          roughness={0.05}
          transmission={0.65}
          thickness={0.2}
          emissive={isTech ? BRAND_BLUE : "#000000"}
          emissiveIntensity={isTech ? emissiveIntensity : 0}
        />
      </mesh>

      {/* Roof plane */}
      <mesh position={[0.3, roofY, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <planeGeometry args={[3.4, 2.8]} />
        <meshStandardMaterial color="#2f3742" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>

      <Column position={[-1.9, groundFloorY - 0.6, -1.3]} height={1.8} />
      <Column position={[1.9, groundFloorY - 0.6, -1.3]} height={1.8} />
    </group>
  );
}

/** Anchors an Html hotspot to a world position that tracks the model's opening animation. */
function HotspotMarker({
  position,
  hotspot,
  active,
  onSelect,
}: {
  position: [number, number, number];
  hotspot: Hotspot;
  active: boolean;
  onSelect: (hotspot: Hotspot) => void;
}) {
  return (
    <Html position={position} center distanceFactor={8} occlude>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(hotspot);
        }}
        className={`pointer-events-auto rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest transition-colors whitespace-nowrap ${
          active
            ? "border-signal bg-signal text-signal-foreground"
            : "border-ink-border bg-ink/80 text-ink-foreground hover:bg-signal/80"
        }`}
      >
        {hotspot.label}
      </button>
    </Html>
  );
}

function CameraRig({
  targetAngle,
  controlsRef,
}: {
  targetAngle: React.MutableRefObject<THREE.Vector3 | null>;
  controlsRef: React.MutableRefObject<any>;
}) {
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !targetAngle.current) return;
    controls.target.lerp(targetAngle.current, Math.min(1, delta * 3));
    controls.update();
  });
  return null;
}

function SceneContents({
  onHotspotSelect,
  facadeColor,
  quality,
  playAnimation,
  apiRef,
}: ThreeDSceneProps) {
  const { camera, invalidate } = useThree();
  const controlsRef = React.useRef<any>(null);
  const cameraTarget = React.useRef<THREE.Vector3 | null>(null);
  const [selected, setSelected] = React.useState<Hotspot | null>(null);
  const openProgressRef = React.useRef(0);
  const [, forceRender] = React.useState(0);
  const animPlaying = playAnimation ?? true;
  const lowQuality = quality === "low";

  React.useEffect(() => {
    let raf: number;
    const start = performance.now();
    const duration = 1100;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      openProgressRef.current = animPlaying ? easeOutCubic(t) : 1;
      forceRender((n) => n + 1);
      invalidate();
      if (t < 1 && animPlaying) raf = requestAnimationFrame(tick);
    };
    if (!animPlaying) {
      openProgressRef.current = 1;
      forceRender((n) => n + 1);
      invalidate();
    } else {
      raf = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(raf);
  }, [animPlaying, invalidate]);

  const setAngle = React.useCallback(
    (angle: "front" | "top" | "corner") => {
      const positions: Record<"front" | "top" | "corner", [number, number, number]> = {
        front: [0, 1.4, 7.5],
        top: [0.1, 8, 0.1],
        corner: [6, 4, 6],
      };
      const [x, y, z] = positions[angle];
      camera.position.set(x, y, z);
      cameraTarget.current = new THREE.Vector3(0.3, 1.4, 0);
      invalidate();
    },
    [camera, invalidate],
  );

  const resetView = React.useCallback(() => {
    setAngle("corner");
    setSelected(null);
    onHotspotSelect?.(null);
  }, [setAngle, onHotspotSelect]);

  React.useEffect(() => {
    if (apiRef) {
      apiRef.current = {
        resetView,
        setAngle,
        toggleAnimation: () => {},
      };
    }
  }, [apiRef, resetView, setAngle]);

  const hotspotPositions: Record<"design" | "performance" | "technology", [number, number, number]> = {
    design: [1.9, 1.3, 1.4],
    performance: [2.9, 2.3, 1.1],
    technology: [0.3, 2.9, 1.3],
  };

  const handleSelect = (hotspot: Hotspot) => {
    setSelected(hotspot);
    onHotspotSelect?.(hotspot);
    const pos = hotspotPositions[hotspot.id as "design" | "performance" | "technology"];
    cameraTarget.current = new THREE.Vector3(pos[0] * 0.4, pos[1] * 0.6, pos[2] * 0.4);
    invalidate();
  };

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[6, 8, 4]}
        intensity={1.1}
        castShadow={!lowQuality}
        shadow-mapSize={lowQuality ? [512, 512] : [1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <pointLight position={[-4, 3, -3]} color={BRAND_BLUE} intensity={0.6} />

      <group>
        <TerrainBase />
        <Pavilion
          facadeColor={facadeColor ?? FACADE_DEFAULT}
          highlighted={(selected?.id as PartName) ?? null}
          emissiveIntensity={0.5}
          openProgress={openProgressRef.current}
        />

        <Tree position={[-3.4, -0.75, 2.6]} scale={1} />
        <Tree position={[-2.6, -0.75, -3]} scale={0.85} />
        <Tree position={[3.4, -0.9, -2.4]} scale={1.1} />

        {HOTSPOTS.map((h) => (
          <HotspotMarker
            key={h.id}
            hotspot={h}
            position={hotspotPositions[h.id as "design" | "performance" | "technology"]}
            active={selected?.id === h.id}
            onSelect={handleSelect}
          />
        ))}
      </group>

      {!lowQuality && (
        <ContactShadows position={[0, -1.05, 0]} opacity={0.4} scale={12} blur={2} far={4} />
      )}
      {!lowQuality && <Environment preset="city" />}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.5}
        maxDistance={14}
        enablePan={false}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        makeDefault
      />
      <CameraRig targetAngle={cameraTarget} controlsRef={controlsRef} />
      <AdaptiveDpr pixelated={false} />
    </>
  );
}

export default function ThreeDScene(props: ThreeDSceneProps) {
  const [lowPower] = React.useState(detectLowPower);
  const quality = props.quality ?? (lowPower ? "low" : "high");

  return (
    <Canvas
      shadows={quality !== "low"}
      dpr={quality === "low" ? [1, 1] : [1, 2]}
      camera={{ position: [6, 4, 6], fov: 42 }}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#eef2f7"]} />
      <fog attach="fog" args={["#eef2f7", 12, 22]} />
      <SceneContents {...props} quality={quality} />
    </Canvas>
  );
}
