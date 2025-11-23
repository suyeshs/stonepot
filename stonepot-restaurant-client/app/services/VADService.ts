/**
 * Voice Activity Detection Service
 * Uses Silero VAD ONNX model for speech detection
 */

import * as ort from 'onnxruntime-web';
import { VAD_CONFIG, validateVADConfig } from '../config/vad';

export interface VADResult {
  isSpeech: boolean;
  probability: number;
  timestamp: number;
}

export class VADService {
  private session: ort.InferenceSession | null = null;
  private isInitialized: boolean = false;
  private audioBuffer: Float32Array[] = [];
  private h: ort.Tensor | null = null; // Hidden state tensor
  private c: ort.Tensor | null = null; // Cell state tensor
  private lastStateReset: number = 0;
  private sampleRate: number = VAD_CONFIG.sampleRate;

  // Statistics for debugging and cost tracking
  private stats = {
    totalFrames: 0,
    speechFrames: 0,
    silenceFrames: 0,
    totalAudioSent: 0, // bytes
    totalAudioReceived: 0, // bytes
  };

  constructor() {
    // Validate configuration on initialization
    if (!validateVADConfig()) {
      throw new Error('Invalid VAD configuration');
    }
  }

  /**
   * Initialize VAD model
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[VAD] Already initialized');
      return;
    }

    try {
      console.log('[VAD] Loading Silero VAD model...');
      const startTime = performance.now();

      // Configure ONNX Runtime for browser - use the installed version
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

      // Load the model
      this.session = await ort.InferenceSession.create(VAD_CONFIG.modelPath, {
        executionProviders: ['wasm'],
      });

      // Initialize LSTM state (required by Silero VAD)
      // Hidden and cell state shape: [2, 1, 64] each (2 layers, batch size 1, hidden size 64)
      const hiddenSize = 64;
      const batchSize = 1;
      const numLayers = 2;

      const hData = new Float32Array(numLayers * batchSize * hiddenSize);
      hData.fill(0);
      this.h = new ort.Tensor('float32', hData, [numLayers, batchSize, hiddenSize]);

      const cData = new Float32Array(numLayers * batchSize * hiddenSize);
      cData.fill(0);
      this.c = new ort.Tensor('float32', cData, [numLayers, batchSize, hiddenSize]);

      const loadTime = performance.now() - startTime;
      console.log(`[VAD] Model loaded successfully in ${loadTime.toFixed(0)}ms`);

      this.isInitialized = true;
      this.lastStateReset = Date.now();
    } catch (error) {
      console.error('[VAD] Failed to initialize:', error);
      throw new Error(`VAD initialization failed: ${error}`);
    }
  }

  /**
   * Process audio chunk and detect speech
   * @param audioData Float32Array of audio samples (any length)
   * @returns VADResult indicating if speech was detected
   */
  async process(audioData: Float32Array): Promise<VADResult> {
    if (!this.isInitialized || !this.session) {
      throw new Error('VAD not initialized. Call initialize() first.');
    }

    // Debug: Check if audio data is empty or has values
    if (VAD_CONFIG.debug && Math.random() < 0.01) { // Log 1% of chunks
      const min = Math.min(...Array.from(audioData));
      const max = Math.max(...Array.from(audioData));
      let sum = 0;
      for (let i = 0; i < audioData.length; i++) {
        sum += audioData[i] * audioData[i];
      }
      const chunkRMS = Math.sqrt(sum / audioData.length);
      console.log(`[VAD Debug] Incoming chunk: ${audioData.length} samples | Min: ${min.toFixed(4)} | Max: ${max.toFixed(4)} | RMS: ${chunkRMS.toFixed(4)}`);
    }

    // Add incoming audio to buffer
    this.audioBuffer.push(audioData);

    // Accumulate samples until we have enough for VAD (512 samples)
    const totalSamples = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);

    if (totalSamples < VAD_CONFIG.frameSamples) {
      // Not enough samples yet, return silence
      return {
        isSpeech: false,
        probability: 0,
        timestamp: Date.now(),
      };
    }

    // Extract exactly 512 samples from buffer
    const vadInput = this.extractSamples(VAD_CONFIG.frameSamples);

    // Run VAD inference
    const result = await this.runInference(vadInput);

    // Update statistics
    this.stats.totalFrames++;
    this.stats.totalAudioReceived += audioData.length * 4; // Float32 = 4 bytes per sample

    if (result.isSpeech) {
      this.stats.speechFrames++;
      this.stats.totalAudioSent += VAD_CONFIG.frameSamples * 2; // PCM16 = 2 bytes per sample
    } else {
      this.stats.silenceFrames++;
    }

    return result;
  }

  /**
   * Extract N samples from buffer and remove them
   */
  private extractSamples(count: number): Float32Array {
    const result = new Float32Array(count);
    let offset = 0;

    while (offset < count && this.audioBuffer.length > 0) {
      const chunk = this.audioBuffer[0];
      const needed = count - offset;
      const available = chunk.length;

      if (available <= needed) {
        // Use entire chunk
        result.set(chunk, offset);
        offset += available;
        this.audioBuffer.shift();
      } else {
        // Use part of chunk
        result.set(chunk.slice(0, needed), offset);
        this.audioBuffer[0] = chunk.slice(needed);
        offset += needed;
      }
    }

    return result;
  }

  /**
   * Run Silero VAD inference
   */
  private async runInference(audioData: Float32Array): Promise<VADResult> {
    if (!this.session || !this.h || !this.c) {
      throw new Error('VAD session not initialized');
    }

    try {
      // Prepare input tensor [1, samples]
      const inputTensor = new ort.Tensor('float32', audioData, [1, audioData.length]);

      // Sample rate tensor (int64) - create BigInt64Array properly
      const srArray = new BigInt64Array(1);
      srArray[0] = BigInt(this.sampleRate);
      const srTensor = new ort.Tensor('int64', srArray, [1]);

      // Debug: Log tensor values to verify
      if (VAD_CONFIG.debug && Math.random() < 0.001) {
        console.log('[VAD Debug] Input shape:', [1, audioData.length]);
        console.log('[VAD Debug] Sample rate:', this.sampleRate, '| Tensor SR:', srArray[0]);
        console.log('[VAD Debug] h shape:', this.h.dims, '| c shape:', this.c.dims);
        console.log('[VAD Debug] Audio range:', Math.min(...audioData), 'to', Math.max(...audioData));
      }

      // Run inference with separate h and c states
      const feeds = {
        input: inputTensor,
        sr: srTensor,
        h: this.h,
        c: this.c,
      };

      const results = await this.session.run(feeds);

      // Extract outputs
      const output = results.output; // Speech probability
      const hn = results.hn; // New hidden state
      const cn = results.cn; // New cell state

      // Update states for next inference
      this.h = hn;
      this.c = cn;

      // Get speech probability (single float value)
      const probability = (output.data as Float32Array)[0];
      const isSpeech = probability >= VAD_CONFIG.threshold;

      if (VAD_CONFIG.debug) {
        // Calculate RMS for comparison
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
          sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);

        console.log(`[VAD] Prob: ${probability.toFixed(3)} | RMS: ${rms.toFixed(4)} | Samples: ${audioData.length} | Speech: ${isSpeech ? 'YES' : 'NO'}`);
      }

      return {
        isSpeech,
        probability,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[VAD] Inference error:', error);
      // Return silence on error to avoid breaking the audio pipeline
      return {
        isSpeech: false,
        probability: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Reset hidden states (call after long silence or new conversation)
   */
  resetState(): void {
    if (!this.h || !this.c) return;

    // Reset states to zeros
    const hiddenSize = 64;
    const batchSize = 1;
    const numLayers = 2;

    const hData = new Float32Array(numLayers * batchSize * hiddenSize);
    hData.fill(0);
    this.h = new ort.Tensor('float32', hData, [numLayers, batchSize, hiddenSize]);

    const cData = new Float32Array(numLayers * batchSize * hiddenSize);
    cData.fill(0);
    this.c = new ort.Tensor('float32', cData, [numLayers, batchSize, hiddenSize]);

    this.audioBuffer = [];
    this.lastStateReset = Date.now();

    if (VAD_CONFIG.debug) {
      console.log('[VAD] State reset');
    }
  }

  /**
   * Get statistics for cost tracking
   */
  getStats() {
    const savingsPercent =
      this.stats.totalAudioReceived > 0
        ? ((1 - this.stats.totalAudioSent / this.stats.totalAudioReceived) * 100).toFixed(1)
        : '0.0';

    return {
      ...this.stats,
      savingsPercent: `${savingsPercent}%`,
      speechRatio: (this.stats.speechFrames / Math.max(this.stats.totalFrames, 1)).toFixed(2),
      totalAudioReceivedMB: (this.stats.totalAudioReceived / 1024 / 1024).toFixed(2),
      totalAudioSentMB: (this.stats.totalAudioSent / 1024 / 1024).toFixed(2),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalFrames: 0,
      speechFrames: 0,
      silenceFrames: 0,
      totalAudioSent: 0,
      totalAudioReceived: 0,
    };
    console.log('[VAD] Statistics reset');
  }

  /**
   * Log current statistics
   */
  logStats(): void {
    const stats = this.getStats();
    console.log('[VAD Stats]', {
      'Total Frames': stats.totalFrames,
      'Speech Frames': stats.speechFrames,
      'Silence Frames': stats.silenceFrames,
      'Speech Ratio': stats.speechRatio,
      'Audio Received': `${stats.totalAudioReceivedMB} MB`,
      'Audio Sent to Gemini': `${stats.totalAudioSentMB} MB`,
      'Savings': stats.savingsPercent,
    });
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.session = null;
    this.h = null;
    this.c = null;
    this.audioBuffer = [];
    this.isInitialized = false;
    console.log('[VAD] Disposed');
  }

  /**
   * Check if VAD is ready to process audio
   */
  isReady(): boolean {
    return this.isInitialized && this.session !== null && this.h !== null && this.c !== null;
  }
}
