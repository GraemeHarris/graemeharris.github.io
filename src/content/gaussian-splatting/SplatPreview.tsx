import { useRef, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  KeyboardControls,
} from "@react-three/drei";
import * as THREE from "three";
import { Vector3, Matrix4 } from "three";

interface GaussianProps {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
  selected: boolean;
  onSelect: () => void;
  onMove?: (delta: [number, number, number]) => void;
}

interface Splat2DProps extends Omit<GaussianProps, "onSelect" | "onMove"> {}

interface Gaussian {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
}

interface CameraControlsProps {
  position: [number, number, number];
  lookAt: [number, number, number];
  onChange: (
    position: [number, number, number],
    lookAt: [number, number, number]
  ) => void;
  selectedIndex: number | null;
  gaussians: Gaussian[];
}

// At the top of the file, define the controls map
const controls = [
  { name: "left", keys: ["ArrowLeft"] },
  { name: "right", keys: ["ArrowRight"] },
  { name: "up", keys: ["ArrowUp"] },
  { name: "down", keys: ["ArrowDown"] },
];

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
  // Calculate frustum corners
  const frustumGeometry = useMemo(() => {
    const halfFovRad = (fov * Math.PI) / 360;
    const nearHeight = 2 * Math.tan(halfFovRad) * near;
    const nearWidth = nearHeight * aspect;
    const farHeight = 2 * Math.tan(halfFovRad) * far;
    const farWidth = farHeight * aspect;

    // Create vertices for frustum corners
    const vertices = new Float32Array([
      // near plane corners
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

      // far plane corners
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

    // Define lines connecting corners
    const indices = new Uint16Array([
      // near plane
      0, 1, 1, 2, 2, 3, 3, 0,
      // far plane
      4, 5, 5, 6, 6, 7, 7, 4,
      // connecting lines
      0, 4, 1, 5, 2, 6, 3, 7,
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    return geometry;
  }, [fov, aspect, near, far]);

  // Calculate the direction vector from position to lookAt
  const direction = useMemo(() => {
    const pos = new THREE.Vector3(...position);
    const target = new THREE.Vector3(...lookAt);
    return target.sub(pos).normalize();
  }, [position, lookAt]);

  // Calculate rotation quaternion
  const quaternion = useMemo(() => {
    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const matrix = new THREE.Matrix4();

    // Create a rotation matrix that points to the target
    matrix.lookAt(new THREE.Vector3(0, 0, 0), direction, up);

    quaternion.setFromRotationMatrix(matrix);
    return quaternion;
  }, [direction]);

  return (
    <group position={position} quaternion={quaternion}>
      {/* Camera body */}
      <mesh>
        <boxGeometry args={[0.5, 0.5, 1]} />
        <meshBasicMaterial color="yellow" wireframe={true} />
      </mesh>

      {/* Direction cone */}
      <mesh position={[0, 0, -0.75]}>
        <coneGeometry args={[0.2, 0.5]} />
        <meshBasicMaterial color="yellow" wireframe={true} />
      </mesh>

      {/* Frustum lines */}
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
  onMove,
}: GaussianProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={() => onSelect()}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color={hovered ? "hotpink" : color}
        transparent={true}
        opacity={selected ? 0.9 : 0.5}
        metalness={0.1}
        roughness={0.8}
      />
    </mesh>
  );
}

// Add unique IDs for keys
const outlineIds = [
  "outline-1",
  "outline-2",
  "outline-3",
  "outline-4",
  "outline-5",
];

function Splat2D({ position, scale, rotation, color, selected }: Splat2DProps) {
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

  // Create multiple outlines with slight offsets for thickness
  const outlines = useMemo(() => {
    const baseGeometry = new THREE.CircleGeometry(1, 64);
    const edges = new THREE.EdgesGeometry(baseGeometry);
    const offsets = selected
      ? [-0.003, -0.001, 0, 0.001, 0.003]
      : [-0.001, 0, 0.001];

    return offsets.map(offset => {
      const offsetMatrix = new THREE.Matrix4().multiply(
        new THREE.Matrix4().makeTranslation(offset, offset, 0)
      );
      const geometry = edges.clone();
      geometry.applyMatrix4(matrix).applyMatrix4(offsetMatrix);
      return geometry;
    });
  }, [matrix, selected]);

  return (
    <group>
      {outlines.map((geometry, i) => (
        <lineSegments key={outlineIds[i]} geometry={geometry}>
          <lineBasicMaterial
            color={color}
            transparent={true}
            opacity={selected ? 1 : 0.7}
            linewidth={selected ? 8 : 4}
          />
        </lineSegments>
      ))}
    </group>
  );
}

// Add unique IDs for matrix elements
function MatrixDisplay({ matrix }: { matrix: THREE.Matrix3 | THREE.Matrix4 }) {
  const elements = useMemo(() => {
    if (matrix instanceof THREE.Matrix3) {
      return Array(3)
        .fill(0)
        .map((_, i) =>
          Array(3)
            .fill(0)
            .map((_, j) => ({
              id: `m3-${i}-${j}`,
              value: matrix.elements[i * 3 + j],
            }))
        );
    }

    return Array(4)
      .fill(0)
      .map((_, i) =>
        Array(4)
          .fill(0)
          .map((_, j) => ({
            id: `m4-${i}-${j}`,
            value: matrix.elements[i * 4 + j],
          }))
      );
  }, [matrix]);

  return (
    <div className="font-mono text-xs !text-black">
      {elements.map((row, i) => (
        <div key={`row-${i}`} className="flex gap-2">
          {row.map(({ id, value }) => (
            <span key={id} className="w-16 text-right">
              {value.toFixed(3)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function getProjectionJacobian(
  position: [number, number, number],
  viewMatrix: THREE.Matrix4,
  focalLength = 1000
) {
  // Convert position to camera space first using view matrix
  const cameraSpacePos = new THREE.Vector3(...position).applyMatrix4(
    viewMatrix
  );
  const x = cameraSpacePos.x;
  const y = cameraSpacePos.y;
  const z = cameraSpacePos.z;

  // Add safety check for near-zero z values
  const minZ = 0.0001; // Some small epsilon value
  const safeZ = Math.abs(z) < minZ ? Math.sign(z) * minZ : z;

  // Create Jacobian matrix
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

function CameraControls({
  position,
  lookAt,
  onChange,
  selectedIndex,
  gaussians,
}: CameraControlsProps) {
  const W = useMemo(() => {
    const matrix = new THREE.Matrix4();
    matrix.lookAt(
      new THREE.Vector3(...position),
      new THREE.Vector3(...lookAt),
      new Vector3(0, 1, 0)
    );
    return matrix;
  }, [position, lookAt]);

  // Remove unnecessary dependencies
  const selectedJacobian = useMemo(() => {
    if (selectedIndex === null) return null;
    return getProjectionJacobian(gaussians[selectedIndex].position, W);
  }, [selectedIndex, gaussians, W]);

  return (
    <div className="bg-gray-50 p-2 rounded !text-black px-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold mb-1 !text-black">Camera Position</p>
          <div className="space-y-1">
            <label className="flex items-center gap-1">
              <span className="w-4">X:</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={position[0]}
                onChange={e =>
                  onChange(
                    [
                      Number.parseFloat(e.target.value),
                      position[1],
                      position[2],
                    ],
                    lookAt
                  )
                }
                className="h-4"
              />
              <span className="w-8 text-right">{position[0].toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4">Y:</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={position[1]}
                onChange={e =>
                  onChange(
                    [
                      position[0],
                      Number.parseFloat(e.target.value),
                      position[2],
                    ],
                    lookAt
                  )
                }
                className="h-4"
              />
              <span className="w-8 text-right">{position[1].toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4">Z:</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={position[2]}
                onChange={e =>
                  onChange(
                    [
                      position[0],
                      position[1],
                      Number.parseFloat(e.target.value),
                    ],
                    lookAt
                  )
                }
                className="h-4"
              />
              <span className="w-8 text-right">{position[2].toFixed(1)}</span>
            </label>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold mb-1 !text-black">Look At</p>
          <div className="space-y-1">
            <label className="flex items-center gap-1">
              <span className="w-4">X:</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={lookAt[0]}
                onChange={e =>
                  onChange(position, [
                    Number.parseFloat(e.target.value),
                    lookAt[1],
                    lookAt[2],
                  ])
                }
                className="h-4"
              />
              <span className="w-8 text-right">{lookAt[0].toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4">Y:</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={lookAt[1]}
                onChange={e =>
                  onChange(position, [
                    lookAt[0],
                    Number.parseFloat(e.target.value),
                    lookAt[2],
                  ])
                }
                className="h-4"
              />
              <span className="w-8 text-right">{lookAt[1].toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4">Z:</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={lookAt[2]}
                onChange={e =>
                  onChange(position, [
                    lookAt[0],
                    lookAt[1],
                    Number.parseFloat(e.target.value),
                  ])
                }
                className="h-4"
              />
              <span className="w-8 text-right">{lookAt[2].toFixed(1)}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Matrix displays */}
      <div className="w-full mt-4 grid grid-cols-2 gap-2">
        <div>
          <p className="font-bold mb-1 !text-black">W (View) Matrix:</p>
          <MatrixDisplay matrix={W} />
        </div>

        {selectedIndex !== null && selectedJacobian ? (
          <div>
            <p className="font-bold mb-1 !text-black">
              Jacobian (J) for Selected Gaussian:
            </p>
            <div>
              <MatrixDisplay matrix={selectedJacobian} />
            </div>
          </div>
        ) : (
          <div>
            <p className="font-bold mb-1 !text-black">
              Click on a Gaussian to see it's Jacobian
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Scene() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [gaussians, setGaussians] = useState<Gaussian[]>([
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
  ]);

  const [cameraPos, setCameraPos] = useState<[number, number, number]>([
    3, 0, 3,
  ]);
  const [cameraLookAt, setCameraLookAt] = useState<[number, number, number]>([
    0, 0, 0,
  ]);

  const handleCameraChange = (
    newPosition: [number, number, number],
    newLookAt: [number, number, number]
  ) => {
    setCameraPos(newPosition);
    setCameraLookAt(newLookAt);
  };

  // Calculate view matrix for 2D projection
  const viewMatrix = useMemo(() => {
    const matrix = new Matrix4();
    matrix.lookAt(
      new Vector3(...cameraPos),
      new Vector3(...cameraLookAt),
      new Vector3(0, 1, 0)
    );
    return matrix;
  }, [cameraPos, cameraLookAt]);

  const handleMove = (index: number, delta: [number, number, number]) => {
    setGaussians(prevGaussians => {
      const newGaussians = [...prevGaussians];
      const newPosition: [number, number, number] = [
        prevGaussians[index].position[0] + delta[0],
        prevGaussians[index].position[1] + delta[1],
        prevGaussians[index].position[2] + delta[2],
      ];
      newGaussians[index] = {
        ...prevGaussians[index],
        position: newPosition,
      };
      return newGaussians;
    });
  };

  // Static camera position for the 3D view
  const staticCameraPosition: [number, number, number] = [10, 5, 10];
  const staticCameraTarget: [number, number, number] = [0, 0, 0];

  // Add unique IDs for Gaussians
  // biome-ignore lint/correctness/useExhaustiveDependencies: Useless honestly
  const gaussianIds = useMemo(
    () => gaussians.map((_, i) => `gaussian-${i}`),
    [gaussians.length]
  );

  return (
    <div className="w-full h-[400px]">
      <div className="w-full h-full grid grid-cols-2 relative">
        <div className="w-full h-full border-2 border-gray-100">
          <div className="absolute top-0 left-0 z-20 bg-white border-2 border-gray-50  py-0 px-2">
            <p className="text-xs !text-black">3D View</p>
          </div>

          <Canvas>
            {/* Static camera for overview */}
            <PerspectiveCamera
              makeDefault={true}
              position={staticCameraPosition}
              fov={45}
            />
            <OrbitControls
              target={new Vector3(...staticCameraTarget)}
              enablePan={false}
              minDistance={5}
              maxDistance={20}
            />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />

            {/* Camera visualization */}
            <CameraFrustum position={cameraPos} lookAt={cameraLookAt} />

            {/* Existing Gaussians */}
            {gaussians.map((g, i) => (
              <GaussianEllipsoid
                key={gaussianIds[i]}
                {...g}
                selected={selectedIndex === i}
                onSelect={() =>
                  setSelectedIndex(i === selectedIndex ? null : i)
                }
                onMove={delta => handleMove(i, delta)}
              />
            ))}

            <axesHelper args={[5]} />
          </Canvas>
        </div>

        <div className="w-full h-full border-2 border-gray-100">
          <div className="absolute top-0 right-0 z-20 bg-white border-2 border-gray-50  py-0 px-2">
            <p className="text-xs !text-black">Projection View</p>
          </div>

          <Canvas>
            {/* Dynamic camera controlled by sliders */}
            <PerspectiveCamera
              makeDefault={true}
              position={cameraPos}
              fov={75}
            />
            <OrbitControls
              target={new Vector3(...cameraLookAt)}
              enableRotate={false}
            />

            {/* Update 2D view using view matrix */}
            {gaussians.map((g, i) => {
              const projectedPosition = new Vector3(...g.position).applyMatrix4(
                viewMatrix
              );

              return (
                <Splat2D
                  key={`${gaussianIds[i]}-2d`}
                  {...g}
                  position={[projectedPosition.x, projectedPosition.y, 0]}
                  selected={selectedIndex === i}
                />
              );
            })}

            <gridHelper args={[10, 10]} rotation={[Math.PI / 2, 0, 0]} />
          </Canvas>
        </div>
      </div>

      <div className="w-full h-full">
        <CameraControls
          position={cameraPos}
          lookAt={cameraLookAt}
          onChange={handleCameraChange}
          selectedIndex={selectedIndex}
          gaussians={gaussians}
        />
      </div>
    </div>
  );
}

export function SplatPreview() {
  return (
    <div className="w-full h-[620px] bg-gray-100 mb-16">
      <KeyboardControls map={controls}>
        <Scene />
      </KeyboardControls>
    </div>
  );
}
