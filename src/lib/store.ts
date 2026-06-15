import { create } from 'zustand';
import * as THREE from 'three';

export interface BoundingBox2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  id: string;
  class: string;
  score: number;
  box: BoundingBox2D;
  position3D: THREE.Vector3 | null;
  height: number;
  width3D: number;
  depth3D: number;
}

// Custom dimension & height specs for common objects to enable physical 3D interaction.
// Units are in meters for the virtual 3D scene.
export const OBJECT_SPECS: Record<string, { height: number; width: number; depth: number; labelPt: string; color: string }> = {
  chair: { height: 0.45, width: 0.5, depth: 0.5, labelPt: 'Cadeira 🪑', color: '#af85e6' },
  couch: { height: 0.42, width: 1.2, depth: 0.7, labelPt: 'Sofá 🛋️', color: '#8b5cf6' },
  bed: { height: 0.50, width: 1.4, depth: 1.5, labelPt: 'Cama 🛏️', color: '#6366f1' },
  'dining table': { height: 0.75, width: 1.0, depth: 0.8, labelPt: 'Mesa 🍽️', color: '#3b82f6' },
  toilet: { height: 0.45, width: 0.4, depth: 0.6, labelPt: 'Vaso 🚽', color: '#94a3b8' },
  laptop: { height: 0.22, width: 0.35, depth: 0.25, labelPt: 'Laptop 💻', color: '#06b6d4' },
  keyboard: { height: 0.12, width: 0.4, depth: 0.15, labelPt: 'Teclado ⌨️', color: '#14b8a6' },
  mouse: { height: 0.08, width: 0.1, depth: 0.15, labelPt: 'Mouse 🖱️', color: '#0ea5e9' },
  book: { height: 0.15, width: 0.25, depth: 0.2, labelPt: 'Livro 📖', color: '#f59e0b' },
  cup: { height: 0.20, width: 0.12, depth: 0.12, labelPt: 'Copo 🥛', color: '#ec4899' },
  bottle: { height: 0.25, width: 0.12, depth: 0.12, labelPt: 'Garrafa 🍾', color: '#db2777' },
  'cell phone': { height: 0.10, width: 0.15, depth: 0.1, labelPt: 'Celular 📱', color: '#e11d48' },
  'potted plant': { height: 0.35, width: 0.3, depth: 0.3, labelPt: 'Vaso de Planta 🪴', color: '#10b981' },
  cat: { height: 0.30, width: 0.35, depth: 0.35, labelPt: 'Gato Risonho 🐱', color: '#f59e0b' },
  dog: { height: 0.35, width: 0.4, depth: 0.4, labelPt: 'Cachorrinho 🐶', color: '#f97316' },
  person: { height: 0.80, width: 0.5, depth: 0.5, labelPt: 'Humano 👤', color: '#10b981' },
};

export const DEFAULT_OBJECT_SPEC = { height: 0.25, width: 0.3, depth: 0.3, labelPt: 'Objeto 📦', color: '#facc15' };

interface AppState {
  // Settings
  isDetectorEnabled: boolean;
  toggleDetector: () => void;
  
  // Custom AR Settings
  isGridVisible: boolean;
  toggleGrid: () => void;
  isShieldActive: boolean;
  toggleShield: () => void;
  interactionMode: 'idle' | 'happy' | 'sparkles';
  setInteractionMode: (mode: 'idle' | 'happy' | 'sparkles') => void;
  avatarType: 'fofo' | 'monstrinho' | 'pixel';
  setAvatarType: (type: 'fofo' | 'monstrinho' | 'pixel') => void;
  isHudMinimized: boolean;
  toggleHudMinimized: () => void;
  isElevationEnabled: boolean;
  toggleElevation: () => void;
  isDistanceScaleEnabled: boolean;
  toggleDistanceScale: () => void;
  cameraBrightness: number;
  setCameraBrightness: (val: number) => void;

  // Depth-Sensing Settings
  isDepthEnabled: boolean;
  toggleDepth: () => void;
  isDepthModelLoading: boolean;
  depthModelError: string | null;
  setDepthModelStatus: (isLoading: boolean, error?: string | null) => void;
  depthGridPoints: THREE.Vector3[];
  setDepthGridPoints: (points: THREE.Vector3[]) => void;

  // Detection
  isModelLoading: boolean;
  modelError: string | null;
  setModelStatus: (isLoading: boolean, error?: string | null) => void;
  
  // Single Pet (Fallback/Compatibility)
  petType: 'cat' | 'dog' | null;
  petBox: BoundingBox2D | null;
  setDetection: (type: 'cat' | 'dog' | null, box: BoundingBox2D | null) => void;

  // Multiple Detected Objects
  detectedObjects: DetectedObject[];
  setDetectedObjects: (objects: DetectedObject[]) => void;
  selectedTargetObjectId: string | null;
  setSelectedTargetObjectId: (id: string | null) => void;
  
  autoJumpMode: boolean;
  toggleAutoJumpMode: () => void;

  // 3D Space & Pet Position (Fallback/Compatibility)
  petPosition3D: THREE.Vector3 | null;
  setPetPosition3D: (pos: THREE.Vector3 | null) => void;
  
  // Avatar Positions
  startAvatarPosition: THREE.Vector3;
  avatarPosition: THREE.Vector3;
  targetAvatarPosition: THREE.Vector3;
  setAvatarTarget: (pos: THREE.Vector3) => void;
  updateAvatarPosition: (pos: THREE.Vector3) => void;

  // Video settings to map NDC precisely
  videoElement: HTMLVideoElement | null;
  setVideoElement: (el: HTMLVideoElement | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  isDetectorEnabled: false,
  toggleDetector: () => set((state) => ({ isDetectorEnabled: !state.isDetectorEnabled })),

  isGridVisible: true,
  toggleGrid: () => set((state) => ({ isGridVisible: !state.isGridVisible })),
  isShieldActive: false,
  toggleShield: () => set((state) => ({ isShieldActive: !state.isShieldActive })),
  interactionMode: 'idle',
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  avatarType: 'fofo',
  setAvatarType: (avatarType) => set({ avatarType }),
  isHudMinimized: false,
  toggleHudMinimized: () => set((state) => ({ isHudMinimized: !state.isHudMinimized })),
  isElevationEnabled: true,
  toggleElevation: () => set((state) => ({ isElevationEnabled: !state.isElevationEnabled })),
  isDistanceScaleEnabled: true,
  toggleDistanceScale: () => set((state) => ({ isDistanceScaleEnabled: !state.isDistanceScaleEnabled })),
  cameraBrightness: 1.1,
  setCameraBrightness: (cameraBrightness) => set({ cameraBrightness }),

  isDepthEnabled: false,
  toggleDepth: () => set((state) => ({ isDepthEnabled: !state.isDepthEnabled })),
  isDepthModelLoading: false,
  depthModelError: null,
  setDepthModelStatus: (isLoading, error = null) => set({ isDepthModelLoading: isLoading, depthModelError: error }),
  depthGridPoints: [],
  setDepthGridPoints: (depthGridPoints) => set({ depthGridPoints }),

  isModelLoading: false,
  modelError: null,
  setModelStatus: (isLoading, error = null) => set({ isModelLoading: isLoading, modelError: error }),
  
  petType: null,
  petBox: null,
  setDetection: (type, box) => set({ petType: type, petBox: box }),

  detectedObjects: [],
  setDetectedObjects: (detectedObjects) => set({ detectedObjects }),
  selectedTargetObjectId: null,
  setSelectedTargetObjectId: (selectedTargetObjectId) => set({ selectedTargetObjectId }),

  autoJumpMode: false,
  toggleAutoJumpMode: () => set((state) => ({ autoJumpMode: !state.autoJumpMode })),

  petPosition3D: null,
  setPetPosition3D: (petPosition3D) => {
    set({ petPosition3D });
    // Keep backwards compatibility for simple HUD tracking
    if (!petPosition3D && get().petType) {
      set({ petType: null, petBox: null });
    }
  },

  startAvatarPosition: new THREE.Vector3(0, 0, 0),
  avatarPosition: new THREE.Vector3(0, 0, 0),
  targetAvatarPosition: new THREE.Vector3(0, 0, 0),
  setAvatarTarget: (targetAvatarPosition) => {
    const current = get().avatarPosition;
    set({ 
      startAvatarPosition: new THREE.Vector3().copy(current),
      targetAvatarPosition 
    });
  },
  updateAvatarPosition: (avatarPosition) => set({ avatarPosition }),

  videoElement: null,
  setVideoElement: (videoElement) => set({ videoElement })
}));
