import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { useStore } from '../lib/store';
import { useDistanceScale } from '../hooks/useDistanceScale';

export function Avatar() {
  const groupRef = useRef<THREE.Group>(null);
  const scaleGroupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const laserRef = useRef<THREE.Mesh>(null);
  const laserMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  // Custom parts for animation
  const leftEarRef = useRef<THREE.Mesh>(null);
  const rightEarRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  
  // Paw/Leg refs for walking cycle
  const pawLF = useRef<THREE.Mesh>(null);
  const pawRF = useRef<THREE.Mesh>(null);
  const pawLB = useRef<THREE.Mesh>(null);
  const pawRB = useRef<THREE.Mesh>(null);

  // Material Refs for dynamic frame animations (Linter friendly & performant)
  const antennaLightRef = useRef<THREE.MeshStandardMaterial>(null);
  const innerShieldMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const outerShieldMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  // Particle Refs
  const particlesGroupRef = useRef<THREE.Group>(null);
  const particleMeshesRef = useRef<(THREE.Mesh | null)[]>([]);

  // State values
  const targetAvatarPosition = useStore((state) => state.targetAvatarPosition);
  const updateAvatarPosition = useStore((state) => state.updateAvatarPosition);
  const petPosition3D = useStore((state) => state.petPosition3D);
  const avatarType = useStore((state) => state.avatarType);
  const isShieldActive = useStore((state) => state.isShieldActive);
  const interactionMode = useStore((state) => state.interactionMode);

  // Apply distance-dependent proportional scale auto-adjustment
  useDistanceScale(scaleGroupRef);

  // Initialize particle array size
  useEffect(() => {
    particleMeshesRef.current = particleMeshesRef.current.slice(0, 10);
  }, []);

  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  // GSAP movement and squashing/stretching physics-driven jumping animation
  useEffect(() => {
    if (!groupRef.current) return;

    const startX = groupRef.current.position.x;
    const startY = groupRef.current.position.y;
    const startZ = groupRef.current.position.z;

    const endX = targetAvatarPosition.x;
    const endY = targetAvatarPosition.y;
    const endZ = targetAvatarPosition.z;

    const distH = new THREE.Vector2(startX, startZ).distanceTo(new THREE.Vector2(endX, endZ));
    const distY = Math.abs(endY - startY);
    const isSignificantMove = distH > 0.05 || distY > 0.05;

    // Kill any active timeline
    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    // Always reset scale and pitch/roll to baseline first to start cleanly
    groupRef.current.scale.set(1, 1, 1);
    groupRef.current.rotation.set(0, groupRef.current.rotation.y, 0);

    if (!isSignificantMove) {
      groupRef.current.position.copy(targetAvatarPosition);
      updateAvatarPosition(targetAvatarPosition);
      return;
    }

    const isJump = distY > 0.1 || distH > 0.5;
    const duration = Math.min(1.4, Math.max(0.65, distH * 0.45 + distY * 0.75));

    const animState = {
      progress: 0,
    };

    const tl = gsap.timeline({
      onUpdate: () => {
        if (!groupRef.current) return;
        
        const curProgress = animState.progress;
        
        // 1. Horizontal path interpolation
        const currentX = THREE.MathUtils.lerp(startX, endX, curProgress);
        const currentZ = THREE.MathUtils.lerp(startZ, endZ, curProgress);

        // 2. Parabolic vertical height calculation
        const baselineY = THREE.MathUtils.lerp(startY, endY, curProgress);
        const jumpHeightPeak = isJump ? (0.45 + Math.max(distY * 0.5, distH * 0.15)) : 0.05;
        const currentY = baselineY + Math.sin(curProgress * Math.PI) * jumpHeightPeak;

        groupRef.current.position.set(currentX, currentY, currentZ);
        updateAvatarPosition(groupRef.current.position);
      },
      onComplete: () => {
        if (groupRef.current) {
          groupRef.current.scale.set(1, 1, 1);
          groupRef.current.rotation.set(0, groupRef.current.rotation.y, 0);
        }
      }
    });

    timelineRef.current = tl;

    if (isJump) {
      // Step A: Anticipation Squash (compress body from ground up)
      tl.to(groupRef.current.scale, {
        y: 0.65,
        x: 1.25,
        z: 1.25,
        duration: 0.14,
        ease: 'power1.out'
      });

      // Step B: Takeoff Stretch (shoot upwards elongating figure)
      tl.to(groupRef.current.scale, {
        y: 1.35,
        x: 0.8,
        z: 0.8,
        duration: duration * 0.35,
        ease: 'power1.in'
      }, '>-0.02');

      // Step C: Translation & Airtime
      tl.to(animState, {
        progress: 1,
        duration: duration,
        ease: 'power1.inOut'
      }, '>-0.1');

      // Step D: Stylish backflip/aerial rotation if it is a major jump
      if (distH > 0.8 || distY > 0.18) {
        tl.to(groupRef.current.rotation, {
          x: Math.PI * 2,
          duration: duration * 0.85,
          ease: 'power1.inOut'
        }, '>-0.6');
      }

      // Step E: Landing Impact Squash (cushion the weight)
      tl.to(groupRef.current.scale, {
        y: 0.62,
        x: 1.3,
        z: 1.3,
        duration: 0.15,
        ease: 'power2.out'
      }, '>-0.05');

      // Step F: Elastic rebound back to perfect default proportion
      tl.to(groupRef.current.scale, {
        y: 1,
        x: 1,
        z: 1,
        duration: 0.4,
        ease: 'elastic.out(1.1, 0.4)'
      }, '>');

    } else {
      // Cute walking traversal for baseline plane navigation
      tl.to(animState, {
        progress: 1,
        duration: duration,
        ease: 'power1.inOut'
      });
    }

    return () => {
      if (tl) tl.kill();
    };
  }, [targetAvatarPosition]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const currentPos = groupRef.current.position;
    
    // Calculate horizontal distance and progress
    const distToTargetH = new THREE.Vector2(currentPos.x, currentPos.z).distanceTo(
      new THREE.Vector2(targetAvatarPosition.x, targetAvatarPosition.z)
    );
    
    const isMoving = distToTargetH > 0.08 || Math.abs(currentPos.y - targetAvatarPosition.y) > 0.04;
    const hasPet = !!petPosition3D;

    // 1. Position tracking updated automatically by GSAP, propagate coordinates
    updateAvatarPosition(currentPos);

    // 2. Walking Bobbing & Paw Swing Animations
    let bob = 0;
    let swing = 0;
    if (isMoving) {
      // Bob up and down as model walks
      bob = Math.sin(time * 12) * 0.08;
      // Sway left/right slightly
      groupRef.current.rotation.z = Math.sin(time * 6) * 0.05;
      
      // Swing paws
      swing = Math.sin(time * 12);
    } else {
      // Breathing bobbing
      bob = Math.sin(time * 2.5) * 0.02;
    }

    if (bodyRef.current) {
      bodyRef.current.position.y = 0.45 + bob;
    }
    if (headRef.current) {
      headRef.current.position.y = 0.95 + bob * 1.3;
    }

    // Move paws/feet based on walking swing
    if (pawLF.current) pawLF.current.position.y = 0.1 + (isMoving ? Math.max(0, swing) * 0.12 : 0);
    if (pawRF.current) pawRF.current.position.y = 0.1 + (isMoving ? Math.max(0, -swing) * 0.12 : 0);
    if (pawLB.current) pawLB.current.position.y = 0.1 + (isMoving ? Math.max(0, -swing) * 0.12 : 0);
    if (pawRB.current) pawRB.current.position.y = 0.1 + (isMoving ? Math.max(0, swing) * 0.12 : 0);

    if (pawLF.current) pawLF.current.position.z = 0.2 + (isMoving ? swing * 0.15 : 0);
    if (pawRF.current) pawRF.current.position.z = 0.2 + (isMoving ? -swing * 0.15 : 0);
    if (pawLB.current) pawLB.current.position.z = -0.2 + (isMoving ? -swing * 0.15 : 0);
    if (pawRB.current) pawRB.current.position.z = -0.2 + (isMoving ? swing * 0.15 : 0);

    // 3. Ear and Tail animations
    if (leftEarRef.current) {
      leftEarRef.current.rotation.z = -0.2 + (isMoving ? Math.sin(time * 12) * 0.15 : Math.sin(time * 2) * 0.03);
    }
    if (rightEarRef.current) {
      rightEarRef.current.rotation.z = 0.2 - (isMoving ? Math.sin(time * 12) * 0.15 : Math.sin(time * 2) * 0.03);
    }
    if (tailRef.current) {
      // Wiggle faster when happy or near a pet
      const tailSpeed = hasPet ? 20 : (isMoving ? 14 : 4);
      const tailAmp = hasPet ? 0.6 : (isMoving ? 0.4 : 0.15);
      tailRef.current.rotation.y = Math.sin(time * tailSpeed) * tailAmp;
      tailRef.current.rotation.z = Math.cos(time * tailSpeed) * (tailAmp * 0.4);
    }

    // Material dynamic glow and opacity updates in frame
    if (antennaLightRef.current) {
      antennaLightRef.current.emissiveIntensity = 1.5 + Math.sin(time * 10) * 0.5;
    }
    if (innerShieldMaterialRef.current) {
      innerShieldMaterialRef.current.opacity = 0.06 + Math.sin(time * 4) * 0.03;
    }
    if (outerShieldMaterialRef.current) {
      outerShieldMaterialRef.current.opacity = 0.16 + Math.sin(time * 3) * 0.07;
    }

    // 4. Smooth Rotation/LookAt Logic
    if (hasPet && petPosition3D) {
      // Look at the pet!
      const lookTarget = new THREE.Vector3().copy(petPosition3D);
      lookTarget.y = currentPos.y; // Keep body upright
      
      const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(currentPos, lookTarget, new THREE.Vector3(0, 1, 0))
      );
      groupRef.current.quaternion.slerp(targetQuaternion, delta * 6);
      
      // Head looks up/down slightly to face the exact pet coordinates
      if (headRef.current) {
        headRef.current.lookAt(petPosition3D);
      }
    } else {
      // Look in direction of touch/click movement
      if (isMoving) {
        const lookTarget = new THREE.Vector3().copy(targetAvatarPosition);
        lookTarget.y = currentPos.y;
        const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(currentPos, lookTarget, new THREE.Vector3(0, 1, 0))
        );
        groupRef.current.quaternion.slerp(targetQuaternion, delta * 5);
      }
      
      // Reset head level when no pet or still
      if (headRef.current) {
        const targetHeadRot = new THREE.Euler(0, 0, 0);
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetHeadRot.x, delta * 5);
        headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetHeadRot.y, delta * 5);
        headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, targetHeadRot.z, delta * 5);
      }
    }

    // 5. Interaction Laser Cone setup
    let isScanning = false;
    if (hasPet && petPosition3D) {
      const dist = currentPos.distanceTo(petPosition3D);
      if (dist < 2.3) {
        isScanning = true;
      }
    }

    if (laserRef.current && laserMaterialRef.current) {
      laserRef.current.visible = isScanning;
      if (isScanning && petPosition3D) {
        laserRef.current.lookAt(petPosition3D);
        const dist = currentPos.distanceTo(petPosition3D);
        laserRef.current.scale.set(1, 1, dist);
        // Neon pulse
        laserMaterialRef.current.opacity = 0.4 + Math.sin(time * 15) * 0.18;
      }
    }

    // 6. Hearts & Sparkle Particles Logic
    const isInteracting = interactionMode === 'happy' || interactionMode === 'sparkles';
    if (particlesGroupRef.current) {
      particleMeshesRef.current.forEach((mesh, index) => {
        if (!mesh) return;

        if (isInteracting && hasPet && petPosition3D) {
          // Stream particles from our head towards the pet
          const seed = index * 42.42;
          const progress = ((time + seed) % 2) / 2; // Loop progress 0 to 1
          
          const startPt = new THREE.Vector3(0, 1.0, 0).add(currentPos);
          const endPt = new THREE.Vector3().copy(petPosition3D).add(new THREE.Vector3(0, 0.4, 0));

          // Interpolated parabolic trajectory
          const currentPt = new THREE.Vector3().lerpVectors(startPt, endPt, progress);
          // Add arch/height curve
          currentPt.y += Math.sin(progress * Math.PI) * 1.2;
          // Add noise/spread
          currentPt.x += Math.cos(time * 4 + seed) * 0.15;
          currentPt.z += Math.sin(time * 4 + seed) * 0.15;

          mesh.position.copy(currentPt);
          
          // Rotate and scale up/down
          mesh.rotation.x = time * 2 + seed;
          mesh.rotation.y = time * 3;
          
          const scale = Math.sin(progress * Math.PI) * (avatarType === 'fofo' ? 0.13 : 0.09);
          mesh.scale.set(scale, scale, scale);
        } else {
          // Shrink and deactivate particles
          mesh.scale.set(0, 0, 0);
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} name="avatar">
      <group ref={scaleGroupRef}>
        {/* 1. FOFO CHARACTER MODEL (Beige golden fluffy animal mascot) */}
      {avatarType === 'fofo' && (
        <group>
          {/* Main Body */}
          <mesh ref={bodyRef} position={[0, 0.45, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.34, 0.4, 16, 16]} />
            <meshStandardMaterial color="#EAC082" roughness={0.7} metalness={0.05} />
          </mesh>

          {/* Head & Face Setup */}
          <group ref={headRef} position={[0, 0.95, 0]}>
            {/* Cute Rounded Head */}
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[0.38, 32, 32]} />
              <meshStandardMaterial color="#ECC98F" roughness={0.65} />
            </mesh>
            
            {/* Soft pink snout */}
            <mesh position={[0, -0.06, 0.32]} castShadow>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
            </mesh>

            {/* Tiny black heart nose */}
            <mesh position={[0, -0.03, 0.42]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#2d2d2d" roughness={0.2} />
            </mesh>

            {/* Glowing friendly eyes */}
            <mesh position={[0.15, 0.08, 0.3]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.1} />
            </mesh>
            <mesh position={[-0.15, 0.08, 0.3]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.1} />
            </mesh>
            {/* Eye glints */}
            <mesh position={[0.17, 0.11, 0.34]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.13, 0.11, 0.34]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Cute pink rosy blushing cheeks */}
            <mesh position={[0.24, -0.05, 0.28]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial color="#ff8fab" roughness={0.9} transparent opacity={0.65} />
            </mesh>
            <mesh position={[-0.24, -0.05, 0.28]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial color="#ff8fab" roughness={0.9} transparent opacity={0.65} />
            </mesh>

            {/* Floppy Golden Ears */}
            <mesh ref={leftEarRef} position={[0.34, 0.2, 0]} castShadow>
              <capsuleGeometry args={[0.08, 0.28, 8, 16]} />
              <meshStandardMaterial color="#D7AA6B" roughness={0.8} />
            </mesh>
            <mesh ref={rightEarRef} position={[-0.34, 0.2, 0]} castShadow>
              <capsuleGeometry args={[0.08, 0.28, 8, 16]} />
              <meshStandardMaterial color="#D7AA6B" roughness={0.8} />
            </mesh>
          </group>

          {/* Fluffy wagging tail */}
          <group position={[0, 0.3, -0.3]}>
            <mesh ref={tailRef} position={[0, 0.1, -0.1]} rotation={[Math.PI / 4, 0, 0]} castShadow>
              <capsuleGeometry args={[0.06, 0.22, 8, 12]} />
              <meshStandardMaterial color="#EAC082" roughness={0.6} />
            </mesh>
          </group>
        </group>
      )}

      {/* 2. MONSTRINHO CHARACTER MODEL (Cute purple/lavender cyclic plush) */}
      {avatarType === 'monstrinho' && (
        <group>
          {/* Main bean/capsule body-head mashup */}
          <mesh ref={bodyRef} position={[0, 0.6, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.36, 0.55, 16, 24]} />
            <meshStandardMaterial color="#B07DF0" roughness={0.72} metalness={0.02} />
          </mesh>

          {/* Cyclops single Expressive central Eye setup */}
          <group ref={headRef} position={[0, 0.85, 0]}>
            {/* White Eye sclera */}
            <mesh position={[0, 0.05, 0.31]} castShadow>
              <sphereGeometry args={[0.14, 24, 24]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
            </mesh>
            {/* Violet iris */}
            <mesh position={[0, 0.05, 0.42]}>
              <sphereGeometry args={[0.065, 16, 16]} />
              <meshStandardMaterial color="#4f46e5" roughness={0.1} />
            </mesh>
            {/* Dark pupil */}
            <mesh position={[0, 0.05, 0.47]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
            {/* Eye glint */}
            <mesh position={[0.03, 0.08, 0.49]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Tiny cute white pointy fangs/teeth */}
            <mesh position={[0.08, -0.2, 0.28]} rotation={[0, 0, Math.PI / 6]}>
              <coneGeometry args={[0.024, 0.05, 4]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
            </mesh>
            <mesh position={[-0.08, -0.2, 0.28]} rotation={[0, 0, -Math.PI / 6]}>
              <coneGeometry args={[0.024, 0.05, 4]} />
              <meshStandardMaterial color="#ffffff" roughness={0.1} />
            </mesh>

            {/* Little horns */}
            <mesh position={[0.22, 0.45, -0.05]} rotation={[0, 0, -0.3]} castShadow>
              <coneGeometry args={[0.05, 0.16, 16]} />
              <meshStandardMaterial color="#A3E635" roughness={0.4} emissive="#A3E635" emissiveIntensity={0.1} />
            </mesh>
            <mesh position={[-0.22, 0.45, -0.05]} rotation={[0, 0, 0.3]} castShadow>
              <coneGeometry args={[0.05, 0.16, 16]} />
              <meshStandardMaterial color="#A3E635" roughness={0.4} emissive="#A3E635" emissiveIntensity={0.1} />
            </mesh>
          </group>

          {/* Cute monster tail */}
          <mesh ref={tailRef} position={[0, 0.35, -0.32]} rotation={[Math.PI / 3, 0, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.25, 8, 12]} />
            <meshStandardMaterial color="#8B5CF6" roughness={0.6} />
          </mesh>
        </group>
      )}

      {/* 3. RETRO PIXEL ROBOT MODEL (Chibi modern retro robot with cyber monitor face) */}
      {avatarType === 'pixel' && (
        <group>
          {/* Square Metal Body */}
          <mesh ref={bodyRef} position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.55, 0.5, 0.55]} />
            <meshStandardMaterial color="#4B5563" roughness={0.25} metalness={0.8} />
          </mesh>

          {/* Head & Monitor Base */}
          <group ref={headRef} position={[0, 0.95, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.65, 0.44, 0.65]} />
              <meshStandardMaterial color="#374151" roughness={0.3} metalness={0.7} />
            </mesh>

            {/* Cyber Glass Screen */}
            <mesh position={[0, 0, 0.335]}>
              <boxGeometry args={[0.55, 0.34, 0.02]} />
              <meshStandardMaterial color="#000000" roughness={0.05} />
            </mesh>

            {/* Neon Cyan Smiling LED Eyes */}
            <mesh position={[0.13, 0.02, 0.35]}>
              <sphereGeometry args={[0.038, 16, 16]} />
              <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={1.8} />
            </mesh>
            <mesh position={[-0.13, 0.02, 0.35]}>
              <sphereGeometry args={[0.038, 16, 16]} />
              <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={1.8} />
            </mesh>

            {/* Flashing Antenna */}
            <mesh position={[0, 0.28, 0]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, 0.16]} />
              <meshStandardMaterial color="#9CA3AF" metalness={0.9} />
            </mesh>
            <mesh position={[0, 0.38, 0]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial 
                ref={antennaLightRef}
                color="#EC4899" 
                emissive="#EC4899" 
                emissiveIntensity={1.5} 
              />
            </mesh>
          </group>

          {/* Tech tail / cord */}
          <mesh ref={tailRef} position={[0, 0.35, -0.3]} rotation={[1.1, 0, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.3]} />
            <meshStandardMaterial color="#111827" roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* COORD FOOT/LEG PADS - Shared walking legs scaled depending on type */}
      <group>
        <mesh ref={pawLF} position={[0.18, 0.1, 0.2]} castShadow>
          <sphereGeometry args={[avatarType === 'pixel' ? 0.06 : 0.085, 16, 16]} />
          <meshStandardMaterial 
            color={avatarType === 'fofo' ? '#FFFFFF' : (avatarType === 'monstrinho' ? '#A3E635' : '#374151')} 
            roughness={0.6} 
            metalness={avatarType === 'pixel' ? 0.8 : 0.1}
          />
        </mesh>
        <mesh ref={pawRF} position={[-0.18, 0.1, 0.2]} castShadow>
          <sphereGeometry args={[avatarType === 'pixel' ? 0.06 : 0.085, 16, 16]} />
          <meshStandardMaterial 
            color={avatarType === 'fofo' ? '#FFFFFF' : (avatarType === 'monstrinho' ? '#A3E635' : '#374151')} 
            roughness={0.6} 
            metalness={avatarType === 'pixel' ? 0.8 : 0.1}
          />
        </mesh>
        <mesh ref={pawLB} position={[0.18, 0.1, -0.2]} castShadow>
          <sphereGeometry args={[avatarType === 'pixel' ? 0.06 : 0.085, 16, 16]} />
          <meshStandardMaterial 
            color={avatarType === 'fofo' ? '#D7AA6B' : (avatarType === 'monstrinho' ? '#8B5CF6' : '#374151')} 
            roughness={0.6} 
            metalness={avatarType === 'pixel' ? 0.8 : 0.1}
          />
        </mesh>
        <mesh ref={pawRB} position={[-0.18, 0.1, -0.2]} castShadow>
          <sphereGeometry args={[avatarType === 'pixel' ? 0.06 : 0.085, 16, 16]} />
          <meshStandardMaterial 
            color={avatarType === 'fofo' ? '#D7AA6B' : (avatarType === 'monstrinho' ? '#8B5CF6' : '#374151')} 
            roughness={0.6} 
            metalness={avatarType === 'pixel' ? 0.8 : 0.1}
          />
        </mesh>
      </group>

      {/* Cyber Laser Scanner origin (pointing towards pet) */}
      <mesh ref={laserRef} position={[0, 0.95, 0.34]} visible={false}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
             <cylinderGeometry args={[0.005, 0.14, 1, 16]} />
             <meshStandardMaterial 
                ref={laserMaterialRef} 
                 color="#00FFAA" 
                emissive="#00FFAA" 
                transparent 
                opacity={0.5} 
                depthWrite={false} 
                blending={THREE.AdditiveBlending}
             />
          </mesh>
        </group>
      </mesh>

      {/* 4. SHIELD DOME (Futuristic circular holographic forcefield) */}
      {isShieldActive && (
        <group position={[0, 0.55, 0]}>
          {/* Inner pulsating glow ball */}
          <mesh>
            <sphereGeometry args={[0.82, 32, 32]} />
            <meshBasicMaterial 
              ref={innerShieldMaterialRef}
              color="#38bdf8" 
              transparent 
              opacity={0.06} 
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Outer shield structure */}
          <mesh>
            <sphereGeometry args={[0.86, 24, 24]} />
            <meshBasicMaterial 
              ref={outerShieldMaterialRef}
              color="#38bdf8" 
              wireframe 
              transparent 
              opacity={0.16} 
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      )}

      {/* 5. INTERACT PARTICLES GROUP (Red cute hearts or stars) */}
      <group ref={particlesGroupRef}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh 
            key={i} 
            ref={(el) => { if (el) particleMeshesRef.current[i] = el; }} 
            scale={[0, 0, 0]}
          >
            {/* Cute heart-shaped or star tetrahedron */}
            <tetrahedronGeometry args={[0.4, 1]} />
            <meshStandardMaterial 
              color={i % 2 === 0 ? "#FF5F8E" : "#F43F5E"} 
              emissive={i % 2 === 0 ? "#FF5F8E" : "#F43F5E"}
              emissiveIntensity={0.8}
              roughness={0.2} 
            />
          </mesh>
        ))}
      </group>
      </group>
    </group>
  );
}
