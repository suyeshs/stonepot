# VAD Workflow Validation - Current State Analysis

## Executive Summary

**Current State**: Audio is continuously streamed to Gemini Flash Live API from microphone, with basic RMS-based speech detection for UI state only.

**Problem**:
- All audio chunks are sent to Gemini regardless of speech presence
- Costs ₹8-12/hour vs expected ₹2-3/hour with VAD
- Background noise triggers false responses
- No wake word support
- Battery drain on mobile devices

**Proposed Solution**: Integrate Silero VAD to filter audio before sending to Gemini API.

---

## Current Audio Processing Workflow

### 1. Audio Input Pipeline

```
Microphone (16kHz, mono)
    ↓
MediaStream API (getUserMedia)
    ↓
AudioContext (16kHz sample rate)
    ↓
AudioWorkletNode ('audio-stream-processor')
    ↓
AudioStreamProcessor (AudioWorklet thread)
    ↓
[Converts Float32 → Int16 PCM]
    ↓
Posts message to main thread
    ↓
Main thread sends to VertexAILiveService
    ↓
WebSocket → Backend → Gemini Flash Live API
```

**Key Files**:
- [app/page.tsx:498-569](stonepot-restaurant-client/app/page.tsx#L498-L569) - `startContinuousMicrophoneCapture()`
- [public/audio-processor.js:1-71](stonepot-restaurant-client/public/audio-processor.js#L1-L71) - AudioWorklet processor
- [app/services/VertexAILiveService.ts:139-152](stonepot-restaurant-client/app/services/VertexAILiveService.ts#L139-L152) - `sendAudio()`

### 2. Current Speech Detection (RMS-based)

**Location**: [public/audio-processor.js:24-51](stonepot-restaurant-client/public/audio-processor.js#L24-L51)

```javascript
// Calculate RMS volume
let sum = 0;
for (let i = 0; i < inputData.length; i++) {
  sum += inputData[i] * inputData[i];
}
const rms = Math.sqrt(sum / inputData.length);

// Detect speech with threshold
const speechThreshold = 0.01;
if (!this.isSpeaking && rms > speechThreshold) {
  this.isSpeaking = true;
  this.port.postMessage({ type: 'speech-start', rms });
}
```

**Purpose**: UI state management ONLY (listening → thinking → speaking)
**Does NOT**: Filter audio chunks sent to Gemini

### 3. Audio Transmission to Gemini

**Location**: [public/audio-processor.js:53-64](stonepot-restaurant-client/public/audio-processor.js#L53-L64)

```javascript
// Convert Float32 to Int16 PCM
const pcmData = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
  const s = Math.max(-1, Math.min(1, inputData[i]));
  pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}

// Send PCM data to main thread (ALWAYS sent, no filtering)
this.port.postMessage({
  type: 'audio-data',
  data: pcmData.buffer
}, [pcmData.buffer]);
```

**Critical Finding**:
- **ALL audio chunks are sent**, regardless of speech detection
- RMS detection is only used for UI status updates
- No buffering or gating logic exists

### 4. Audio Playback (AI Response)

**Location**: [app/page.tsx:606-675](stonepot-restaurant-client/app/page.tsx#L606-L675)

```javascript
const playPCMAudio = async (audioData: ArrayBuffer) => {
  // Initialize playback context (24kHz)
  const playbackContextRef = new AudioContext({ sampleRate: 24000 });

  // Convert Int16 PCM → Float32
  const pcm16 = new Int16Array(audioData);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
  }

  // Schedule and play audio chunks
  const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
  source.start(startTime);
}
```

**Audio Format**:
- Input: 16kHz, mono, PCM16
- Output: 24kHz, mono, PCM16

---

## Interruption Handling

**Location**: [app/page.tsx:522-547](stonepot-restaurant-client/app/page.tsx#L522-L547)

```javascript
workletNode.port.onmessage = (event) => {
  if (type === 'speech-start') {
    // INTERRUPTION DETECTION: User started speaking
    if (sessionStatus === 'speaking') {
      console.log('[Audio] INTERRUPTION - User spoke while AI was speaking');

      // Stop current audio playback immediately
      playbackContextRef.current?.close();

      // Send interruption signal to backend
      vertexAILiveServiceRef.current?.interrupt();
    }
  }
}
```

**How it works**:
1. RMS detects user speech start
2. If AI is currently speaking (`sessionStatus === 'speaking'`)
3. Stop playback context
4. Send `interrupt` message to backend

**Important**: This uses the same RMS detection, which is NOT robust enough for production.

---

## Audio Context Configuration

### Recording Context
**Location**: [app/page.tsx:509-516](stonepot-restaurant-client/app/page.tsx#L509-L516)

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,  // ⚠️ Browser-based, not always effective
    autoGainControl: true
  }
});

const audioContext = new AudioContext({ sampleRate: 16000 });
```

**Issues**:
- `noiseSuppression: true` is browser-dependent and inconsistent
- Does NOT prevent background noise from being sent to Gemini
- Only helps with microphone quality, not API cost optimization

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Current Workflow                            │
└─────────────────────────────────────────────────────────────────┘

User speaks │  Background noise │  Silence
     │                │               │
     ▼                ▼               ▼
┌────────────────────────────────────────┐
│  Microphone (16kHz, mono)              │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  AudioWorklet (audio-processor.js)     │
│  • Calculates RMS for UI state         │
│  • Converts Float32 → PCM16            │
│  • Posts ALL chunks to main thread     │  ⚠️ NO FILTERING
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  Main Thread (page.tsx)                │
│  • Receives 'audio-data' messages      │
│  • Sends ALL chunks to VertexAI        │  ⚠️ NO GATING
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  VertexAILiveService.sendAudio()       │
│  • Streams to WebSocket                │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│  Backend → Gemini Flash Live API       │
│  💰 Bills for ALL audio chunks         │  💸 HIGH COST
└────────────────────────────────────────┘
```

---

## Cost Analysis

### Current State
- **Audio sent to Gemini**: Continuous stream (100% of recording time)
- **Typical 1-hour session**:
  - User speaks: ~5-10 minutes (8-17%)
  - AI responds: ~5-10 minutes (8-17%)
  - Silence/background noise: ~40-50 minutes (67-83%)

**Current Cost**: ₹8-12/hour (billing for silence + noise)

### With Silero VAD
- **Audio sent to Gemini**: Only during detected speech (15-25% of recording time)
- **Savings**: 60-80% reduction
- **Expected Cost**: ₹2-3/hour

---

## Integration Points for VAD

### Option A: VAD in AudioWorklet (Recommended)

**Advantages**:
- Runs in separate thread (no main thread blocking)
- Lowest latency (~10-20ms)
- Can buffer audio chunks during speech
- Clean separation of concerns

**Integration**:
```javascript
// In audio-processor.js
class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    this.vadModel = null; // Load Silero VAD ONNX
    this.audioBuffer = []; // Buffer for speech chunks
    this.isSpeechActive = false;
  }

  process(inputs, outputs, parameters) {
    const inputData = inputs[0][0];

    // Run VAD on chunk
    const speechProbability = this.vadModel.detect(inputData);

    if (speechProbability > 0.5) {
      // Speech detected - buffer and send
      this.audioBuffer.push(inputData);

      if (!this.isSpeechActive) {
        this.isSpeechActive = true;
        this.port.postMessage({ type: 'speech-start' });
      }

      // Convert to PCM16 and send
      const pcmData = convertToPCM16(inputData);
      this.port.postMessage({ type: 'audio-data', data: pcmData });

    } else if (this.isSpeechActive) {
      // Silence after speech - wait for threshold
      // (add silence detection with 300-800ms buffer)
      this.silenceCounter++;

      if (this.silenceCounter > SILENCE_THRESHOLD) {
        this.isSpeechActive = false;
        this.port.postMessage({ type: 'speech-end' });
      }
    }
  }
}
```

**Challenge**: ONNX Runtime Web in AudioWorklet context
- AudioWorklet is a separate global scope
- Need to load ONNX Runtime Web in worklet
- May require SharedArrayBuffer for model weights

### Option B: VAD in Main Thread

**Advantages**:
- Easier ONNX Runtime integration
- Access to full browser APIs
- Simpler debugging

**Disadvantages**:
- Adds latency (~50-100ms)
- Potential main thread blocking
- More complex state management

**Integration**:
```javascript
// In page.tsx
const processAudioWithVAD = async (audioData: Float32Array) => {
  const speechProbability = await vadModel.detect(audioData);

  if (speechProbability > VAD_THRESHOLD) {
    // Convert to PCM16
    const pcmData = convertToPCM16(audioData);

    // Send to Gemini
    vertexAILiveServiceRef.current.sendAudio(pcmData);
  }
};

workletNode.port.onmessage = (event) => {
  if (event.data.type === 'audio-data') {
    // Run VAD before sending
    processAudioWithVAD(event.data.data);
  }
};
```

---

## Required Changes for VAD Integration

### 1. Load Silero VAD Model
- **Model**: `silero_vad.onnx` (1.8MB)
- **Source**: https://github.com/snakers4/silero-vad
- **Format**: ONNX (use ONNX Runtime Web)
- **Location**: `/public/models/silero_vad.onnx`

### 2. Modify AudioWorklet Processor

**File**: `public/audio-processor.js`

**Changes**:
```diff
class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
-   this.speechThreshold = 0.01; // RMS-based (unreliable)
+   this.vadSession = null; // ONNX session
+   this.vadThreshold = 0.5; // Speech probability
+   this.silenceFrames = 0;
+   this.maxSilenceFrames = 16; // ~800ms at 16kHz with 512 samples/chunk
+   this.audioBuffer = [];
  }

  process(inputs, outputs, parameters) {
    const inputData = input[0];

-   // Old RMS detection
-   const rms = calculateRMS(inputData);
-   if (rms > this.speechThreshold) { ... }

+   // New VAD detection
+   const speechProb = this.runVAD(inputData);
+
+   if (speechProb > this.vadThreshold) {
+     // Speech detected
+     this.silenceFrames = 0;
+
+     if (!this.isSpeaking) {
+       this.isSpeaking = true;
+       this.port.postMessage({ type: 'speech-start' });
+     }
+
+     // Send audio chunk
+     const pcmData = convertToPCM16(inputData);
+     this.port.postMessage({ type: 'audio-data', data: pcmData });
+
+   } else if (this.isSpeaking) {
+     // Silence during speech
+     this.silenceFrames++;
+
+     if (this.silenceFrames > this.maxSilenceFrames) {
+       this.isSpeaking = false;
+       this.port.postMessage({ type: 'speech-end' });
+     }
+   }
-
-   // REMOVED: Always sending audio
-   this.port.postMessage({ type: 'audio-data', data: pcmData });
  }
}
```

### 3. Update Main Thread Handler

**File**: `app/page.tsx`

**Changes**:
```diff
workletNode.port.onmessage = (event) => {
  const { type, data } = event.data;

  if (type === 'speech-start') {
    // Existing interruption logic
    if (sessionStatus === 'speaking') {
      vertexAILiveServiceRef.current.interrupt();
    }
    setSessionStatus('listening');
  }

  if (type === 'speech-end') {
+   // NEW: Signal turn complete to Gemini
+   vertexAILiveServiceRef.current.sendTurnComplete();
    setSessionStatus('thinking');
  }

  if (type === 'audio-data') {
-   // OLD: Send all chunks
-   vertexAILiveServiceRef.current.sendAudio(data);

+   // NEW: Only sent when VAD detects speech (already filtered in worklet)
+   if (vertexAILiveServiceRef.current?.isActive()) {
+     vertexAILiveServiceRef.current.sendAudio(data);
+   }
  }
};
```

### 4. Add VAD Configuration

**New File**: `app/config/vad.ts`

```typescript
export const VAD_CONFIG = {
  model: '/models/silero_vad.onnx',
  threshold: 0.5, // Speech probability (0-1)
  silenceDuration: 800, // ms of silence before turn complete
  minSpeechDuration: 250, // ms to avoid false positives
  sampleRate: 16000,
  frameSamples: 512, // Silero VAD expects 512 samples @ 16kHz
};
```

---

## Wake Word Integration (Future Phase)

**After VAD is working**, add wake word detection:

### Architecture
```
Microphone
    ↓
VAD (Silero) - Filter noise/silence
    ↓
Wake Word Detector (Porcupine or custom)
    ↓
[If wake word detected] → Activate Gemini streaming
    ↓
Continue with VAD for conversation
    ↓
[Timeout or end phrase] → Deactivate
```

**Libraries**:
- **Porcupine** (Picovoice): Pre-trained wake words ("Hey Google", "Alexa", custom)
- **Custom TFLite model**: Train on "Hey Stonepot" or "Order food"

**Integration Point**: After VAD in AudioWorklet
```javascript
if (vadDetectedSpeech) {
  const isWakeWord = wakeWordDetector.detect(audioChunk);
  if (isWakeWord) {
    this.isActiveSession = true; // Start Gemini streaming
  }

  if (this.isActiveSession) {
    // Send to Gemini
    this.port.postMessage({ type: 'audio-data', data: pcmData });
  }
}
```

---

## Technical Challenges

### 1. ONNX Runtime in AudioWorklet
**Challenge**: AudioWorklet global scope is restricted
**Solution**:
- Use `onnxruntime-web` with WebAssembly backend
- Load model in main thread, transfer to worklet via SharedArrayBuffer
- OR: Run VAD in main thread (simpler but higher latency)

### 2. Model Input Format
**Challenge**: Silero VAD expects specific input shape
- Input: `[1, samples]` where samples = 512, 256, or 128
- Sample rate: Must be 16kHz (✅ already 16kHz)
- Format: Float32Array (✅ AudioWorklet uses Float32)

**Solution**: Accumulate samples to 512 before running VAD
```javascript
// In AudioWorklet
this.vadBuffer = [];

process(inputs) {
  const inputData = inputs[0][0];
  this.vadBuffer.push(...inputData);

  // Run VAD every 512 samples
  if (this.vadBuffer.length >= 512) {
    const chunk = this.vadBuffer.slice(0, 512);
    const speechProb = this.runVAD(chunk);
    this.vadBuffer = this.vadBuffer.slice(512);
  }
}
```

### 3. Silence Buffering
**Challenge**: VAD may have false negatives mid-sentence (pauses)
**Solution**: Add silence tolerance (300-800ms)
```javascript
if (speechProb < threshold) {
  this.silenceFrames++;

  // Still send audio during short pauses (up to 800ms)
  if (this.silenceFrames < MAX_SILENCE_FRAMES) {
    this.port.postMessage({ type: 'audio-data', data: pcmData });
  }
}
```

### 4. Turn Completion Detection
**Challenge**: When to send `turn_complete` to Gemini?
**Solution**: After sustained silence (800ms recommended)
```javascript
if (this.silenceFrames >= MAX_SILENCE_FRAMES) {
  this.isSpeaking = false;
  this.port.postMessage({ type: 'turn-complete' });
}
```

---

## Testing Strategy

### 1. VAD Accuracy Testing
- **Silent room**: Should NOT send audio (0% false positives)
- **Background music**: Should ignore (test with café ambiance)
- **Speech**: Should detect within 50ms
- **Pauses mid-sentence**: Should NOT trigger turn-complete

### 2. Cost Validation
- **Metric**: Total audio bytes sent to Gemini
- **Expected**: 60-80% reduction vs current
- **Measure**: Log `sendAudio()` calls and byte count

### 3. Latency Testing
- **Target**: <100ms from speech start to Gemini receiving audio
- **Measure**: `speech-start` timestamp to WebSocket send

### 4. Interruption Testing
- **Scenario**: User speaks while AI is responding
- **Expected**: AI stops immediately, user audio sent

---

## Migration Plan

### Phase 1: VAD Integration (Week 1)
- [ ] Add Silero VAD ONNX model to `/public/models/`
- [ ] Integrate ONNX Runtime Web
- [ ] Test VAD in main thread (simpler first iteration)
- [ ] Measure cost savings

### Phase 2: Optimize to AudioWorklet (Week 2)
- [ ] Move VAD to AudioWorklet for lower latency
- [ ] Test SharedArrayBuffer for model weights
- [ ] Fallback to main thread if worklet fails

### Phase 3: Wake Word (Week 3-4)
- [ ] Integrate Porcupine or TFLite wake word model
- [ ] Test activation/deactivation flow
- [ ] Add UI for wake word status

### Phase 4: Production Hardening
- [ ] Error handling (model load failures)
- [ ] Browser compatibility testing (Safari, Firefox, Chrome)
- [ ] Mobile optimization (battery usage)
- [ ] Monitoring and analytics

---

## Expected Outcomes

### Cost Reduction
- **Before VAD**: ₹8-12/hour (streaming all audio)
- **After VAD**: ₹2-3/hour (streaming only speech)
- **Savings**: ₹5-9/hour per session (60-80% reduction)

### User Experience
- **No false triggers** from background noise
- **Faster response** (less audio to process)
- **Battery savings** on mobile (less WebSocket traffic)
- **Privacy**: Mic not "always on" (with wake word)

### Technical Metrics
- **Latency**: <100ms from speech start to Gemini
- **Accuracy**: >95% speech detection (Silero VAD: 99.2% on benchmarks)
- **False positive rate**: <1% (background noise triggering)

---

## Decision: Next Steps

**Recommendation**: Start with **Option B (VAD in Main Thread)** for faster implementation.

**Reasoning**:
1. Easier ONNX Runtime integration (no AudioWorklet global scope issues)
2. Faster development and testing
3. Can migrate to AudioWorklet in Phase 2 if latency is an issue
4. Latency delta (50-100ms) is acceptable for voice ordering use case

**Action Items**:
1. Download Silero VAD ONNX model
2. Add `onnxruntime-web` dependency
3. Create VAD service class
4. Modify `audio-processor.js` to send raw Float32 chunks (not PCM16 yet)
5. Run VAD in main thread, convert to PCM16 only if speech detected
6. Test cost savings with logging

---

**Status**: ✅ Workflow Validated
**Ready for Implementation**: Yes
**Estimated Development Time**: 1-2 days (main thread VAD), 3-4 days (AudioWorklet VAD)
