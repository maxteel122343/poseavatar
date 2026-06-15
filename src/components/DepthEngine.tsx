import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import * as depthEstimation from '@tensorflow-models/depth-estimation';
import { useStore } from '../lib/store';

export function DepthEngine() {
  const camera = useThree((state) => state.camera);
  const isDepthEnabled = useStore((state) => state.isDepthEnabled);
  const videoElement = useStore((state) => state.videoElement);
  const setDepthModelStatus = useStore((state) => state.setDepthModelStatus);
  const depthGridPoints = useStore((state) => state.depthGridPoints);
  const setDepthGridPoints = useStore((state) => state.setDepthGridPoints);

  const loopRef = useRef<boolean>(false);

  // TensorFlow.js Depth Estimator Loader & Handler
  useEffect(() => {
    if (!isDepthEnabled || !videoElement) {
      setDepthGridPoints([]);
      setDepthModelStatus(false);
      loopRef.current = false;
      return;
    }

    let active = true;
    loopRef.current = true;
    setDepthModelStatus(true); // Loading...

    let estimator: depthEstimation.DepthEstimator | null = null;

    async function setupDepthModel() {
      try {
        // Load the ARPortraitDepth estimator model
        estimator = await depthEstimation.createEstimator(
          depthEstimation.SupportedModels.ARPortraitDepth
        );
        
        if (!active) return;
        setDepthModelStatus(false, null);

        // Async prediction run-loop with rate limiting
        const runEstimation = async () => {
          if (!active || !loopRef.current || !videoElement || videoElement.readyState < 2) {
            if (active) setTimeout(runEstimation, 200);
            return;
          }

          try {
            // Estimate depth map using configured ranges in meters
            const depthMap = await estimator!.estimateDepth(videoElement, {
              minDepth: 0.5,
              maxDepth: 5.0,
            });

            if (!active) {
              if (depthMap && typeof (depthMap as any).dispose === 'function') {
                (depthMap as any).dispose();
              }
              return;
            }

            const rawArray = await depthMap.toArray();
            if (depthMap && typeof (depthMap as any).dispose === 'function') {
              (depthMap as any).dispose();
            }

            if (rawArray && rawArray.length > 0) {
              const h = rawArray.length;
              const w = rawArray[0].length;

              // Downsample to check 16x12 point grid safely
              const gridRows = 12;
              const gridCols = 16;
              const points: THREE.Vector3[] = [];

              for (let r = 0; r < gridRows; r++) {
                const srcY = Math.floor((r / (gridRows - 1)) * (h - 1));
                for (let c = 0; c < gridCols; c++) {
                  const srcX = Math.floor((c / (gridCols - 1)) * (w - 1));
                  const depth = rawArray[srcY][srcX];

                  // Filter out noise or excessive distances
                  if (depth > 0.4 && depth < 4.8) {
                    // Coordinates mapped to Normalized Device Coordinates (NDC)
                    const ndcX = (c / (gridCols - 1)) * 2 - 1;
                    const ndcY = -((r / (gridRows - 1)) * 2 - 1); // Flip Y on Web

                    const tempVector = new THREE.Vector3(ndcX, ndcY, 0.5);
                    tempVector.unproject(camera);
                    
                    const dir = tempVector.sub(camera.position).normalize();
                    const physicalPoint = camera.position.clone().add(dir.multiplyScalar(depth));
                    
                    points.push(physicalPoint);
                  }
                }
              }

              if (active) {
                setDepthGridPoints(points);
              }
            }

          } catch (predictionErr) {
            console.warn("Depth estimation loop warning (benign during camera adjustment):", predictionErr);
          }

          // Rate limit next prediction (150ms) to ensure flawless 60 FPS in Three.js Canvas
          if (active) {
            setTimeout(runEstimation, 150);
          }
        };

        runEstimation();

      } catch (err: any) {
        if (!active) return;
        console.error("TF.js Depth Model Loading Error:", err);
        setDepthModelStatus(false, err.message || "Falha ao carregar o estimador de profundidade.");
      }
    }

    setupDepthModel();

    return () => {
      active = false;
      loopRef.current = false;
      if (estimator) {
        estimator.dispose();
      }
    };
  }, [isDepthEnabled, videoElement, camera, setDepthModelStatus, setDepthGridPoints]);

  // Mobile Mode: WebXR real-time hardware-accelerated Depth Sensing API integration
  useFrame((state) => {
    const { gl } = state;
    try {
      const session = gl.xr.getSession();
      if (!session) return;

      const frame = gl.xr.getFrame();
      if (!frame) return;

      const referenceSpace = gl.xr.getReferenceSpace();
      const viewerPose = referenceSpace ? frame.getViewerPose(referenceSpace) : null;
      if (!viewerPose || viewerPose.views.length === 0) return;

      const view = viewerPose.views[0];
      // TypeScript safety query for experimental WebXR Depth Sensing APIs
      const depthInfo = (frame as any).getDepthInformation ? (frame as any).getDepthInformation(view) : null;

      if (depthInfo) {
        // Suspend TF.js loop to save mobile battery since hardware depth API is active
        loopRef.current = false;

        const points: THREE.Vector3[] = [];
        const gridRows = 12;
        const gridCols = 16;

        for (let r = 0; r < gridRows; r++) {
          for (let c = 0; c < gridCols; c++) {
            const u = c / (gridCols - 1);
            const v = r / (gridRows - 1);
            
            const depthValue = depthInfo.getDepthInMeters ? depthInfo.getDepthInMeters(u, v) : 0;
            if (depthValue > 0.3 && depthValue < 4.5) {
              const ndcX = u * 2 - 1;
              const ndcY = -(v * 2 - 1);

              const tempVector = new THREE.Vector3(ndcX, ndcY, 0.5);
              tempVector.unproject(camera);
              
              const dir = tempVector.sub(camera.position).normalize();
              const physicalPoint = camera.position.clone().add(dir.multiplyScalar(depthValue));
              points.push(physicalPoint);
            }
          }
        }

        if (points.length > 0) {
          setDepthGridPoints(points);
        }
      }
    } catch (xrErr) {
      console.warn("WebXR depth hardware query error:", xrErr);
    }
  });

  if (!isDepthEnabled || depthGridPoints.length === 0) return null;

  // Render a beautiful, subtle holographic cyan depth particle cloud representing the physical terrain scanned by the engine
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array(depthGridPoints.flatMap((p) => [p.x, p.y + 0.015, p.z])),
            3,
          ]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#22d3ee"
        size={0.035}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.45}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
