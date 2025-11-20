/**
 * Audio Worklet Processor for VAD-filtered Audio Streaming
 * Runs in a separate thread for efficient audio processing
 *
 * Modified for VAD integration:
 * - Sends raw Float32 chunks to main thread for VAD processing
 * - Keeps RMS detection for interruption handling only
 */

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.isSpeaking = false;
    this.speechThreshold = 0.01; // RMS threshold for interruption detection only
    this.lastSpeechTime = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const inputData = input[0]; // First channel (mono)

    // Calculate RMS volume for interruption detection
    // (VAD will do the real speech detection in main thread)
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);

    // Detect speech start/end for interruption handling
    const currentTime = Date.now(); // Use timestamp instead

    if (!this.isSpeaking && rms > this.speechThreshold) {
      this.isSpeaking = true;
      this.lastSpeechTime = currentTime;
      this.port.postMessage({
        type: 'speech-start',
        time: currentTime,
        rms: rms
      });
    }

    if (this.isSpeaking && rms < this.speechThreshold) {
      const duration = currentTime - this.lastSpeechTime;
      this.port.postMessage({
        type: 'speech-end',
        duration: duration
      });
      this.isSpeaking = false;
    }

    // NEW: Send raw Float32 data to main thread for VAD processing
    // VAD will decide whether to convert and send to Gemini
    // Clone the Float32Array to avoid transfer issues
    const audioClone = new Float32Array(inputData);

    this.port.postMessage({
      type: 'audio-data',
      data: audioClone.buffer
    }, [audioClone.buffer]); // Transfer buffer ownership for efficiency

    return true; // Keep processor alive
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
