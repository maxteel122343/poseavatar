import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useStore, DetectedObject, OBJECT_SPECS } from '../lib/store';

// Global utility to compute combined height (detected 3D bounding boxes + reconstructed physical point cloud)
export function getElevationAtGlobal(
  x: number,
  z: number,
  detectedObjects: DetectedObject[],
  depthGridPoints: THREE.Vector3[]
): number {
  let maxElevation = 0;

  // 1. Check against detected AI platforms (boxes)
  for (const obj of detectedObjects) {
    if (!obj.position3D) continue;
    const halfW = obj.width3D / 2;
    const halfD = obj.depth3D / 2;
    if (
      x >= obj.position3D.x - halfW &&
      x <= obj.position3D.x + halfW &&
      z >= obj.position3D.z - halfD &&
      z <= obj.position3D.z + halfD
    ) {
      if (obj.height > maxElevation) {
        maxElevation = obj.height;
      }
    }
  }

  // 2. Sample against the hardware/monocular depth point cloud with a foot-sized radius (0.35m)
  if (depthGridPoints && depthGridPoints.length > 0) {
    for (const pt of depthGridPoints) {
      const dx = pt.x - x;
      const dz = pt.z - z;
      const distSq = dx * dx + dz * dz;

      if (distSq < 0.1225) { // 0.35 * 0.35 search radius in meters
        if (pt.y > maxElevation) {
          maxElevation = pt.y;
        }
      }
    }
  }

  return maxElevation;
}


function ObjectProjector() {
  const detectedObjects = useStore((state) => state.detectedObjects);
  const setDetectedObjects = useStore((state) => state.setDetectedObjects);
  const videoElement = useStore((state) => state.videoElement);
  const setPetPosition3D = useStore((state) => state.setPetPosition3D);
  const { camera, size } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  
  // A mathematical plane representing the floor (Y=0)
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  useFrame(() => {
    if (!videoElement || videoElement.videoWidth === 0 || detectedObjects.length === 0) {
      setPetPosition3D(null);
      return;
    }

    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    const cw = size.width;
    const ch = size.height;

    const videoAspect = vw / vh;
    const containerAspect = cw / ch;

    let renderWidth = cw;
    let renderHeight = ch;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > containerAspect) {
      renderHeight = ch;
      renderWidth = renderHeight * videoAspect;
      offsetX = (cw - renderWidth) / 2;
    } else {
      renderWidth = cw;
      renderHeight = renderWidth / videoAspect;
      offsetY = (ch - renderHeight) / 2;
    }

    let updated = false;
    const projectedObjects = detectedObjects.map((obj) => {
      // Center of bottom of the bounding box
      const pixelX = (obj.box.x + obj.box.width / 2) / vw * renderWidth + offsetX;
      const pixelY = (obj.box.y + obj.box.height) / vh * renderHeight + offsetY;

      const ndcX = (pixelX / cw) * 2 - 1;
      const ndcY = -(pixelY / ch) * 2 + 1;

      // Raycast from camera through NDC onto floor
      raycaster.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const targetPoint = new THREE.Vector3();
      raycaster.current.ray.intersectPlane(floorPlane.current, targetPoint);

      // Verify if target changed significantly to prevent float coordinate drift re-render loops
      if (!obj.position3D || obj.position3D.distanceTo(targetPoint) > 0.04) {
        updated = true;
        // Clone object and save position
        const targetClone = new THREE.Vector3().copy(targetPoint);
        return { ...obj, position3D: targetClone };
      }
      return obj;
    });

    if (updated) {
      setDetectedObjects(projectedObjects);
    }

    // Single central pet position (compatibility mapping for lasers/effects looking at the main pet)
    const activePet = projectedObjects.find((o) => o.class === 'cat' || o.class === 'dog');
    if (activePet && activePet.position3D) {
      setPetPosition3D(activePet.position3D);
    } else {
      // Fallback: use first available detected object if no cats/dogs
      const firstActive = projectedObjects.find(o => o.position3D);
      if (firstActive && firstActive.position3D) {
        setPetPosition3D(firstActive.position3D);
      } else {
        setPetPosition3D(null);
      }
    }
  });

  return null;
}

function ObjectPlatform({ obj }: { obj: DetectedObject }) {
  const setAvatarTarget = useStore((state) => state.setAvatarTarget);
  const selectedTargetObjectId = useStore((state) => state.selectedTargetObjectId);
  const setSelectedTargetObjectId = useStore((state) => state.setSelectedTargetObjectId);
  const isElevationEnabled = useStore((state) => state.isElevationEnabled);

  if (!obj.position3D) return null;

  const isSelected = selectedTargetObjectId === obj.id;
  const spec = OBJECT_SPECS[obj.class] || { height: 0.25, width: 0.35, depth: 0.35, labelPt: obj.class, color: '#facc15' };
  const color = spec.color;
  const label = spec.labelPt;

  const handleSelect = (e: any) => {
    e.stopPropagation();
    setSelectedTargetObjectId(obj.id);
    
    // Jump onto the top surface of the target object if elevation is enabled, else go to ground level
    const targetPos = new THREE.Vector3(
      obj.position3D!.x,
      isElevationEnabled ? obj.height : 0,
      obj.position3D!.z
    );
    setAvatarTarget(targetPos);
  };

  return (
    <group position={[obj.position3D.x, 0, obj.position3D.z]}>
      {/* Semi-transparent neon digital platform */}
      <mesh position={[0, obj.height / 2, 0]} onClick={handleSelect}>
        <boxGeometry args={[obj.width3D, obj.height, obj.depth3D]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={isSelected ? 0.38 : 0.14} 
          wireframe={!isSelected}
          roughness={0.25}
          metalness={0.7}
        />
      </mesh>

      {/* Futuristic ground projection ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[obj.width3D * 0.45, obj.width3D * 0.45 + 0.04, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.8 : 0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Glowing cursor light under the current selected focus */}
      {isSelected && (
        <pointLight position={[0, obj.height + 0.1, 0]} color={color} intensity={1.5} distance={3} />
      )}

      {/* Floating 3D Plate with details */}
      <Html distanceFactor={6} position={[0, obj.height + 0.35, 0]} center>
        <div 
          onClick={handleSelect}
          className="pointer-events-auto flex flex-col items-center gap-1 cursor-pointer select-none transition-all duration-300"
        >
          <div 
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-xl border backdrop-blur-md transition-all duration-200 hover:brightness-110 active:scale-95 animate-fade-in"
            style={{
              backgroundColor: isSelected ? color : 'rgba(9, 9, 11, 0.85)',
              borderColor: color,
              boxShadow: isSelected ? `0 0 12px ${color}55` : 'none',
              transform: isSelected ? 'scale(1.05)' : 'none'
            }}
          >
            <div className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ backgroundColor: isSelected ? '#ffffff' : color }} />
            <span className="whitespace-nowrap tracking-wide">{label}</span>
          </div>
          
          <div className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-zinc-300 tracking-wider">
            Y: {obj.height}m
          </div>
        </div>
      </Html>
    </group>
  );
}

function ElevationSensorBeam() {
  const isElevationEnabled = useStore((state) => state.isElevationEnabled);
  const avatarPosition = useStore((state) => state.avatarPosition);
  const detectedObjects = useStore((state) => state.detectedObjects);
  const { scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const [elevation, setElevation] = useState(0);
  const [intersectionPoint, setIntersectionPoint] = useState<THREE.Vector3 | null>(null);

  useFrame(() => {
    if (!isElevationEnabled || !avatarPosition) {
      setIntersectionPoint(null);
      return;
    }

    // Raycast straight down from high above the avatar (starting at Y = 10)
    const origin = new THREE.Vector3(avatarPosition.x, 10, avatarPosition.z);
    const direction = new THREE.Vector3(0, -1, 0);
    raycaster.current.set(origin, direction);

    // Target the floor and ObjectPlatform meshes
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    let maxElevationPoint = new THREE.Vector3(avatarPosition.x, 0, avatarPosition.z);
    let maxElevation = 0;

    for (const hit of intersects) {
      // Filter out avatar, lasers, guides, etc.
      let isAvatarOrHelper = false;
      let parent: THREE.Object3D | null = hit.object;
      while (parent) {
        if (
          parent.name === 'avatar' || 
          parent.name === 'Avatar' || 
          parent.name.toLowerCase().includes('avatar') ||
          parent.type === 'GridHelper' ||
          parent.type === 'LineSegments' ||
          parent.name.toLowerCase().includes('laser')
        ) {
          isAvatarOrHelper = true;
          break;
        }
        parent = parent.parent;
      }

      if (!isAvatarOrHelper && hit.point.y >= maxElevation) {
        maxElevation = hit.point.y;
        maxElevationPoint.copy(hit.point);
      }
    }

    // Mathematical safety fallback boundary sampler (combining COCO-SSD boxes and high-fidelity depth points)
    const depthGridPoints = useStore.getState().depthGridPoints || [];
    const mathY = getElevationAtGlobal(avatarPosition.x, avatarPosition.z, detectedObjects, depthGridPoints);

    if (mathY > maxElevation) {
      maxElevation = mathY;
      maxElevationPoint.y = mathY;
    }

    setElevation(maxElevation);
    setIntersectionPoint(maxElevationPoint);
  });

  if (!isElevationEnabled || !intersectionPoint) return null;

  return (
    <group>
      {/* Laser visual sampling line (using custom cylinder to avoid Drei line raycast issues) */}
      <mesh 
        position={[avatarPosition.x, (avatarPosition.y + elevation) / 2, avatarPosition.z]}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.006, 0.006, Math.max(0.01, avatarPosition.y - elevation), 8]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
      </mesh>

      {/* Primary surface alignment ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[intersectionPoint.x, intersectionPoint.y + 0.01, intersectionPoint.z]}>
        <ringGeometry args={[0.2, 0.25, 16]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Secondary radar pulse ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[intersectionPoint.x, intersectionPoint.y + 0.015, intersectionPoint.z]}>
        <ringGeometry args={[0.02, 0.35, 16]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* Holographic 3D tag with active altitude metrics */}
      <Html distanceFactor={5.5} position={[intersectionPoint.x, intersectionPoint.y + 0.18, intersectionPoint.z]} center>
        <div className="flex flex-col items-center bg-cyan-950/80 border border-cyan-400/40 rounded px-2 py-0.5 pointer-events-none select-none text-[8px] font-mono text-cyan-300 backdrop-blur-sm shadow-md animate-fade-in whitespace-nowrap">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>ALTITÚDE: {elevation.toFixed(2)}m</span>
          </div>
          <span className="text-[6px] text-zinc-400 font-sans tracking-wide">
            {elevation > 0.01 ? 'SUPERFÍCIE DETECTADA' : 'NÍVEL DO CHÃO'}
          </span>
        </div>
      </Html>
    </group>
  );
}

export function Scene() {
  const setAvatarTarget = useStore((state) => state.setAvatarTarget);
  const isGridVisible = useStore((state) => state.isGridVisible);
  const detectedObjects = useStore((state) => state.detectedObjects);
  const autoJumpMode = useStore((state) => state.autoJumpMode);
  const isElevationEnabled = useStore((state) => state.isElevationEnabled);

  const { scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());

  // Mathematical retrieval of elevation values
  const getElevationAt = (x: number, z: number) => {
    const depthGridPoints = useStore.getState().depthGridPoints || [];
    return getElevationAtGlobal(x, z, detectedObjects, depthGridPoints);
  };

  // Keep target height synchronised whenever elevation mode toggles
  useEffect(() => {
    const currentTarget = useStore.getState().targetAvatarPosition;
    let targetY = 0;
    if (isElevationEnabled) {
      targetY = getElevationAt(currentTarget.x, currentTarget.z);
    }
    const updatedTarget = new THREE.Vector3(currentTarget.x, targetY, currentTarget.z);
    setAvatarTarget(updatedTarget);
  }, [isElevationEnabled]);

  // Auto-Jump system (Patrolling environment of multiple recognized items)
  useEffect(() => {
    if (!autoJumpMode || detectedObjects.length === 0) return;

    const interval = setInterval(() => {
      const validObjects = detectedObjects.filter(o => o.position3D);
      if (validObjects.length === 0) return;

      const randomIndex = Math.floor(Math.random() * validObjects.length);
      const chosen = validObjects[randomIndex];

      if (chosen.position3D) {
        const targetPos = new THREE.Vector3(
          chosen.position3D.x,
          isElevationEnabled ? chosen.height : 0,
          chosen.position3D.z
        );
        // Desloca o avatar para o novo objeto
        useStore.setState({ selectedTargetObjectId: chosen.id });
        setAvatarTarget(targetPos);
      }
    }, 6500);

    return () => clearInterval(interval);
  }, [autoJumpMode, detectedObjects, isElevationEnabled, setAvatarTarget]);

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight 
        position={[6, 12, 6]} 
        intensity={1.8} 
        castShadow 
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />
      
      {/* Computes all objects real 3D coordinates based on 2D boxes */}
      <ObjectProjector />

      {/* Dynamic visual elevation sensor beam projecting down from the avatar */}
      <ElevationSensorBeam />

      {/* Render beautiful AR plates in 3D representing real-world surfaces */}
      {detectedObjects.map((obj) => (
        <ObjectPlatform key={obj.id} obj={obj} />
      ))}
      
      {/* Floor to receive shadow & clicks */}
      <mesh 
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        onPointerDown={(e) => {
          e.stopPropagation();
          // Reset custom selection highlight when tapping plain floor
          useStore.setState({ selectedTargetObjectId: null });

          let targetY = e.point.y; 
          if (isElevationEnabled) {
            // Dual-layer height detection: Three.js raycasting and boundary check
            const origin = new THREE.Vector3(e.point.x, 10, e.point.z);
            const direction = new THREE.Vector3(0, -1, 0);
            raycaster.current.set(origin, direction);
            
            const intersects = raycaster.current.intersectObjects(scene.children, true);
            
            let maxHitY = 0;
            for (const hit of intersects) {
              let isAvatarOrHelper = false;
              let parent: THREE.Object3D | null = hit.object;
              while (parent) {
                if (
                  parent.name === 'avatar' || 
                  parent.name === 'Avatar' || 
                  parent.name.toLowerCase().includes('avatar') ||
                  parent.type === 'GridHelper' ||
                  parent.type === 'LineSegments' ||
                  parent.name.toLowerCase().includes('laser')
                ) {
                  isAvatarOrHelper = true;
                  break;
                }
                parent = parent.parent;
              }
              if (!isAvatarOrHelper && hit.point.y > maxHitY) {
                maxHitY = hit.point.y;
              }
            }

            const mathY = getElevationAt(e.point.x, e.point.z);
            targetY = Math.max(maxHitY, mathY);
          } else {
            targetY = 0;
          }

          const finalPoint = new THREE.Vector3(e.point.x, targetY, e.point.z);
          setAvatarTarget(finalPoint);
        }}
      >
        <planeGeometry args={[100, 100]} />
        <shadowMaterial opacity={0.35} />
      </mesh>
      
      {/* Grid helper */}
      {isGridVisible && (
        <gridHelper 
          args={[30, 30, '#ffffff', '#888888']} 
          position={[0, 0.001, 0]}
          material-opacity={0.15} 
          material-transparent 
          name="GridHelper"
        />
      )}
    </>
  );
}
