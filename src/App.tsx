import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { ObjectDetector } from './components/ObjectDetector';
import { Scene } from './components/Scene';
import { Avatar } from './components/Avatar';
import { HUD } from './components/HUD';
import { DepthEngine } from './components/DepthEngine';
import { useStore } from './lib/store';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const setVideoElement = useStore((state) => state.setVideoElement);
  const cameraBrightness = useStore((state) => state.cameraBrightness);
  
  // Connect video element to store for TF.js and Raycasting
  useEffect(() => {
    if (videoRef.current) {
      setVideoElement(videoRef.current);
    }
  }, [setVideoElement]);

  // Request Webcam Access
  useEffect(() => {
    async function setupCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Camera API not supported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    }
    setupCamera();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950 font-sans">
      {/* Background Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          filter: `brightness(${cameraBrightness}) saturate(1.15) contrast(1.05)`,
          transition: 'filter 0.3s ease'
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* AI Processing Layer */}
      <ObjectDetector />

      {/* 3D AR Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 2, 5], fov: 60 }}>
          <Environment preset="city" />
          <Scene />
          <DepthEngine />
          <Avatar />
        </Canvas>
      </div>

      {/* UI Interaction Layer */}
      <HUD />
    </div>
  );
}
