import * as THREE from 'three';
import Sizes from './Utils/Sizes.class';
import Time from './Utils/Time.class';
import Mouse from './Input/Mouse.class';
import Camera from './Core/Camera.class';
import Renderer from './Core/Renderer.class';
import PostProcessing from './Systems/PostProcessing.class';
import World from './World/World.scene';

export default class Game {
  constructor(canvas, resources, debugMode) {
    if (Game.instance) {
      return Game.instance;
    }
    Game.instance = this;

    this.isDebugEnabled = debugMode;
    this.debug = null;
    this.activeStep = 0;
    this.targetStep = 0;

    this.canvas = canvas;
    this.resources = resources;

    this.sizes = new Sizes();
    this.time = new Time();
    this.mouse = new Mouse();
    this.scene = new THREE.Scene();
    this.camera = new Camera();
    this.renderer = new Renderer();
    this.world = new World();
    this.postProcessing = new PostProcessing();

    this.time.on('animate', () => {
      this.update();
    });
    this.sizes.on('resize', () => {
      this.resize();
    });
  }

  static getInstance() {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  resize() {
    this.camera.resize();
    this.renderer.resize();
    this.postProcessing.resize();
  }

  update() {
    this.activeStep += (this.targetStep - this.activeStep) * Math.min(this.time.delta * 3.5, 1);
    this.mouse.update(this.time.delta);
    this.camera.update(this.mouse, this.time.delta);
    this.updateOnboardingMotion();
    this.world.update();
    this.postProcessing.update(this.time.elapsedTime, this.time.delta);
    this.renderer.update();
  }

  updateOnboardingMotion() {
    if (!this.world?.dolphin?.dolphin || !this.camera?.cameraInstance) return;

    const stepShift = this.activeStep - 1.5;
    const elapsed = this.time.elapsedTime;
    const dolphin = this.world.dolphin.dolphin;

    const heroOffset = this.sizes.width < 720 ? -0.18 : -0.82;

    dolphin.position.x = heroOffset + stepShift * 0.22 + Math.sin(elapsed * 0.42) * 0.14;
    dolphin.position.y = 0.3 + Math.sin(elapsed * 0.8) * 0.07;
    dolphin.rotation.z = Math.sin(elapsed * 0.55) * 0.025;
    dolphin.scale.setScalar(this.sizes.width < 720 ? 0.88 : 1.22);

    this.scene.rotation.y = stepShift * 0.025 + Math.sin(elapsed * 0.08) * 0.012;
    this.camera.cameraInstance.fov = 35 + Math.sin(elapsed * 0.22 + this.activeStep) * 0.5;
    this.camera.cameraInstance.updateProjectionMatrix();
  }

  setActiveStep(step) {
    this.targetStep = step;
  }

  destroy() {
    this.sizes.destroy();
    this.time.destroy();
    this.mouse.destroy();
    this.world?.dispose?.();

    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();

        for (const key in child.material) {
          const value = child.material[key];

          if (typeof value?.dispose === 'function') {
            value.dispose();
          }
        }
      }
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          for (const key in m) {
            const prop = m[key];
            if (prop && prop.isTexture) prop.dispose();
          }
          m.dispose();
        });
      }
    });

    this.camera.controls.dispose();
    this.renderer.rendererInstance.dispose();
    this.postProcessing.dispose();

    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.postProcessing = null;
    this.world = null;
    this.debug = null;
    Game.instance = null;
  }
}
