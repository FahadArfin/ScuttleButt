export interface VoiceActivityOptions {
  attackFrames?: number;
  hangoverMs?: number;
}

export class VoiceActivityDetector {
  private readonly attackFrames: number;
  private readonly hangoverMs: number;
  private activeFrames = 0;
  private lastVoiceAt = Number.NEGATIVE_INFINITY;
  private speaking = false;

  constructor(options: VoiceActivityOptions = {}) {
    this.attackFrames = options.attackFrames ?? 2;
    this.hangoverMs = options.hangoverMs ?? 360;
  }

  update(level: number, threshold: number, inputOpen: boolean, now: number): boolean {
    const voiceDetected = inputOpen && level >= threshold;
    if (voiceDetected) {
      this.activeFrames += 1;
      this.lastVoiceAt = now;
      if (this.activeFrames >= this.attackFrames) this.speaking = true;
    } else {
      this.activeFrames = 0;
      if (!inputOpen || now - this.lastVoiceAt > this.hangoverMs) this.speaking = false;
    }
    return this.speaking;
  }

  reset(): void {
    this.activeFrames = 0;
    this.lastVoiceAt = Number.NEGATIVE_INFINITY;
    this.speaking = false;
  }
}
