import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../lib/store';

/**
 * Custom hook to adjust an object's scale based on its distance to the camera,
 * mimicking depth-compensation to maintain a consistent perceived visual size in AR.
 * 
 * @param groupRef The reference to the Three.js Group to scale
 */
export function useDistanceScale(groupRef: React.RefObject<THREE.Group | null>) {
  const isDistanceScaleEnabled = useStore((state) => state.isDistanceScaleEnabled);

  useFrame((state) => {
    if (!groupRef.current) return;

    if (!isDistanceScaleEnabled) {
      // Return smoothly to the standard non-compensated 1.0 scale
      const currentScale = groupRef.current.scale;
      currentScale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      return;
    }

    const camera = state.camera;
    const avatarWorldPosition = new THREE.Vector3();
    groupRef.current.getWorldPosition(avatarWorldPosition);

    // Calculate distance vector from camera to avatar
    const tempV = new THREE.Vector3();
    tempV.copy(avatarWorldPosition).sub(camera.position);

    // Project distance vector onto the camera's forward view direction.
    // This represents the true 'z' depth of the object in the camera coordinate space (Z-buffer/depth buffer depth).
    const forwardDir = new THREE.Vector3();
    camera.getWorldDirection(forwardDir);
    const depth = tempV.dot(forwardDir);

    // Safeguard depth bounds to avoid dividing by close-to-zero or negative values
    const safeDepth = Math.max(0.2, depth);

    // Baseline reference: Let 4.2 meters be the standard 'neutral' distance where scale is exactly 1.0
    const baselineDistance = 4.2;

    // Linear proportional scaling factors
    const rawScaleFactor = safeDepth / baselineDistance;

    // Clamped scaling factor to prevent the avatar from growing to infinite proportions if far, or invisible if extremely close
    const finalScaleFactor = THREE.MathUtils.clamp(rawScaleFactor, 0.45, 2.2);

    // Smoothly interpolate the scale to prevent jerky visual popping
    const targetScale = new THREE.Vector3(finalScaleFactor, finalScaleFactor, finalScaleFactor);
    groupRef.current.scale.lerp(targetScale, 0.15);
  });
}
