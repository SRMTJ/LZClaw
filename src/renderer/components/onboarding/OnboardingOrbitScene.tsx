import React, { useEffect, useRef, useState } from 'react';

interface OnboardingOrbitSceneProps {
  activeStep: number;
}

type CyberOceanExperience = {
  ready: Promise<void>;
  setActiveStep: (step: number) => void;
  destroy: () => void;
};

const OnboardingOrbitScene: React.FC<OnboardingOrbitSceneProps> = ({ activeStep }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const experienceRef = useRef<CyberOceanExperience | null>(null);
  const activeStepRef = useRef(activeStep);
  const [hasSceneError, setHasSceneError] = useState(false);

  useEffect(() => {
    activeStepRef.current = activeStep;
    experienceRef.current?.setActiveStep(activeStep);
  }, [activeStep]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;

    if (!canvas) return undefined;

    void import('./cyber-ocean/createCyberOceanExperience.js')
      .then(({ createCyberOceanExperience }) => {
        if (cancelled) return;

        const experience = createCyberOceanExperience(canvas, {
          initialStep: activeStepRef.current,
          onError: (error: unknown) => {
            console.error('[OnboardingOrbitScene] Cyber-Ocean scene error', error);
          },
        });

        experienceRef.current = experience;
        experience.ready.catch((error: unknown) => {
          if (cancelled) return;
          console.error('[OnboardingOrbitScene] Cyber-Ocean scene failed', error);
          setHasSceneError(true);
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[OnboardingOrbitScene] Failed to import Cyber-Ocean scene', error);
        setHasSceneError(true);
      });

    return () => {
      cancelled = true;
      experienceRef.current?.destroy();
      experienceRef.current = null;
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="h-full w-full" />
      {hasSceneError && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(8,145,178,0.42),transparent_34%),linear-gradient(180deg,#020714_0%,#06223a_50%,#01040c_100%)]" />
      )}
    </div>
  );
};

export default OnboardingOrbitScene;
