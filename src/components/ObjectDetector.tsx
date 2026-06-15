import { useEffect, useRef } from 'react';
import '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { useStore, DetectedObject, OBJECT_SPECS, DEFAULT_OBJECT_SPEC } from '../lib/store';

export function ObjectDetector() {
  const isDetectorEnabled = useStore((state) => state.isDetectorEnabled);
  const videoElement = useStore((state) => state.videoElement);
  const setModelStatus = useStore((state) => state.setModelStatus);
  const setDetection = useStore((state) => state.setDetection);
  const setDetectedObjects = useStore((state) => state.setDetectedObjects);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if (!isDetectorEnabled) {
      setDetection(null, null);
      setDetectedObjects([]);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    let active = true;
    let model: cocoSsd.ObjectDetection | null = null;
    setModelStatus(true); // Loading...

    async function loadModelAndDetect() {
      if (!videoElement) return;

      try {
        // Load the Coco SSD model - lite mobilenet v2 is fast and perfect for browsers
        model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        if (!active) return;
        setModelStatus(false);

        const detectFrame = async () => {
          if (!active || !videoElement || videoElement.readyState < 2) {
             requestRef.current = requestAnimationFrame(detectFrame);
             return;
          }

          try {
            const predictions = await model!.detect(videoElement);
            
            // Filter predictions to only keep high confidence objects
            const validPredictions = predictions.filter((p) => p.score >= 0.4);

            // Map predictions to DetectedObject format
            const list: DetectedObject[] = validPredictions.map((p, idx) => {
              const spec = OBJECT_SPECS[p.class] || DEFAULT_OBJECT_SPEC;
              return {
                id: `${p.class}_${idx}_${Date.now() % 100}`, // Unique ID
                class: p.class,
                score: p.score,
                box: {
                  x: p.bbox[0],
                  y: p.bbox[1],
                  width: p.bbox[2],
                  height: p.bbox[3],
                },
                position3D: null, // Will be computed in the 3D Scene loop via projection
                height: spec.height,
                width3D: spec.width,
                depth3D: spec.depth,
              };
            });

            if (active) {
              setDetectedObjects(list);

              // Backwards compatibility for exact puppy/gato indicators
              const petPrediction = validPredictions.find(
                (p) => p.class === 'cat' || p.class === 'dog'
              );

              if (petPrediction) {
                setDetection(
                  petPrediction.class as 'cat' | 'dog',
                  {
                    x: petPrediction.bbox[0],
                    y: petPrediction.bbox[1],
                    width: petPrediction.bbox[2],
                    height: petPrediction.bbox[3],
                  }
                );
              } else {
                setDetection(null, null);
              }
            }
          } catch (detectionErr) {
            console.warn("Detection frame error (benign during state transitions):", detectionErr);
          }

          // Repeat
          if (active) {
            requestRef.current = requestAnimationFrame(detectFrame);
          }
        };

        detectFrame();

      } catch (err: any) {
        if (!active) return;
        console.error("TF.js Error:", err);
        setModelStatus(false, err.message || "Failed to load detection model.");
      }
    }

    loadModelAndDetect();

    return () => {
      active = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isDetectorEnabled, videoElement, setDetection, setDetectedObjects, setModelStatus]);

  return null;
}
