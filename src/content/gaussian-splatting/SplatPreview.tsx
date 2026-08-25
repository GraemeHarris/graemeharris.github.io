import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Vector3, Matrix4 } from "three";

// Types
interface Gaussian {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  colorKey: SplatColorKey;
}

interface CameraPreset {
  name: string;
  position: [number, number, number];
  lookAt: [number, number, number];
}

type SplatColorKey = "rust" | "sage" | "indigo" | "ochre";

interface Palette {
  splat: Record<SplatColorKey, string>;
  accent: string;
  grid: string;
  gridCentre: string;
  axes: [string, string, string];
  fillOpacity: number;
  ambient: number;
}

/* The scene colours have to be handed to three.js as literals: the site's CSS
   tokens are space-separated `rgb(0 108 172)`, which THREE.Color cannot parse.
   These mirror the light/dark values in src/styles/base.css. DOM elements use
   the skin-* Tailwind tokens directly and need no help here. */
const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    splat: {
      rust: "#a8563c",
      sage: "#4f7a5f",
      indigo: "#42558c",
      ochre: "#9a7a25",
    },
    accent: "#006cac",
    grid: "#cfc8b6",
    gridCentre: "#b3aa96",
    axes: ["#a8563c", "#4f7a5f", "#42558c"],
    fillOpacity: 0.45,
    ambient: 0.6,
  },
  dark: {
    splat: {
      rust: "#e8907c",
      sage: "#8fbfa0",
      indigo: "#93a6da",
      ochre: "#d6b45c",
    },
    accent: "#f88379",
    grid: "#3a3a3a",
    gridCentre: "#4e4e4e",
    axes: ["#e8907c", "#8fbfa0", "#93a6da"],
    fillOpacity: 0.62,
    ambient: 1.1,
  },
};

// Constants - positions chosen to avoid gimbal lock and show meaningful projections
const CAMERA_PRESETS: CameraPreset[] = [
  { name: "Front", position: [0, 1, 6], lookAt: [0, 0, 0] },
  { name: "Side", position: [6, 1, 1], lookAt: [0, 0, 0] },
  { name: "Above", position: [2, 5, 2], lookAt: [0, 0, 0] },
  { name: "Corner", position: [3, 1, 3], lookAt: [0, 0, 0] },
];

const INITIAL_GAUSSIANS: Gaussian[] = [
  {
    position: [-1, 0, 0],
    scale: [1.5, 0.5, 0.8],
    rotation: [0.5, 0.3, 0.1],
    colorKey: "rust",
  },
  {
    position: [1, 1, 1],
    scale: [0.8, 1.2, 0.6],
    rotation: [0.2, 0.4, 0.3],
    colorKey: "sage",
  },
  {
    position: [0, 0, 0],
    scale: [0.2, 1.2, 0.2],
    rotation: [0.2, 0.4, 0.3],
    colorKey: "indigo",
  },
  {
    position: [0, 1, 0],
    scale: [1.0, 0.5, 0.5],
    rotation: [0.2, 0.4, 0.3],
    colorKey: "ochre",
  },
];

// Follows the live theme so the scene colours track the header's theme toggle,
// which flips html[data-theme] without a page load.
function useTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light"
  );

  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

// Utility functions
function getProjectionJacobian(
  position: [number, number, number],
  viewMatrix: THREE.Matrix4,
  focalLength = 1000
): THREE.Matrix3 {
  const cameraSpacePos = new THREE.Vector3(...position).applyMatrix4(
    viewMatrix
  );
  const { x, y, z } = cameraSpacePos;

  const minZ = 0.0001;
  const safeZ = Math.abs(z) < minZ ? Math.sign(z) * minZ : z;

  const matrix = new THREE.Matrix3();
  matrix.set(
    focalLength / safeZ,
    0,
    (-focalLength * x) / (safeZ * safeZ),
    0,
    focalLength / safeZ,
    (-focalLength * y) / (safeZ * safeZ),
    0,
    0,
    1
  );
  return matrix;
}

// Components
function CameraFrustum({
  position,
  lookAt,
  color,
  fov = 75,
  aspect = 1,
  near = 0.1,
  far = 7,
}: {
  position: [number, number, number];
  lookAt: [number, number, number];
  color: string;
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
}) {
  const frustumGeometry = useMemo(() => {
    const halfFovRad = (fov * Math.PI) / 360;
    const nearHeight = 2 * Math.tan(halfFovRad) * near;
    const nearWidth = nearHeight * aspect;
    const farHeight = 2 * Math.tan(halfFovRad) * far;
    const farWidth = farHeight * aspect;

    const vertices = new Float32Array([
      -nearWidth / 2,
      -nearHeight / 2,
      -near,
      nearWidth / 2,
      -nearHeight / 2,
      -near,
      nearWidth / 2,
      nearHeight / 2,
      -near,
      -nearWidth / 2,
      nearHeight / 2,
      -near,
      -farWidth / 2,
      -farHeight / 2,
      -far,
      farWidth / 2,
      -farHeight / 2,
      -far,
      farWidth / 2,
      farHeight / 2,
      -far,
      -farWidth / 2,
      farHeight / 2,
      -far,
    ]);

    const indices = new Uint16Array([
      0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7,
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return geometry;
  }, [fov, aspect, near, far]);

  const quaternion = useMemo(() => {
    const pos = new THREE.Vector3(...position);
    const target = new THREE.Vector3(...lookAt);
    const direction = target.sub(pos).normalize();

    const q = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    matrix.lookAt(
      new THREE.Vector3(0, 0, 0),
      direction,
      new THREE.Vector3(0, 1, 0)
    );
    q.setFromRotationMatrix(matrix);
    return q;
  }, [position, lookAt]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0, -0.75]}>
        <coneGeometry args={[0.2, 0.5]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
      </mesh>
      <lineSegments geometry={frustumGeometry}>
        <lineBasicMaterial color={color} transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
}

// The grid is built by hand rather than via <gridHelper args={...}> so its
// material can be faded back to a printed-rule weight.
function Grid({
  centreColor,
  color,
  size = 10,
  divisions = 10,
}: {
  centreColor: string;
  color: string;
  size?: number;
  divisions?: number;
}) {
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(size, divisions, centreColor, color);
    helper.rotation.set(Math.PI / 2, 0, 0);
    const material = helper.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.5;
    return helper;
  }, [centreColor, color, size, divisions]);

  useEffect(() => () => grid.dispose(), [grid]);

  return <primitive object={grid} />;
}

function Axes({
  colors,
  size = 4,
}: {
  colors: [string, string, string];
  size?: number;
}) {
  const axes = useMemo(() => {
    const helper = new THREE.AxesHelper(size);
    helper.setColors(
      new THREE.Color(colors[0]),
      new THREE.Color(colors[1]),
      new THREE.Color(colors[2])
    );
    const material = helper.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.5;
    return helper;
  }, [colors, size]);

  useEffect(() => () => axes.dispose(), [axes]);

  return <primitive object={axes} />;
}

function GaussianEllipsoid({
  position,
  scale,
  rotation,
  color,
  fillOpacity,
  selected,
  onSelect,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
  fillOpacity: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHover] = useState(false);

  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={onSelect}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={
          selected
            ? fillOpacity + 0.35
            : hovered
              ? fillOpacity + 0.2
              : fillOpacity
        }
        metalness={0.1}
        roughness={0.8}
      />
    </mesh>
  );
}

function Splat2D({
  position,
  scale,
  rotation,
  color,
  fillOpacity,
  selected,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
  fillOpacity: number;
  selected: boolean;
}) {
  const matrix = useMemo(() => {
    const mat = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(new THREE.Euler(0, 0, rotation[2]));
    mat.compose(
      new Vector3(position[0], position[1], 0),
      quaternion,
      new Vector3(scale[0], scale[1], 1)
    );
    return mat;
  }, [position, scale, rotation]);

  const fillGeometry = useMemo(() => {
    const circle = new THREE.CircleGeometry(1, 64);
    circle.applyMatrix4(matrix);
    return circle;
  }, [matrix]);

  const edgeGeometry = useMemo(() => {
    const circle = new THREE.CircleGeometry(1, 64);
    const edges = new THREE.EdgesGeometry(circle);
    edges.applyMatrix4(matrix);
    return edges;
  }, [matrix]);

  return (
    <group>
      <mesh geometry={fillGeometry}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? fillOpacity + 0.2 : fillOpacity}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={selected ? 1 : 0.75}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function PaneLabel({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span
      className={`text-skin-base pointer-events-none absolute top-2 z-10 text-[0.65rem] tracking-[0.18em] uppercase opacity-50 ${
        align === "left" ? "left-3" : "right-3"
      }`}
    >
      {children}
    </span>
  );
}

// Jacobian entries run into the millions (focal length 1000 over a small z), so
// large values collapse to exponential rather than overflowing their column.
function formatEntry(value: number): string {
  return Math.abs(value) >= 1e4 ? value.toExponential(2) : value.toFixed(3);
}

function MatrixDisplay({
  matrix,
  size,
}: {
  matrix: THREE.Matrix3 | THREE.Matrix4;
  size: 3 | 4;
}) {
  const rows = useMemo(() => {
    return Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) => matrix.elements[i * size + j])
    );
  }, [matrix, size]);

  return (
    <div className="text-skin-base font-mono text-[0.7rem] tabular-nums opacity-80">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          {row.map((value, j) => (
            <span key={j} className="w-[4.75rem] text-right">
              {formatEntry(value)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function InfoPanel({
  viewMatrix,
  selectedIndex,
  gaussians,
  activePreset,
  onPresetChange,
}: {
  viewMatrix: THREE.Matrix4;
  selectedIndex: number | null;
  gaussians: Gaussian[];
  activePreset: string;
  onPresetChange: (preset: CameraPreset) => void;
}) {
  const selectedJacobian = useMemo(() => {
    if (selectedIndex === null) return null;
    return getProjectionJacobian(gaussians[selectedIndex].position, viewMatrix);
  }, [selectedIndex, gaussians, viewMatrix]);

  return (
    <div className="text-skin-base pt-3">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <span className="text-[0.65rem] tracking-[0.18em] uppercase opacity-50">
          Camera
        </span>
        {CAMERA_PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => onPresetChange(preset)}
            aria-pressed={activePreset === preset.name}
            className={`focus-outline border-b pb-0.5 text-sm transition-colors ${
              activePreset === preset.name
                ? "border-skin-accent text-skin-accent"
                : "hover:border-skin-base/40 border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[0.65rem] tracking-[0.18em] uppercase opacity-50">
            View matrix (W)
          </p>
          <MatrixDisplay matrix={viewMatrix} size={4} />
        </div>

        <div>
          <p className="mb-1.5 text-[0.65rem] tracking-[0.18em] uppercase opacity-50">
            Jacobian (J)
          </p>
          {selectedIndex !== null && selectedJacobian ? (
            <MatrixDisplay matrix={selectedJacobian} size={3} />
          ) : (
            <p className="text-sm italic opacity-60">
              Click a Gaussian to see its Jacobian.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Scene({ palette }: { palette: Palette }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState(CAMERA_PRESETS[3]); // Start at Corner
  const gaussians = INITIAL_GAUSSIANS;

  const viewMatrix = useMemo(() => {
    const matrix = new Matrix4();
    matrix.lookAt(
      new Vector3(...activePreset.position),
      new Vector3(...activePreset.lookAt),
      new Vector3(0, 1, 0)
    );
    return matrix;
  }, [activePreset]);

  return (
    <div className="flex w-full flex-col">
      {/* Hairlines are derived from the text colour rather than --color-border:
          the dark theme sets that token to the accent, which shouts here. */}
      <div className="border-skin-base/15 grid h-[420px] grid-cols-1 border-y sm:h-[400px] sm:grid-cols-2">
        <div className="border-skin-base/15 relative border-b sm:border-r sm:border-b-0">
          <PaneLabel>3D scene</PaneLabel>
          <Canvas>
            <PerspectiveCamera makeDefault position={[7, 3.5, 7]} fov={45} />
            <OrbitControls
              target={new Vector3(0, 0, 0)}
              enablePan={false}
              minDistance={5}
              maxDistance={20}
            />
            <ambientLight intensity={palette.ambient} />
            <pointLight position={[10, 10, 10]} intensity={80} />
            <CameraFrustum
              position={activePreset.position}
              lookAt={activePreset.lookAt}
              color={palette.accent}
            />
            {gaussians.map((g, i) => (
              <GaussianEllipsoid
                key={i}
                {...g}
                color={palette.splat[g.colorKey]}
                fillOpacity={palette.fillOpacity}
                selected={selectedIndex === i}
                onSelect={() =>
                  setSelectedIndex(i === selectedIndex ? null : i)
                }
              />
            ))}
            <Axes colors={palette.axes} />
          </Canvas>
        </div>

        <div className="relative">
          <PaneLabel align="right">2D projection</PaneLabel>
          <Canvas>
            <PerspectiveCamera
              makeDefault
              position={activePreset.position}
              fov={75}
            />
            <OrbitControls
              target={new Vector3(...activePreset.lookAt)}
              enableRotate={false}
            />
            {gaussians
              .map((g, i) => {
                const projected = new Vector3(...g.position).applyMatrix4(
                  viewMatrix
                );
                return { g, i, projected, depth: projected.z };
              })
              .sort((a, b) => a.depth - b.depth) // Sort back-to-front
              .map(({ g, i, projected }, sortIndex) => (
                <Splat2D
                  key={i}
                  {...g}
                  color={palette.splat[g.colorKey]}
                  fillOpacity={palette.fillOpacity}
                  position={[projected.x, projected.y, sortIndex * 0.01]} // Slight z offset by sort order
                  selected={selectedIndex === i}
                />
              ))}
            <Grid centreColor={palette.gridCentre} color={palette.grid} />
          </Canvas>
        </div>
      </div>

      <InfoPanel
        viewMatrix={viewMatrix}
        selectedIndex={selectedIndex}
        gaussians={gaussians}
        activePreset={activePreset.name}
        onPresetChange={setActivePreset}
      />
    </div>
  );
}

export function SplatPreview() {
  const theme = useTheme();
  const palette = PALETTES[theme];

  return (
    <figure
      className="not-prose text-skin-base my-10 w-full font-serif"
      data-splat-demo
    >
      <Scene palette={palette} />
      <figcaption className="text-skin-base mt-4 text-sm leading-relaxed italic opacity-70">
        Four anisotropic Gaussians and the training camera&rsquo;s frustum
        &mdash; drag the 3D scene to orbit it. The projection pane shows the
        same Gaussians splatted onto that camera&rsquo;s image plane; switch
        cameras to watch each ellipse stretch and shift.
      </figcaption>
    </figure>
  );
}
