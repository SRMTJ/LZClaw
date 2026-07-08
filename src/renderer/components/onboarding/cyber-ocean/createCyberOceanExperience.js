import ASSETS from './config/assets.js';
import Game from './Game/Game.class.js';
import ResourceLoader from './Game/Utils/ResourceLoader.class.js';

export function createCyberOceanExperience(canvas, options = {}) {
  let destroyed = false;
  let game = null;
  let pendingStep = Number(options.initialStep || 0);

  const resources = new ResourceLoader(ASSETS, false);

  const ready = new Promise((resolve, reject) => {
    let settled = false;

    resources.on('error', (event) => {
      if (settled || destroyed) return;
      settled = true;
      options.onError?.(event);
      reject(new Error(`Cyber-Ocean asset failed to load: ${event?.url || event?.id || 'unknown asset'}`));
    });

    resources.on('loaded', () => {
      if (settled || destroyed) return;

      try {
        game = new Game(canvas, resources, false);
        game.setActiveStep(pendingStep);
        settled = true;
        resolve();
      } catch (error) {
        settled = true;
        options.onError?.(error);
        reject(error);
      }
    });
  });

  return {
    ready,
    setActiveStep(step) {
      pendingStep = Number(step || 0);
      game?.setActiveStep(pendingStep);
    },
    destroy() {
      destroyed = true;
      game?.destroy();
      game = null;
      resources.destroy();
    },
  };
}
