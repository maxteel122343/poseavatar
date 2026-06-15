import { useStore, OBJECT_SPECS, DEFAULT_OBJECT_SPEC } from '../lib/store';
import { 
  Target, 
  Scan, 
  AlertCircle, 
  Power, 
  PowerOff, 
  Shield, 
  Sparkles, 
  Eye, 
  EyeOff, 
  User, 
  Sun, 
  ChevronDown, 
  ChevronUp, 
  Heart,
  HelpCircle,
  QrCode,
  Compass,
  Activity,
  Layers,
  Expand
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';
import * as THREE from 'three';

export function HUD() {
  const isDetectorEnabled = useStore((state) => state.isDetectorEnabled);
  const toggleDetector = useStore((state) => state.toggleDetector);
  const isModelLoading = useStore((state) => state.isModelLoading);
  const modelError = useStore((state) => state.modelError);
  
  const petType = useStore((state) => state.petType);
  const avatarType = useStore((state) => state.avatarType);
  const setAvatarType = useStore((state) => state.setAvatarType);
  
  const isGridVisible = useStore((state) => state.isGridVisible);
  const toggleGrid = useStore((state) => state.toggleGrid);
  
  const isShieldActive = useStore((state) => state.isShieldActive);
  const toggleShield = useStore((state) => state.toggleShield);
  
  const isElevationEnabled = useStore((state) => state.isElevationEnabled);
  const toggleElevation = useStore((state) => state.toggleElevation);

  const isDepthEnabled = useStore((state) => state.isDepthEnabled);
  const toggleDepth = useStore((state) => state.toggleDepth);
  const isDepthModelLoading = useStore((state) => state.isDepthModelLoading);
  const depthModelError = useStore((state) => state.depthModelError);

  const isDistanceScaleEnabled = useStore((state) => state.isDistanceScaleEnabled);
  const toggleDistanceScale = useStore((state) => state.toggleDistanceScale);
  
  const interactionMode = useStore((state) => state.interactionMode);
  const setInteractionMode = useStore((state) => state.setInteractionMode);
  
  const cameraBrightness = useStore((state) => state.cameraBrightness);
  const setCameraBrightness = useStore((state) => state.setCameraBrightness);

  const detectedObjects = useStore((state) => state.detectedObjects);
  const selectedTargetObjectId = useStore((state) => state.selectedTargetObjectId);
  const setSelectedTargetObjectId = useStore((state) => state.setSelectedTargetObjectId);
  const setAvatarTarget = useStore((state) => state.setAvatarTarget);
  const autoJumpMode = useStore((state) => state.autoJumpMode);
  const toggleAutoJumpMode = useStore((state) => state.toggleAutoJumpMode);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(true);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    // Update distance safely on frame
    let frameId: number;
    const updateDist = () => {
      const p3 = useStore.getState().petPosition3D;
      const av = useStore.getState().avatarPosition;
      if (p3 && av) {
         setDistance(av.distanceTo(p3));
      } else {
         setDistance(null);
      }
      frameId = requestAnimationFrame(updateDist);
    };
    frameId = requestAnimationFrame(updateDist);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Auto collapse tutorial when pet is detected to maximize immersion:
  useEffect(() => {
    if (petType) {
      setIsTutorialOpen(false);
    }
  }, [petType]);

  // Trigger heart sparkles stream for 4 seconds
  const triggerSparkles = () => {
    if (interactionMode !== 'sparkles') {
      setInteractionMode('sparkles');
      setTimeout(() => {
        setInteractionMode('idle');
      }, 4000);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans">
      
      {/* 1. TOP BAR: State & AI Controls */}
      <div className="flex w-full items-start justify-between">
        <div className="flex flex-col gap-3 pointer-events-auto">
          {/* Main Power Toggle */}
          <button 
            id="btn-detector-toggle"
            onClick={toggleDetector}
            className={cn(
              "flex items-center gap-2.5 rounded-full px-4.5 py-2.5 text-sm font-semibold text-white backdrop-blur-lg border cursor-pointer select-none transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-lg",
              isDetectorEnabled 
                ? "bg-emerald-500/30 border-emerald-400/30 text-emerald-100" 
                : "bg-black/60 border-white/10 text-zinc-300"
            )}
          >
            {!isDetectorEnabled ? (
               <>
                 <PowerOff className="h-4 w-4 text-zinc-400" />
                 Scanner: Desativado
               </>
            ) : isModelLoading ? (
               <>
                 <div className="h-2 w-2 animate-ping rounded-full bg-yellow-400" />
                 <span>Iniciando IA...</span>
               </>
            ) : modelError ? (
               <>
                 <AlertCircle className="h-4.5 w-4.5 text-red-400" />
                 <span>Erro IA</span>
               </>
            ) : (
               <>
                 <Power className="h-4 w-4 text-emerald-400 animate-pulse" />
                 <span className="text-emerald-300 font-bold">Scanner: Ativo</span>
               </>
            )}
          </button>

          {/* Environmental Surface Radar Panel (Shows active targets & auto-patrol) */}
          {isDetectorEnabled && !isModelLoading && !modelError && (
            <div className="flex flex-col gap-2 rounded-2xl bg-black/60 border border-white/10 p-3.5 backdrop-blur-xl max-w-[280px] shadow-2xl animate-fade-in transition-all duration-300">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-1">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Compass className="h-4.5 w-4.5 animate-spin" style={{ animationDuration: '10s' }} />
                  <span className="text-[11px] font-bold tracking-wider text-zinc-100 uppercase">Radar 3D</span>
                </div>
                
                {/* Auto Jump / Patrol Toggle */}
                <button
                  onClick={toggleAutoJumpMode}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase border transition-all duration-200 cursor-pointer select-none",
                    autoJumpMode 
                      ? "bg-amber-400/20 border-amber-400/40 text-amber-300 shadow-md scale-102" 
                      : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                  )}
                  title={autoJumpMode ? "Desativar Patrulha Autônoma" : "Ativar Patrulha Autônoma"}
                >
                  {autoJumpMode ? "🤖 Auto-Pulo" : "Manual"}
                </button>
              </div>

              {/* List of Detected Objects */}
              {detectedObjects.length === 0 ? (
                <div className="py-3 text-center text-[10px] text-zinc-500 leading-relaxed max-w-[200px]">
                  Buscando superfícies (mesa, cadeira, copos, celular) no ambiente...
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {detectedObjects.map((obj) => {
                    const isSelected = selectedTargetObjectId === obj.id;
                    const spec = OBJECT_SPECS[obj.class] || DEFAULT_OBJECT_SPEC;
                    const label = spec.labelPt;
                    const color = spec.color;

                    const handleSelect = () => {
                      setSelectedTargetObjectId(obj.id);
                      if (obj.position3D) {
                        const targetPos = new THREE.Vector3(
                          obj.position3D.x,
                          obj.height,
                          obj.position3D.z
                        );
                        setAvatarTarget(targetPos);
                      }
                    };

                    return (
                      <button
                        key={obj.id}
                        onClick={handleSelect}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[10px] text-left border cursor-pointer select-none transition-all duration-250",
                          isSelected 
                            ? "bg-white/12 border-white/20 text-white shadow-md scale-[1.02]" 
                            : "bg-white/4 border-transparent text-zinc-300 hover:bg-white/8 hover:text-white"
                        )}
                        style={{ borderLeftColor: isSelected ? color : 'transparent', borderLeftWidth: isSelected ? '3px' : '1px' }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="h-1.5 w-1.5 rounded-full antialiased" style={{ backgroundColor: color }} />
                          <span className="font-semibold truncate tracking-wide">{label}</span>
                        </div>
                        <span className="shrink-0 font-mono text-[9px] text-zinc-400 ml-2">
                          {obj.height}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Camera Brightness Slider Container (Solves issue 5) */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5 rounded-2xl bg-black/45 p-3.5 backdrop-blur-lg border border-white/10 text-white shadow-xl max-w-[180px]">
          <div className="flex items-center gap-2 w-full text-zinc-300">
            <Sun className="h-4.5 w-4.5 text-yellow-400 animate-spin" style={{ animationDuration: '10s' }} />
            <span className="text-xs font-medium">Luz da Câmera</span>
          </div>
          <input 
            type="range"
            min="0.8"
            max="1.7"
            step="0.05"
            value={cameraBrightness}
            onChange={(e) => setCameraBrightness(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
          />
          <span className="text-[10px] font-mono text-zinc-400">FPS Estável • {Math.round(cameraBrightness * 100)}%</span>
        </div>
      </div>

      {/* 2. MIDDLE SCREEN: Status Overlay & Target Analytics */}
      <div className="flex flex-col items-center justify-center gap-4">
        {/* Detection Target Banner */}
        <div className={cn(
          "flex flex-col items-center gap-2 transition-all duration-500 transform",
          petType ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        )}>
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-6 py-2.5 text-emerald-300 backdrop-blur-lg border border-emerald-500/40 shadow-xl">
            <Target className="h-5 w-5 animate-pulse text-emerald-400" />
            <span className="text-sm font-bold tracking-widest uppercase">
              {petType === 'cat' ? '🐱 GATO' : '🐶 CACHORRO'} DETECTADO
            </span>
          </div>
          
          {distance !== null && (
            <div className="rounded-full bg-black/75 px-5 py-1.5 font-mono text-xs text-white backdrop-blur-md shadow-lg border border-white/5">
              Refração Espacial: <span className="text-amber-400 font-bold">{(distance * 10).toFixed(1)}m</span>
            </div>
          )}
        </div>

        {/* Micro analysis cue */}
        {distance !== null && distance < 2.3 && (
          <div className="flex items-center gap-2 rounded-full bg-cyan-500/20 px-5 py-2 text-cyan-300 backdrop-blur-lg border border-cyan-500/40 shadow-lg animate-bounce mt-2">
            <Scan className="h-4.5 w-4.5 text-cyan-400" />
            <span className="text-[11px] font-semibold tracking-wider uppercase">Sincronia AR Concluída</span>
          </div>
        )}
      </div>

      {/* 3. INTERACTIVE CORNER BUTTONS (Glassmorphic floating systems) */}
      <div className="flex w-full items-end justify-between pointer-events-auto">
        
        {/* LEFT FLOATING BAR: Orange Avatar Toggle & Mascot drawer */}
        <div className="flex flex-col gap-3 items-start relative">
          {/* Circular Orange Button (Left) */}
          <button
            id="btn-mascot-drawer"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="h-14 w-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 border border-white/20 text-white flex items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-90 hover:scale-105 cursor-pointer"
          >
            <User className="h-6 w-6" />
          </button>

          {/* Drawer selection menu */}
          {isDrawerOpen && (
            <div className="absolute left-0 bottom-16 w-52 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/10 p-3.5 shadow-2xl flex flex-col gap-2.5 text-white animate-fade-in animate-duration-150">
              <div className="border-b border-white/10 pb-1.5 mb-0.5">
                <span className="text-xs text-zinc-400 font-medium font-mono uppercase tracking-wider block">Escolha a Criatura</span>
              </div>
              
              <button
                onClick={() => { setAvatarType('fofo'); setIsDrawerOpen(false); }}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all",
                  avatarType === 'fofo' ? "bg-amber-500 text-black shadow-md" : "hover:bg-white/10 text-zinc-200"
                )}
              >
                <span>Fofo (Puppy-Mascot)</span>
                {avatarType === 'fofo' && <span className="h-2 w-2 rounded-full bg-black" />}
              </button>

              <button
                onClick={() => { setAvatarType('monstrinho'); setIsDrawerOpen(false); }}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all",
                  avatarType === 'monstrinho' ? "bg-purple-500 text-black shadow-md" : "hover:bg-white/10 text-zinc-200"
                )}
              >
                <span>Monstrinho (Cyclops)</span>
                {avatarType === 'monstrinho' && <span className="h-2 w-2 rounded-full bg-black" />}
              </button>

              <button
                onClick={() => { setAvatarType('pixel'); setIsDrawerOpen(false); }}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all",
                  avatarType === 'pixel' ? "bg-cyan-500 text-black shadow-md" : "hover:bg-white/10 text-zinc-200"
                )}
              >
                <span>Pixel (Retro Chibi Robot)</span>
                {avatarType === 'pixel' && <span className="h-2 w-2 rounded-full bg-black" />}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT FLOATING BAR: Circular Glassmorphic Utility Buttons */}
        <div className="flex flex-col gap-3">
          {/* Heart / Sparkles streamer (Trigger interaction fofo) */}
          <button
            id="btn-sparkle-trigger"
            onClick={triggerSparkles}
            disabled={!petType && detectedObjects.length === 0}
            className={cn(
              "h-13 w-13 rounded-full flex items-center justify-center border shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer",
              interactionMode === 'sparkles'
                ? "bg-rose-500/40 border-rose-400/40 text-rose-300 animate-pulse" 
                : "bg-black/50 border-white/10 text-zinc-200 hover:bg-black/75 hover:scale-105",
              (!petType && detectedObjects.length === 0) && "opacity-40 cursor-not-allowed scale-95 hover:scale-95"
            )}
            title={petType || detectedObjects.length > 0 ? "Dar Carinho / Brincar" : "Ative o scanner para interagir com objetos!"}
          >
            <Heart className={cn("h-5.5 w-5.5", interactionMode === 'sparkles' && "animate-ping")} />
          </button>

          {/* Shield Shield Dome utility */}
          <button
            id="btn-shield-toggle"
            onClick={toggleShield}
            className={cn(
              "h-13 w-13 rounded-full flex items-center justify-center border shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer",
              isShieldActive 
                ? "bg-cyan-500/40 border-cyan-400/40 text-cyan-300" 
                : "bg-black/50 border-white/10 text-zinc-200 hover:bg-black/75 hover:scale-105"
            )}
            title="Ativar Escudo Holográfico"
          >
            <Shield className={cn("h-5.5 w-5.5", isShieldActive && "text-cyan-400 animate-pulse")} />
          </button>

          {/* Active Depth Scan / Monocular depth trigger (MiDaS + WebXR) */}
          <button
            id="btn-depth-toggle"
            onClick={toggleDepth}
            className={cn(
              "h-13 w-13 rounded-full flex items-center justify-center border shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer",
              isDepthEnabled 
                ? "bg-cyan-500/40 border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]" 
                : "bg-black/50 border-white/10 text-zinc-200 hover:bg-black/75 hover:scale-105"
            )}
            title={isDepthEnabled ? "Desativar Reconstrução de Profundidade 3D" : "Ativar Reconstrução de Profundidade 3D (MiDaS + WebXR)"}
          >
            {isDepthModelLoading ? (
              <div className="h-5.5 w-5.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            ) : (
              <Activity className={cn("h-5.5 w-5.5", isDepthEnabled && "text-cyan-400 animate-pulse")} />
            )}
          </button>

          {/* Elevation Sensor / Height Toggler */}
          <button
            id="btn-elevation-toggle"
            onClick={toggleElevation}
            className={cn(
              "h-13 w-13 rounded-full flex items-center justify-center border shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer",
              isElevationEnabled 
                ? "bg-cyan-500/40 border-cyan-400/40 text-cyan-300" 
                : "bg-black/50 border-white/10 text-zinc-200 hover:bg-black/75 hover:scale-105"
            )}
            title={isElevationEnabled ? "Desativar Sensor de Elevação" : "Ativar Sensor de Elevação"}
          >
            <Layers className={cn("h-5.5 w-5.5", isElevationEnabled && "text-cyan-400 animate-pulse")} />
          </button>

          {/* Depth/Distance Proportional Scale Toggler */}
          <button
            id="btn-distance-scale-toggle"
            onClick={toggleDistanceScale}
            className={cn(
              "h-13 w-13 rounded-full flex items-center justify-center border shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer",
              isDistanceScaleEnabled 
                ? "bg-purple-500/40 border-purple-400/40 text-purple-300" 
                : "bg-black/50 border-white/10 text-zinc-200 hover:bg-black/75 hover:scale-105"
            )}
            title={isDistanceScaleEnabled ? "Desativar Escala Proporcional" : "Ativar Escala Proporcional de Distância"}
          >
            <Expand className={cn("h-5.5 w-5.5", isDistanceScaleEnabled && "text-purple-400 animate-pulse")} />
          </button>

          {/* Virtual Grid toggler (Eye) */}
          <button
            id="btn-grid-toggle"
            onClick={toggleGrid}
            className={cn(
              "h-13 w-13 rounded-full flex items-center justify-center border bg-black/50 border-white/10 text-zinc-200 hover:bg-black/75 shadow-xl transition-all duration-300 transform active:scale-95 hover:scale-105 cursor-pointer"
            )}
            title={isGridVisible ? "Ocultar Grade Virtual" : "Exibir Grade Virtual"}
          >
            {isGridVisible ? <Eye className="h-5.5 w-5.5 text-zinc-200" /> : <EyeOff className="h-5.5 w-5.5 text-zinc-400" />}
          </button>
        </div>
      </div>

      {/* 4. BOTTOM BAR: Simplified, beautiful collapsible guides (Saves screen real-estate) */}
      <div className="w-full flex justify-center mt-5 pointer-events-auto">
        <div className="max-w-md w-full rounded-2xl bg-black/60 border border-white/13 backdrop-blur-xl shadow-2xl p-4 text-white overflow-hidden transition-all duration-400">
          <div className="flex w-full items-center justify-between pb-1">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="h-4.5 w-4.5 text-amber-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">Instruções de Sobrevivência</h2>
            </div>
            <button 
              onClick={() => setIsTutorialOpen(!isTutorialOpen)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg bg-white/5 transition-colors cursor-pointer"
            >
              {isTutorialOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>

          <div className={cn(
            "transition-all duration-300 ease-in-out text-xs leading-relaxed text-zinc-300 flex flex-col gap-1.5",
            isTutorialOpen ? "max-h-32 mt-2 border-t border-white/5 pt-2" : "max-h-0 opacity-0 overflow-hidden pointer-events-none mt-0"
          )}>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>Aponte para seu <span className="text-white font-medium">Gato</span> ou <span className="text-white font-medium">Cachorro</span> para alinhar o scanner.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span>Toque na tela/chão virtual para guiar o mascote 3D até ele.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span>Ative o <span className="text-white font-medium">Eco Radar 3D (Botão Onda 📉)</span> para fazer o pet subir em laptops, mesas e escadas físicas do quarto!</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>Use o <span className="text-white font-medium">Sensor de Elevação 🥞</span> para pular nas mesas/cadeiras do radar.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>Use a <span className="text-white font-medium">Escala Proporcional 📏</span> para manter o tamanho visual constante do pet.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              <span>Gere carinho de corações usando o botão <span className="text-white font-medium">❤️ (Coração)</span> ao lado!</span>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
