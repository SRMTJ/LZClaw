export interface CyberOceanExperience {
  ready: Promise<void>;
  setActiveStep(step: number): void;
  destroy(): void;
}

export interface CyberOceanExperienceOptions {
  initialStep?: number;
  onError?: (error: unknown) => void;
}

export function createCyberOceanExperience(
  canvas: HTMLCanvasElement,
  options?: CyberOceanExperienceOptions,
): CyberOceanExperience;
