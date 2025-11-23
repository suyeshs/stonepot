/**
 * Voice Activity Detection (VAD) Configuration
 * Using Silero VAD for speech detection
 */

export const VAD_CONFIG = {
  // Model path (relative to public/)
  modelPath: '/models/silero_vad.onnx',

  // Speech probability threshold (0-1)
  // Higher = more conservative (less false positives)
  // Lower = more sensitive (may catch weak speech)
  threshold: 0.5,

  // Silence duration before considering turn complete (ms)
  // Recommended: 300-800ms for natural conversation
  silenceDuration: 800,

  // Minimum speech duration to avoid false positives (ms)
  // Helps filter out brief noises
  minSpeechDuration: 250,

  // Audio configuration
  sampleRate: 16000, // Must match AudioContext sample rate

  // Silero VAD expects specific frame sizes
  // Valid options: 512, 256, or 128 samples at 16kHz
  frameSamples: 512, // ~32ms per frame at 16kHz

  // Maximum silence frames before turn complete
  // silenceDuration (800ms) / frame duration (32ms) = 25 frames
  maxSilenceFrames: 25,

  // Enable detailed logging for debugging
  debug: true,

  // Positive speech buffer (frames)
  // Continue sending audio for N frames after speech ends
  // to avoid cutting off final syllables
  positiveSpeechPad: 10, // ~320ms buffer after speech
};

/**
 * Calculate frame duration in milliseconds
 */
export const getFrameDurationMs = (): number => {
  return (VAD_CONFIG.frameSamples / VAD_CONFIG.sampleRate) * 1000;
};

/**
 * Validate VAD configuration
 */
export const validateVADConfig = (): boolean => {
  const { frameSamples, threshold, silenceDuration, sampleRate } = VAD_CONFIG;

  // Silero VAD only supports specific frame sizes
  const validFrameSizes = [128, 256, 512];
  if (!validFrameSizes.includes(frameSamples)) {
    console.error(`[VAD Config] Invalid frameSamples: ${frameSamples}. Must be 128, 256, or 512.`);
    return false;
  }

  // Threshold must be between 0 and 1
  if (threshold < 0 || threshold > 1) {
    console.error(`[VAD Config] Invalid threshold: ${threshold}. Must be between 0 and 1.`);
    return false;
  }

  // Silence duration should be reasonable
  if (silenceDuration < 100 || silenceDuration > 5000) {
    console.warn(`[VAD Config] Unusual silenceDuration: ${silenceDuration}ms. Recommended: 300-800ms.`);
  }

  // Sample rate must be 16kHz for Silero VAD
  if (sampleRate !== 16000) {
    console.error(`[VAD Config] Invalid sampleRate: ${sampleRate}. Silero VAD requires 16kHz.`);
    return false;
  }

  console.log('[VAD Config] Configuration validated ✓');
  return true;
};
