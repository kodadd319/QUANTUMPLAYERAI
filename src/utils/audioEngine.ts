import { DspSettings } from "../types";

export class CarAudioEngine {
  public ctx: AudioContext | null = null;
  public audioElement: HTMLMediaElement;
  private source: MediaElementAudioSourceNode | null = null;
  private attachedElements = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

  // DSP Node collection
  private hpFilter!: BiquadFilterNode;
  private eqFilters: BiquadFilterNode[] = [];
  private bassBoostFilter!: BiquadFilterNode;
  
  // Time alignment delay lines
  private splitter!: ChannelSplitterNode;
  private leftDelay!: DelayNode;
  private rightDelay!: DelayNode;
  private merger!: ChannelMergerNode;

  // Tiny cabin reverberator
  private reverbDelay!: DelayNode;
  private reverbFeedback!: GainNode;
  private reverbWetGain!: GainNode;
  private dryGain!: GainNode;

  // Visualizer hookups
  public analyser!: AnalyserNode;

  private isArranged = false;

  constructor(audioElement: HTMLMediaElement) {
    this.audioElement = audioElement;
  }

  public attachMediaElement(element: HTMLMediaElement) {
    if (!element) return;
    this.audioElement = element;

    if (!this.ctx) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      this.ctx = new AudioContextClass();
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    // Reuse existing source for element if already created
    let mediaSource = this.attachedElements.get(element);
    if (!mediaSource) {
      try {
        mediaSource = this.ctx.createMediaElementSource(element);
        this.attachedElements.set(element, mediaSource);
      } catch (e) {
        console.warn("Media element already connected or restricted:", e);
      }
    }

    if (mediaSource) {
      if (this.source && this.source !== mediaSource) {
        try {
          this.source.disconnect();
        } catch (e) {}
      }
      this.source = mediaSource;

      if (!this.isArranged) {
        this.setupGraph();
      } else {
        try {
          this.source.connect(this.hpFilter);
        } catch (e) {
          // Already connected or noop
        }
      }
    }
  }

  private setupGraph() {
    if (!this.ctx || !this.source) return;

    // 1. High Pass Filter (Subsonic rumble protection)
    this.hpFilter = this.ctx.createBiquadFilter();
    this.hpFilter.type = "highpass";
    this.hpFilter.frequency.value = 30; // default protection cut-off

    // 2. Cascade Five-Band EQ
    // Frequencies: 60Hz, 250Hz, 1kHz, 4kHz, 16kHz
    const eqFrequencies = [60, 250, 1000, 4000, 16000];
    this.eqFilters = eqFrequencies.map((freq, idx) => {
      const filter = this.ctx!.createBiquadFilter();
      if (idx === 0) {
        filter.type = "lowshelf";
      } else if (idx === eqFrequencies.length - 1) {
        filter.type = "highshelf";
      } else {
        filter.type = "peaking";
        filter.Q.value = 1.0; // musical Q width
      }
      filter.frequency.value = freq;
      filter.gain.value = 0; // Flat initially
      return filter;
    });

    // 3. Car Subwoofer Bass Boost
    // 45Hz parametric peak booster is standard in high-end amplifiers
    this.bassBoostFilter = this.ctx.createBiquadFilter();
    this.bassBoostFilter.type = "peaking";
    this.bassBoostFilter.frequency.value = 45;
    this.bassBoostFilter.Q.value = 1.4; 
    this.bassBoostFilter.gain.value = 0;

    // 4. Time Alignment / Delay DSP Matrix (compensate left-right distances to driver seat)
    this.splitter = this.ctx.createChannelSplitter(2);
    this.leftDelay = this.ctx.createDelay(1.0);
    this.rightDelay = this.ctx.createDelay(1.0);
    this.merger = this.ctx.createChannelMerger(2);

    this.leftDelay.delayTime.value = 0.0;
    this.rightDelay.delayTime.value = 0.0;

    // 5. Cabin Reverb simulation feed
    this.reverbDelay = this.ctx.createDelay(0.5);
    this.reverbFeedback = this.ctx.createGain();
    this.reverbWetGain = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();

    this.reverbDelay.delayTime.value = 0.038; // 38ms cabin bounce reflection
    this.reverbFeedback.gain.value = 0.35; // short metal decay
    this.reverbWetGain.gain.value = 0.0; // start dry
    this.dryGain.gain.value = 1.0;

    // Connect Reverb loop
    this.reverbDelay.connect(this.reverbFeedback);
    this.reverbFeedback.connect(this.reverbDelay);

    // 6. Analyzer Hookup
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256; // 128 spectral bins - responsive for car audio meters

    // Wiring-up the node graph:
    // Source -> HPF -> EQ0 -> EQ1 -> EQ2 -> EQ3 -> EQ4 -> BassBoost
    let lastNode: AudioNode = this.source;
    
    lastNode.connect(this.hpFilter);
    lastNode = this.hpFilter;

    for (const filter of this.eqFilters) {
      lastNode.connect(filter);
      lastNode = filter;
    }

    lastNode.connect(this.bassBoostFilter);
    lastNode = this.bassBoostFilter;

    // Split signal for Time Alignment
    lastNode.connect(this.splitter);
    
    // Wire delay channels
    this.splitter.connect(this.leftDelay, 0);
    this.splitter.connect(this.rightDelay, 1);

    this.leftDelay.connect(this.merger, 0, 0);
    this.rightDelay.connect(this.merger, 0, 1);
    
    // Wire Merger to parallel dry-reverb stage
    const preOutputNode = this.merger;

    // Dry Path
    preOutputNode.connect(this.dryGain);

    // Wet Path
    preOutputNode.connect(this.reverbDelay);
    this.reverbDelay.connect(this.reverbWetGain);

    // Combine paths into Analyser -> Speakers
    this.dryGain.connect(this.analyser);
    this.reverbWetGain.connect(this.analyser);

    this.analyser.connect(this.ctx.destination);

    this.isArranged = true;
    console.log("Web Audio DSP Engine wired successfully!");
  }

  public init() {
    if (this.ctx) return;
    this.attachMediaElement(this.audioElement);
  }

  public resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Live adjustment methods
  public setEqBand(bandIndex: number, gainDb: number) {
    if (!this.isArranged) return;
    const boundedDb = Math.max(-12, Math.min(12, gainDb));
    if (this.eqFilters[bandIndex]) {
      // Use linear ramps to prevent audio popping clicks during sliders adjustment
      this.eqFilters[bandIndex].gain.setTargetAtTime(boundedDb, this.ctx!.currentTime, 0.05);
    }
  }

  public setBassBoost(level: number) {
    if (!this.isArranged) return;
    // Boost range is 0 to 18 dB (level goes from 0 to 100)
    const gainDb = (level / 100) * 18;
    this.bassBoostFilter.gain.setTargetAtTime(gainDb, this.ctx!.currentTime, 0.05);
  }

  public setHighPassFilter(freqHz: number) {
    if (!this.isArranged) return;
    this.hpFilter.frequency.setTargetAtTime(freqHz, this.ctx!.currentTime, 0.05);
  }

  public setCabinReverb(wetRatio: number) {
    if (!this.isArranged) return;
    // wetRatio: 0.0 to 0.4
    const boundedWet = Math.max(0.0, Math.min(0.4, wetRatio));
    this.reverbWetGain.gain.setTargetAtTime(boundedWet, this.ctx!.currentTime, 0.05);
    this.dryGain.gain.setTargetAtTime(1.0 - boundedWet * 0.5, this.ctx!.currentTime, 0.05);
  }

  public setTimeAlignmentDriver(delayOffsetMs: number, driverSide: "left" | "right" = "left") {
    if (!this.isArranged) return;
    // Usually, the driver sits left. The left speaker is ~50-80cm closer, so we delay it slightly,
    // centering sound image. Max 30ms latency compensation
    const delaySeconds = (delayOffsetMs) / 1000.0;
    
    if (driverSide === "left") {
      this.leftDelay.delayTime.setTargetAtTime(delaySeconds, this.ctx!.currentTime, 0.05);
      this.rightDelay.delayTime.setTargetAtTime(0.0, this.ctx!.currentTime, 0.05);
    } else {
      this.rightDelay.delayTime.setTargetAtTime(delaySeconds, this.ctx!.currentTime, 0.05);
      this.leftDelay.delayTime.setTargetAtTime(0.0, this.ctx!.currentTime, 0.05);
    }
  }

  public applyDspSettings(settings: DspSettings) {
    if (!this.isArranged) return;
    // Set all bands
    settings.eqBands.forEach((gain, index) => this.setEqBand(index, gain));
    // Set Bass
    this.setBassBoost(settings.bassBoost);
    // Set high-pass
    this.setHighPassFilter(settings.highPassFilterHz);
    // Set reverb
    this.setCabinReverb(settings.reverbWet);
    // Set driver offset
    this.setTimeAlignmentDriver(settings.delayOffsetMs);
  }
}
export default CarAudioEngine;
