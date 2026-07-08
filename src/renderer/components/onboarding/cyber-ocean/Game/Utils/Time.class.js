import EventEmitter from './EventEmitter.class';

export default class Time extends EventEmitter {
  constructor() {
    super();

    this.start = Date.now();
    this.current = this.start;
    this.elapsedTime = 0;
    this.delta = 34;
    this.isRunning = true;

    this.frameId = window.requestAnimationFrame(() => {
      this.animate();
    });
  }

  animate() {
    if (!this.isRunning) return;

    const currentTime = Date.now();
    this.delta = Math.min((currentTime - this.current) / 1000, 0.1);
    this.current = currentTime;
    this.elapsedTime = (this.current - this.start) / 1000;

    this.trigger('animate');

    this.frameId = window.requestAnimationFrame(() => {
      this.animate();
    });
  }

  destroy() {
    this.isRunning = false;
    window.cancelAnimationFrame(this.frameId);
    this.callbacks = { base: {} };
  }
}
