import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Vector3, Matrix4 } from "three";

// Types
interface Gaussian {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
}

interface CameraPreset {
  name: string;
  position: [number, number, number];
  lookAt: [number, number, number];
}

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
    color: "#ff4444",
  },
  {
    position: [1, 1, 1],
    scale: [0.8, 1.2, 0.6],
    rotation: [0.2, 0.4, 0.3],
    color: "#44ff44",
  },
  {
    position: [0, 0, 0],
    scale: [0.2, 1.2, 0.2],
    rotation: [0.2, 0.4, 0.3],
    color: "#4444ff",
  },
  {
    position: [0, 1, 0],
    scale: [1.0, 0.5, 0.5],
    rotation: [0.2, 0.4, 0.3],
    color: "#4444ff",
  },
];

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
  fov = 75,
  aspect = 1,
  near = 0.1,
  far = 10,
}: {
  position: [number, number, number];
  lookAt: [number, number, number];
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
        <meshBasicMaterial color="yellow" wireframe />
      </mesh>
      <mesh position={[0, 0, -0.75]}>
        <coneGeometry args={[0.2, 0.5]} />
        <meshBasicMaterial color="yellow" wireframe />
      </mesh>
      <lineSegments geometry={frustumGeometry}>
        <lineBasicMaterial color="yellow" />
      </lineSegments>
    </group>
  );
}

function GaussianEllipsoid({
  position,
  scale,
  rotation,
  color,
  selected,
  onSelect,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
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
        color={hovered ? "hotpink" : color}
        transparent
        opacity={selected ? 0.9 : 0.5}
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
  selected,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
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
          opacity={selected ? 0.6 : 0.4}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={selected ? 1 : 0.8}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
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
    <div className="font-mono text-xs" style={{ color: "#111" }}>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          {row.map((value, j) => (
            <span key={j} className="w-16 text-right">
              {value.toFixed(3)}
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
    <div className="not-prose bg-gray-50 p-4 rounded" style={{ color: "#111" }}>
      <div className="flex gap-2 mb-4">
        {CAMERA_PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => onPresetChange(preset)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              activePreset === preset.name
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
            style={activePreset === preset.name ? {} : { color: "#333" }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold mb-1 text-sm" style={{ color: "#111" }}>
            View Matrix (W)
          </p>
          <MatrixDisplay matrix={viewMatrix} size={4} />
        </div>

        <div>
          {selectedIndex !== null && selectedJacobian ? (
            <>
              <p className="font-bold mb-1 text-sm" style={{ color: "#111" }}>
                Jacobian (J) for Selected
              </p>
              <MatrixDisplay matrix={selectedJacobian} size={3} />
            </>
          ) : (
            <p className="text-sm" style={{ color: "#666" }}>
              Click a Gaussian to see its Jacobian
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Scene() {
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
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 grid grid-cols-2 relative min-h-0">
        <div className="relative border-r border-gray-200">
          <span className="absolute top-2 left-2 z-10 bg-white/90 px-2 py-0.5 text-xs text-gray-600 rounded">
            3D View
          </span>
          <Canvas>
            <PerspectiveCamera makeDefault position={[10, 5, 10]} fov={45} />
            <OrbitControls
              target={new Vector3(0, 0, 0)}
              enablePan={false}
              minDistance={5}
              maxDistance={20}
            />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <CameraFrustum
              position={activePreset.position}
              lookAt={activePreset.lookAt}
            />
            {gaussians.map((g, i) => (
              <GaussianEllipsoid
                key={i}
                {...g}
                selected={selectedIndex === i}
                onSelect={() =>
                  setSelectedIndex(i === selectedIndex ? null : i)
                }
              />
            ))}
            <axesHelper args={[5]} />
          </Canvas>
        </div>

        <div className="relative">
          <span className="absolute top-2 right-2 z-10 bg-white/90 px-2 py-0.5 text-xs text-gray-600 rounded">
            Projection View
          </span>
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
                  position={[projected.x, projected.y, sortIndex * 0.01]} // Slight z offset by sort order
                  selected={selectedIndex === i}
                />
              ))}
            <gridHelper args={[10, 10]} rotation={[Math.PI / 2, 0, 0]} />
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
  return (
    <div className="not-prose w-full h-[580px] bg-gray-100 mb-16">
      <Scene />
    </div>
  );
}
