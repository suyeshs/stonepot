# VAD Testing Guide - Phase 1

## ✅ Implementation Complete

Voice Activity Detection (VAD) has been integrated using Silero VAD. The system now filters audio before sending to Gemini API.

---

## 🚀 Quick Start

### 1. Server is Running
- **URL**: http://localhost:3000
- **Status**: ✓ Ready

### 2. Open Browser
```bash
open http://localhost:3000
```

### 3. Open DevTools Console
**Important**: Keep console open to see VAD logs!

Press `Cmd+Option+J` (Mac) or `F12` (Windows/Linux)

---

## 🧪 Test Scenarios

### Test 1: Silent Room (No Audio Sent)
**Goal**: Verify VAD doesn't send silence to Gemini

1. Click "Start Voice Order" button
2. Wait for VAD initialization: `[VAD] Ready ✓`
3. **Stay completely silent** for 10 seconds
4. Check console for:
   - ✅ `[VAD] Probability: 0.xxx | Speech: NO` (should be mostly 0.0-0.3)
   - ❌ Should **NOT** see frequent `[VertexAILive] Sent audio` messages

**Expected**:
- VAD detects silence
- **No audio sent to Gemini** (or minimal)
- Console shows: `Speech: NO` repeatedly

**Cost Impact**:
- Before VAD: ~100% of silence sent (wasteful)
- After VAD: ~0-5% of silence sent (filtered)

---

### Test 2: Background Noise (Music/Fan)
**Goal**: Verify VAD ignores non-speech sounds

1. Start voice session
2. Play background music or turn on a fan
3. **Don't speak** for 10 seconds
4. Check console:
   - ✅ `Speech: NO` for most frames
   - ❌ Occasional `Speech: YES` is acceptable (false positives <5%)

**Expected**:
- Most noise filtered out
- Minimal audio sent to Gemini
- Some false positives acceptable

**Tune if needed**:
- If too many false positives: Increase `threshold` in [app/config/vad.ts:17](stonepot-restaurant-client/app/config/vad.ts#L17) to 0.6 or 0.7
- Current: `threshold: 0.5`

---

### Test 3: Speech Detection
**Goal**: Verify VAD detects speech quickly and accurately

1. Start voice session
2. Wait for idle state
3. Say: **"I want to order chicken biryani"**
4. Check console:

**Expected sequence**:
```
[VAD] Probability: 0.001 | Speech: NO  (before speaking)
[VAD] Probability: 0.850 | Speech: YES ← Speech detected!
[VAD] Speech started
[VertexAILive] Sent audio: XXXX bytes  ← Audio sent to Gemini
[VAD] Probability: 0.920 | Speech: YES
[VertexAILive] Sent audio: XXXX bytes
[VAD] Probability: 0.003 | Speech: NO  (after speaking)
[VAD] Turn complete - sustained silence detected
```

**Timing**:
- Speech detection latency: <100ms
- Turn completion after silence: ~800ms (configured)

---

### Test 4: Mid-Sentence Pauses
**Goal**: Verify VAD doesn't cut off natural speech pauses

1. Start session
2. Say slowly: **"I want... [pause 1 second] ...chicken biryani"**
3. Check that audio continues during pause

**Expected**:
- VAD continues sending audio for short pauses (up to ~800ms)
- Turn doesn't complete until sustained silence
- No words cut off

**If words get cut off**:
- Increase `silenceDuration` in [app/config/vad.ts:22](stonepot-restaurant-client/app/config/vad.ts#L22) to 1000ms or 1200ms
- Current: `silenceDuration: 800`

---

### Test 5: Interruption Handling
**Goal**: Verify interruption still works with VAD

1. Start session
2. Ask a question that triggers a long AI response
3. **While AI is speaking**, interrupt by speaking
4. Check console:

**Expected**:
```
[Audio] INTERRUPTION - User spoke while AI was speaking
[VAD] Speech started
[VertexAILive] Sent audio: XXXX bytes
```

**Verify**:
- AI stops speaking immediately
- Your speech is captured and sent
- No delays or missed words

---

## 📊 Cost Tracking

### Check VAD Statistics

After each test, check the statistics in console:

1. End the voice session (click "End Session")
2. Look for final stats:

```javascript
[VAD] Final session statistics:
{
  'Total Frames': 1250,
  'Speech Frames': 300,
  'Silence Frames': 950,
  'Speech Ratio': '0.24',
  'Audio Received': '3.52 MB',
  'Audio Sent to Gemini': '0.85 MB',
  'Savings': '75.9%'
}
```

**Key Metrics**:
- **Savings**: Should be 60-80% for normal conversation
- **Speech Ratio**: Typically 0.15-0.30 (15-30% of time is speech)
- **Audio Sent**: Only speech frames sent to Gemini

---

## 🐛 Troubleshooting

### Issue: "VAD not initialized"

**Console shows**: `VAD not initialized. Call initialize() first.`

**Fix**:
1. Check browser console for errors during VAD initialization
2. Verify model loaded: `Network tab → silero_vad.onnx` (should be 285KB)
3. Refresh page and try again

---

### Issue: All audio still being sent

**Console shows lots of**: `[VertexAILive] Sent audio` even during silence

**Debug**:
1. Check if VAD is ready: Look for `[VAD] Ready ✓` in console
2. Verify VAD is processing: Should see `[VAD] Probability: X.XXX | Speech: YES/NO`
3. Check `vadServiceRef.current?.isReady()` in console:
   ```javascript
   // In browser console:
   window.vadServiceRef = vadServiceRef.current;
   vadServiceRef?.isReady(); // Should return true
   ```

**If VAD not running**:
- Model failed to load (check Network tab)
- ONNX Runtime error (check console errors)
- Try refreshing page

---

### Issue: Speech detection too sensitive (false positives)

**Console shows**: `Speech: YES` for background noise

**Fix**:
Edit [app/config/vad.ts:17](stonepot-restaurant-client/app/config/vad.ts#L17):
```typescript
threshold: 0.7,  // Increase from 0.5 to 0.7
```

Refresh page and test again.

---

### Issue: Speech detection not sensitive enough (missed speech)

**Console shows**: `Speech: NO` when you're speaking

**Fix**:
Edit [app/config/vad.ts:17](stonepot-restaurant-client/app/config/vad.ts#L17):
```typescript
threshold: 0.3,  // Decrease from 0.5 to 0.3
```

Refresh page and test again.

---

### Issue: Words getting cut off at end of sentence

**Last words are missing or clipped**

**Fix**:
1. Increase positive speech padding:
   Edit [app/config/vad.ts:38](stonepot-restaurant-client/app/config/vad.ts#L38):
   ```typescript
   positiveSpeechPad: 20,  // Increase from 10 to 20 (~640ms buffer)
   ```

2. OR increase silence duration:
   Edit [app/config/vad.ts:22](stonepot-restaurant-client/app/config/vad.ts#L22):
   ```typescript
   silenceDuration: 1000,  // Increase from 800ms to 1000ms
   ```

---

## 📈 Expected Results

### Before VAD (Baseline)
- **Audio sent to Gemini**: 100% of recording time
- **Cost**: ₹8-12/hour
- **False triggers**: Common (background noise)

### After VAD (Current)
- **Audio sent to Gemini**: 15-30% of recording time
- **Expected cost**: ₹2-3/hour
- **Savings**: 60-80%
- **False triggers**: Rare (<1%)

---

## 🔍 Manual Console Testing

### Check VAD State
```javascript
// In browser console during active session:

// 1. Check if VAD is ready
vadServiceRef?.current?.isReady()  // Should return true

// 2. Get current statistics
vadServiceRef?.current?.getStats()

// 3. Force log stats
vadServiceRef?.current?.logStats()

// 4. Reset statistics
vadServiceRef?.current?.resetStats()
```

### Monitor Audio Flow
```javascript
// Watch for audio being sent:
// Open console and filter logs by "Sent audio"
// Should ONLY appear when speaking
```

---

## ✅ Success Criteria

### Pass Criteria
- ✅ Silent room: <5% audio sent to Gemini
- ✅ Background noise: <10% audio sent
- ✅ Speech detected: Within 100ms of speaking
- ✅ Turn completion: ~800ms after speech ends
- ✅ Interruption: Works instantly
- ✅ Overall savings: >60%

### Fail Criteria
- ❌ Silence still sent to Gemini (>20%)
- ❌ Speech missed or delayed (>200ms)
- ❌ Words cut off frequently
- ❌ Savings <50%

---

## 🎯 Next Steps After Testing

### If Tests Pass:
1. **Mark todos complete** ✅
2. **Document final metrics** (savings %, accuracy)
3. **Deploy to production** (staging first)
4. **Monitor costs** in production for 1 week

### If Tests Fail:
1. **Note which test failed** and console errors
2. **Adjust configuration** (thresholds, timings)
3. **Re-test** with new config
4. **Report issues** if persistent

---

## 📝 Test Results Template

**Date**: ___________
**Tester**: ___________

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| Silent Room | ☐ Pass ☐ Fail | Savings: ___% |
| Background Noise | ☐ Pass ☐ Fail | False positives: ___% |
| Speech Detection | ☐ Pass ☐ Fail | Latency: ___ms |
| Mid-Sentence Pauses | ☐ Pass ☐ Fail | Words cut off: Yes/No |
| Interruption | ☐ Pass ☐ Fail | Works: Yes/No |

**Overall Savings**: ___%
**Recommendation**: ☐ Deploy ☐ Needs Tuning ☐ Needs Debugging

---

## 🔧 Configuration Reference

Key files:
- **Config**: [app/config/vad.ts](stonepot-restaurant-client/app/config/vad.ts)
- **Service**: [app/services/VADService.ts](stonepot-restaurant-client/app/services/VADService.ts)
- **Integration**: [app/page.tsx:565-634](stonepot-restaurant-client/app/page.tsx#L565-L634)
- **Model**: [public/models/silero_vad.onnx](stonepot-restaurant-client/public/models/silero_vad.onnx)

Tunable parameters:
- `threshold`: Speech probability (0-1) - Higher = less sensitive
- `silenceDuration`: ms of silence before turn complete
- `positiveSpeechPad`: Frames to send after speech ends
- `maxSilenceFrames`: Calculated from silenceDuration

---

**Ready to test!** 🚀

Open http://localhost:3000 and follow Test 1-5 above.
