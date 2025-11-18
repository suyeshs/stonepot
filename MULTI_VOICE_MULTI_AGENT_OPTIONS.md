# Multi-Voice Multi-Agent Conversation Options

**Version:** 1.0
**Date:** November 13, 2025
**Question:** Can we have different voices for different agents?

---

## Executive Summary

**YES, distinct voices for different agents are possible**, but Vertex AI Multimodal Live API does **NOT natively support multiple voices in a single session**. This document explores 5 viable approaches with their trade-offs in cost, latency, complexity, and voice quality.

---

## Problem: Voice Configuration Limitation

### Current Constraint

**Vertex AI Live API locks voice configuration at session creation:**

```javascript
// Voice is set once during session setup
const setupMessage = {
  setup: {
    generationConfig: {
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Kore'  // LOCKED for entire session
          }
        }
      }
    }
  }
};
```

**Key Limitations:**
- ❌ Voice **CANNOT** be changed mid-session
- ❌ Single voice configuration per session
- ❌ Audio responses contain NO voice metadata
- ❌ To change voice = close session + create new session (2-3s interruption)

### Available Voices (8 voices, Generally Available)

**Female Voices:**
- **Aoede** - Natural, clear
- **Kore** - Warm, friendly (currently used)
- **Leda** - Professional, articulate
- **Zephyr** - Energetic, approachable

**Male Voices:**
- **Puck** - Friendly, conversational
- **Charon** - Authoritative, deep
- **Fenrir** - Strong, confident
- **Orus** - Calm, measured

**All voices use Chirp 3 HD technology** with 31+ locale support.

---

## Solution Options

### Option 1: Single Voice + Verbal Cues (RECOMMENDED for MVP)

**Architecture:**
```
User Input → Single Vertex AI Session (Voice: Kore)
                ↓
          Function-based consultation
                ↓
     Backend agent modules communicate
                ↓
         Primary Agent synthesizes:
         "My colleague from schemes suggests..."
                ↓
        Single voice output (Kore)
```

**Implementation Status:** ✅ **Already 70% complete in your codebase**

**How It Sounds:**
```
User: "I need a loan and want to know about PM-KISAN"

AI (Kore voice):
"Great question! Let me quickly consult with our
government schemes specialist...

[Brief pause - 500ms]

My colleague confirms that PM-KISAN provides ₹6,000
per year for farmers. Combined with the Kisan Credit
Card loan I recommend at 4% interest, you'll have
both immediate funding and ongoing support.

The specialist also mentioned you can apply for both
simultaneously. Would you like help with applications?"
```

**Verbal Cues to Distinguish Agents:**
- "Let me bring in our specialist..."
- "My colleague from the schemes team says..."
- "According to our government programs advisor..."
- "The specialist confirms that..."
- "Back to the loan options I mentioned..."

**Cost Analysis:**
- Vertex AI Live: $0.25 per conversation
- Function consultation: +$0.007 per consultation
- **Total: $0.257 per conversation**
- **Monthly (10K conversations, 30% multi-agent): $2,521**

**Performance:**
- Latency: <200ms for consultation
- User experience: Natural, collaborative
- Voice quality: Excellent (Chirp 3 HD)

**Pros:**
- ✅ **Very low cost** (+0.84% increase)
- ✅ **No latency** overhead
- ✅ **Simple implementation** (already mostly built)
- ✅ **Natural synthesis** by Vertex AI
- ✅ **Scalable** to many agents

**Cons:**
- ❌ **Same voice** for all agents
- ❌ **Relies on verbal cues** for distinction
- ❌ **May confuse some users** initially

**User Experience Rating:** ⭐⭐⭐⭐☆ (4/5)
- Clear but voice distinction limited

---

### Option 2: Google Cloud TTS Multi-Speaker (NEW 2025)

**Architecture:**
```
User Input → Vertex AI Live (TEXT response mode)
                ↓
          Backend splits by agent
                ↓
    ┌───────────┴───────────────┐
    │                           │
    ↓                           ↓
Gemini-TTS Multi-Speaker Synthesis
Speaker 1: Kore (Primary Agent)
Speaker 2: Puck (Specialist Agent)
    │                           │
    └───────────┬───────────────┘
                ↓
        Single audio file
        (native multi-speaker)
                ↓
              User
```

**NEW CAPABILITY (2025):**
Google Cloud Text-to-Speech now supports **native multi-speaker dialogue generation**:
- **Maximum 2 speakers** per audio file
- **Seamless transitions** between voices
- **No manual audio mixing** required
- **Gemini-TTS** for advanced synthesis

**Implementation:**
```javascript
const textToSpeech = require('@google-cloud/text-to-speech');
const ttsClient = new textToSpeech.TextToSpeechClient();

// Configure Vertex AI for TEXT responses
const vertexConfig = {
  responseModalities: ['TEXT']  // Changed from ['AUDIO']
};

// Multi-speaker synthesis request
const request = {
  input: {
    multiSpeakerMarkup: {
      turns: [
        {
          speaker: 'primary_agent',
          text: 'For the loan, I recommend a Kisan Credit Card at 4% interest.'
        },
        {
          speaker: 'schemes_specialist',
          text: 'And PM-KISAN provides ₹6,000 per year for ongoing support.'
        },
        {
          speaker: 'primary_agent',
          text: 'Exactly! So you benefit from both immediate funding and long-term income.'
        }
      ]
    }
  },
  voice: {
    languageCode: 'en-IN',
    name: 'en-IN-Studio-MultiSpeaker'  // Multi-speaker voice
  },
  audioConfig: {
    audioEncoding: 'LINEAR16',
    sampleRateHertz: 16000
  }
};

const [response] = await ttsClient.synthesizeSpeech(request);
// response.audioContent contains seamless multi-speaker audio
```

**How It Sounds:**
```
User: "Tell me about loans and PM-KISAN"

AI (Kore voice - Primary Agent):
"For a farm loan, I recommend a Kisan Credit Card."

AI (Puck voice - Specialist Agent):
"And PM-KISAN gives you ₹6,000 annually."

AI (Kore voice - Primary Agent):
"Together, you get immediate funding plus ongoing support."
```

**Cost Analysis:**
- Vertex AI Live (text mode): $0.20 per conversation
- Google Cloud TTS: $16 per 1M characters (~$0.05 per conversation)
- **Total: $0.25 per conversation**
- **Monthly (10K conversations): $2,900 (+16% increase)**

**Performance:**
- Latency: ~1 second (text generation + TTS synthesis)
- Voice transitions: Seamless (native multi-speaker)
- Voice quality: Excellent (Studio voices)

**Pros:**
- ✅ **True distinct voices** (2 agents max)
- ✅ **Native multi-speaker support** (no manual mixing)
- ✅ **Professional quality** transitions
- ✅ **Moderate cost** increase (16%)
- ✅ **380+ voices** available for customization

**Cons:**
- ❌ **Higher latency** vs native audio streaming
- ❌ **Limited to 2 speakers** (can't expand to 3+ agents easily)
- ❌ **Lose Vertex AI Live's real-time streaming**
- ❌ **Additional TTS cost** ($16/million characters)

**User Experience Rating:** ⭐⭐⭐⭐⭐ (5/5)
- Clear voice distinction, professional quality

---

### Option 3: Multiple Parallel Vertex AI Sessions

**Architecture:**
```
User Input → Orchestrator (Backend)
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
Session 1               Session 2
Voice: Kore            Voice: Puck
(Primary Agent)        (Specialist)
    ↓                       ↓
    └───────────┬───────────┘
                ↓
        Audio Mixer (Backend)
                ↓
            User
```

**Implementation:**
```javascript
// Create 2 concurrent Vertex AI Live sessions
const primarySession = await vertexAIService.createSession(sessionId + '_primary', {
  language: 'en',
  voiceName: 'Kore',  // Female voice for primary
  userId: userId
});

const specialistSession = await vertexAIService.createSession(sessionId + '_specialist', {
  language: 'en',
  voiceName: 'Puck',  // Male voice for specialist
  userId: userId
});

// Route messages to appropriate session
if (currentAgent === 'primary') {
  primarySession.ws.send(userAudio);
} else if (currentAgent === 'specialist') {
  specialistSession.ws.send(userAudio);
}

// Mix audio responses
const mixedAudio = await audioMixer.mix([
  primarySession.audioStream,
  specialistSession.audioStream
]);
```

**Cost Analysis:**
- 2 concurrent Vertex AI Live sessions: $0.25 × 2 = $0.50 per conversation
- Audio mixing compute: ~$0.01 per conversation
- **Total: $0.51 per conversation (204% increase)**
- **Monthly (10K conversations): $5,100 (103% increase)**

**Performance:**
- Latency: Medium (~500ms for routing)
- Voice quality: Excellent (native Vertex AI)
- Audio mixing: Complex (synchronization required)

**Pros:**
- ✅ **True distinct voices** (unlimited agents)
- ✅ **Native Vertex AI quality**
- ✅ **Independent agent control**
- ✅ **Real-time streaming maintained**

**Cons:**
- ❌ **VERY expensive** (204% cost increase)
- ❌ **Complex audio mixing** (PCM buffer synchronization)
- ❌ **Resource intensive** (multiple WebSocket connections)
- ❌ **Difficult to scale** (N sessions for N agents)

**User Experience Rating:** ⭐⭐⭐⭐⭐ (5/5)
- Excellent voice distinction, but cost prohibitive

---

### Option 4: Separate Google Cloud TTS (Manual Mixing)

**Architecture:**
```
User Input → Vertex AI Live (TEXT responses)
                ↓
          Backend parses by agent
                ↓
    ┌───────────┴───────────────┐
    │                           │
    ↓                           ↓
TTS Voice 1: Kore          TTS Voice 2: Puck
    │                           │
    └───────────┬───────────────┘
                ↓
        Audio Concatenation
                ↓
              User
```

**Implementation:**
```javascript
// Parse agent-tagged response
const response = `
[@PRIMARY]: For loans, I recommend Kisan Credit Card.
[@SPECIALIST]: PM-KISAN provides ₹6,000 annually.
[@PRIMARY]: Both together give you complete funding.
`;

// Split by agent
const segments = [
  { agent: 'primary', text: 'For loans, I recommend...', voice: 'Kore' },
  { agent: 'specialist', text: 'PM-KISAN provides...', voice: 'Puck' },
  { agent: 'primary', text: 'Both together...', voice: 'Kore' }
];

// Synthesize each segment
const audioSegments = await Promise.all(
  segments.map(seg => ttsClient.synthesizeSpeech({
    input: { text: seg.text },
    voice: { name: `en-IN-Neural2-${seg.voice === 'Kore' ? 'D' : 'C'}` },
    audioConfig: { audioEncoding: 'LINEAR16' }
  }))
);

// Concatenate audio buffers
const finalAudio = concatenateAudioBuffers(audioSegments);
```

**Cost Analysis:**
- Vertex AI Live (text): $0.20 per conversation
- Google Cloud TTS: ~$0.08 per conversation
- Audio processing: ~$0.02 per conversation
- **Total: $0.30 per conversation (20% increase)**
- **Monthly (10K conversations): $3,000 (+20% increase)**

**Performance:**
- Latency: High (~1.5 seconds)
- Voice transitions: May have glitches at segment boundaries
- Voice quality: Very good (Neural2 voices)

**Pros:**
- ✅ **Distinct voices** (2+ agents)
- ✅ **Full control** over voice selection
- ✅ **Moderate cost** increase (20%)
- ✅ **Scalable** to many agents

**Cons:**
- ❌ **Manual audio mixing** required
- ❌ **Potential audio glitches** at boundaries
- ❌ **Higher latency** than streaming
- ❌ **Complex parsing logic** for agent tags

**User Experience Rating:** ⭐⭐⭐⭐☆ (4/5)
- Good voice distinction, but audio quality issues possible

---

### Option 5: Session Recreation on Agent Switch

**Architecture:**
```
User Input → Primary Agent (Session 1, Voice: Kore)
                ↓
      [Specialist needed detected]
                ↓
         Close Session 1
                ↓
      Create Session 2 (Voice: Puck)
                ↓
      Specialist responds
                ↓
      [User switches back to primary topic]
                ↓
         Close Session 2
                ↓
      Create Session 1 (Voice: Kore)
```

**Implementation:**
```javascript
async switchAgentWithVoice(sessionId, newAgent) {
  const session = this.activeSessions.get(sessionId);

  // Announce handoff
  await this.sendMessage(session, "One moment while I connect you with our specialist...");

  // Save context
  const context = session.conversationHistory.slice(-5);

  // Close current session
  await this.closeSession(sessionId);

  // Create new session with different voice
  const newVoice = newAgent === 'specialist' ? 'Puck' : 'Kore';
  const newSession = await this.createSession(sessionId, {
    voiceName: newVoice,
    userId: session.userId,
    language: session.language,
    previousContext: context
  });

  return newSession;
}
```

**Cost Analysis:**
- Session recreation overhead: ~$0.05 per switch
- Average 2 switches per conversation: $0.10
- Base conversation: $0.25
- **Total: $0.35 per conversation (40% increase)**
- **Monthly (10K conversations): $3,500 (+40% increase)**

**Performance:**
- Latency: **VERY HIGH** (2-3 seconds per switch)
- User interruption: Noticeable pause
- Voice quality: Excellent (native Vertex AI)

**Pros:**
- ✅ **True distinct voices**
- ✅ **Native Vertex AI quality**
- ✅ **Clean agent separation**
- ✅ **Unlimited agents** possible

**Cons:**
- ❌ **VERY noticeable latency** (2-3 seconds per switch)
- ❌ **User interruption** (jarring experience)
- ❌ **Moderate cost** increase (40%)
- ❌ **Context transfer complexity**

**User Experience Rating:** ⭐⭐☆☆☆ (2/5)
- Voice distinction excellent, but UX is poor due to interruptions

---

## Comparison Matrix

| Option | Cost/Conv | Monthly (10K) | Latency | Voices | Complexity | UX Rating |
|--------|-----------|---------------|---------|--------|------------|-----------|
| **1. Single Voice + Cues** | $0.257 | $2,521 (+0.84%) | <200ms | Same | Low | ⭐⭐⭐⭐ |
| **2. Gemini-TTS Multi-Speaker** | $0.25 | $2,900 (+16%) | ~1s | **Distinct (2)** | Medium | ⭐⭐⭐⭐⭐ |
| **3. Parallel Sessions** | $0.51 | $5,100 (+103%) | ~500ms | **Distinct (N)** | Very High | ⭐⭐⭐⭐⭐ |
| **4. Separate TTS** | $0.30 | $3,000 (+20%) | ~1.5s | **Distinct (N)** | High | ⭐⭐⭐⭐ |
| **5. Session Recreation** | $0.35 | $3,500 (+40%) | **2-3s** | **Distinct (N)** | Medium | ⭐⭐ |

**Cost Baseline:** $2,500/month for 10K conversations (current single-agent)

---

## Recommended Implementation Path

### Phase 1: MVP - Single Voice + Enhanced Verbal Cues (IMMEDIATE)

**Timeline:** 1-2 weeks
**Cost Impact:** +0.84% (+$21/month)
**Status:** 70% complete (architecture exists)

**What to Build:**
1. ✅ Function-based agent consultation (already implemented)
2. ✅ Context injection for specialist activation (already implemented)
3. 🔧 **Enhanced verbal cues** in system prompts (needs improvement)
4. 🔧 **Agent identity tracking** in responses (new)
5. 🔧 **User feedback mechanism** (new)

**Enhanced System Prompt Example:**
```javascript
systemInstruction: `
You are the Primary Financial Advisor. When you need specialist input:

CONSULTATION PATTERN:
"Let me quickly consult with our [specialist type] who has detailed
expertise in this area..."

[After receiving specialist input]

"My colleague from the [schemes team / fraud department] confirms that
[specialist information]. Based on that and my financial analysis,
I recommend [synthesis]..."

VERBAL CUES FOR AGENT DISTINCTION:
- "According to our government schemes specialist..."
- "The fraud analyst on our team suggests..."
- "My colleague who specializes in insurance advises..."
- "Working together with the schemes expert, here's what we recommend..."

Always make it clear when you're presenting information from a specialist
versus your own financial advice.
`;
```

**Success Metrics:**
- User satisfaction: >4.2/5
- Voice distinction confusion: <15% of users
- Cost per conversation: <$0.26

### Phase 2: User Validation & Data Collection (3 MONTHS)

**Actions:**
1. Deploy Phase 1 to production
2. Collect user feedback on voice distinction needs
3. A/B test different verbal cue patterns
4. Measure satisfaction scores
5. Analyze conversation patterns

**Key Questions:**
- Do users understand multiple agents are involved?
- Do users request distinct voices?
- Is satisfaction impacted by same-voice limitation?

**Decision Criteria for Phase 3:**
- If >40% of users request distinct voices → Proceed to Phase 3
- If satisfaction remains >4.2/5 → Stay with Phase 1
- If <40% request distinct voices → Enhance verbal cues further

### Phase 3: Distinct Voices - Gemini-TTS Multi-Speaker (IF NEEDED)

**Timeline:** 2-3 weeks development
**Cost Impact:** +16% (+$400/month)
**Trigger:** User demand + budget approval

**What to Build:**
1. Switch Vertex AI to `responseModalities: ['TEXT']`
2. Integrate Google Cloud TTS Multi-Speaker API
3. Implement agent-to-speaker mapping
4. Create multi-speaker dialogue formatting
5. Optimize latency (target <1 second)

**Implementation:**
```javascript
// src/services/MultiSpeakerSynthesizer.js
class MultiSpeakerSynthesizer {
  async synthesizeDialogue(agentResponses) {
    const turns = agentResponses.map(response => ({
      speaker: response.agent === 'primary' ? 'primary_agent' : 'specialist_agent',
      text: response.text
    }));

    const request = {
      input: { multiSpeakerMarkup: { turns } },
      voice: { languageCode: 'en-IN', name: 'en-IN-Studio-MultiSpeaker' },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 16000 }
    };

    const [response] = await this.ttsClient.synthesizeSpeech(request);
    return response.audioContent;
  }
}
```

**Success Metrics:**
- Voice distinction clarity: 100% (distinct voices)
- Latency: <1 second
- User satisfaction: >4.7/5
- Cost per conversation: <$0.26

---

## Voice Pairing Recommendations

### For 2-Agent System (Primary + Specialist)

**Option A: Female Primary + Male Specialist (RECOMMENDED)**
- **Primary Agent:** Kore (Female, warm, friendly)
- **Specialist Agent:** Puck (Male, conversational)
- **Rationale:** Clear gender distinction, balanced team feel

**Option B: Contrasting Female Voices**
- **Primary Agent:** Kore (Female, warm)
- **Specialist Agent:** Aoede (Female, clear, slightly higher pitch)
- **Rationale:** Both professional, subtle distinction

**Option C: Contrasting Male Voices**
- **Primary Agent:** Puck (Male, friendly)
- **Specialist Agent:** Charon (Male, authoritative)
- **Rationale:** Tonal distinction (friendly vs authoritative)

**Option D: Female Primary + Authoritative Male Specialist**
- **Primary Agent:** Leda (Female, professional)
- **Specialist Agent:** Charon (Male, deep, authoritative)
- **Rationale:** Specialist sounds more expert/authoritative

### For 3+ Agent System (Future)

If expanding beyond 2 agents, consider:
- **Primary Agent:** Kore (Female, warm)
- **Schemes Specialist:** Puck (Male, friendly)
- **Fraud Analyst:** Charon (Male, authoritative)
- **Insurance Expert:** Aoede (Female, clear)

**Note:** Multi-session or Separate TTS required for 3+ distinct voices (Gemini-TTS limited to 2).

---

## Cost-Benefit Analysis

### Investment vs User Value

**Single Voice Approach:**
- **Investment:** Minimal (1-2 weeks dev, +$21/month)
- **User Value:** Good (clear agent collaboration, 4/5 rating)
- **ROI:** Excellent (low cost, quick implementation)

**Gemini-TTS Multi-Speaker:**
- **Investment:** Moderate (2-3 weeks dev, +$400/month)
- **User Value:** Excellent (distinct voices, 5/5 rating)
- **ROI:** Good (if user demand exists)

**Parallel Sessions:**
- **Investment:** Very High (4-6 weeks dev, +$2,600/month)
- **User Value:** Excellent (unlimited distinct voices)
- **ROI:** Poor (cost prohibitive for most use cases)

### Break-Even Analysis

**Gemini-TTS Multi-Speaker Investment:**
- Additional cost: $400/month
- Development: 2 weeks (~$8,000 if 1 developer @ $50/hr)
- Total first-year cost: $400 × 12 + $8,000 = $12,800

**Required to Break Even:**
- Need user satisfaction increase to justify cost
- If higher satisfaction → better retention → more users
- Estimated: Need ~5% user growth to break even

**Conclusion:** Gemini-TTS is viable if voice distinction is important to users.

---

## Technical Implementation Notes

### Audio Format Compatibility

**Vertex AI Live Audio Output:**
- Format: PCM (Linear16)
- Sample Rate: 24000 Hz
- Bit Depth: 16-bit
- Channels: Mono

**Google Cloud TTS Output:**
- Format: LINEAR16 (compatible)
- Sample Rate: Configurable (recommend 16000 Hz for efficiency)
- Bit Depth: 16-bit
- Channels: Mono

**Audio Mixing Requirements:**
- Sample rate conversion may be needed (24kHz → 16kHz or vice versa)
- Buffer alignment for seamless concatenation
- Fade in/out at boundaries to prevent clicks

### Latency Optimization

**Gemini-TTS Optimization Techniques:**
1. **Streaming TTS:** Use bidirectional streaming for faster response
2. **Text Chunking:** Send text in smaller chunks as available
3. **Pre-synthesis:** Pre-generate common phrases per agent
4. **Caching:** Cache synthesized audio for repeated phrases
5. **Parallel Processing:** Synthesize multiple agent segments concurrently

**Target Latencies:**
- Single voice + cues: <200ms ✅
- Gemini-TTS: <1 second (achievable with optimization)
- Parallel sessions: ~500ms (with good orchestration)
- Session recreation: 2-3 seconds (inherent limitation)

---

## FAQ

### Q1: Can we have 3+ distinct voices?

**Answer:** YES, but requires either:
- **Option 3: Multiple Parallel Sessions** (very expensive)
- **Option 4: Separate TTS with Manual Mixing** (complex)

Gemini-TTS is limited to 2 speakers, so not suitable for 3+ agents.

### Q2: Can users choose agent voices?

**Answer:** YES, technically possible:
- Store voice preferences per tenant in Firestore
- Configure voice in session creation
- Allow admin panel voice selection

**Limitation:** Still bound by 2-speaker limit if using Gemini-TTS.

### Q3: Can we use different languages for different agents?

**Answer:** YES, Vertex AI Live supports 20+ languages:
- Primary Agent: English (en-IN)
- Specialist Agent: Hindi (hi-IN)

**Note:** Voice availability varies by language. Requires multi-session or TTS approach.

### Q4: What about emotional voice modulation?

**Answer:** NOT AVAILABLE in Vertex AI Live or standard TTS.

**Alternatives:**
- Use verbal cues for emotion ("I'm excited to share...", "Unfortunately...")
- Select voices that match agent personality (authoritative vs friendly)
- Wait for future API updates with emotional synthesis

### Q5: Can we preview different voice combinations?

**Answer:** YES, implement a voice preview feature:
```javascript
async previewVoicePair(primaryVoice, specialistVoice) {
  const sampleDialogue = [
    { agent: 'primary', text: 'Hello, I can help with loans and banking.' },
    { agent: 'specialist', text: 'And I specialize in government schemes.' }
  ];

  const audio = await this.synthesizeWithGeminiTTS(sampleDialogue, {
    primaryVoice,
    specialistVoice
  });

  return audio;
}
```

---

## Summary & Recommendation

### Immediate Action: **Option 1 - Single Voice + Enhanced Verbal Cues**

**Why:**
1. ✅ **Already 70% implemented** in your codebase
2. ✅ **Minimal cost** (+0.84% = $21/month)
3. ✅ **Fast deployment** (1-2 weeks)
4. ✅ **Low risk** (simple enhancement)
5. ✅ **Good user experience** (4/5 rating)

### Future Enhancement: **Option 2 - Gemini-TTS Multi-Speaker**

**When:** After 3 months of user feedback
**Condition:** If >40% of users request distinct voices
**Investment:** +16% cost ($400/month) + 2-3 weeks dev
**Benefit:** Excellent UX (5/5 rating) with distinct voices

### NOT Recommended:
- ❌ **Option 3 (Parallel Sessions):** Too expensive (103% cost increase)
- ❌ **Option 5 (Session Recreation):** Poor UX (2-3 second interruptions)

---

## Next Steps

1. **Approve Phase 1 approach** (single voice with enhanced cues)
2. **Implement enhanced verbal cues** in system prompts
3. **Deploy and collect user feedback** for 3 months
4. **Evaluate user demand** for distinct voices
5. **Budget planning** for potential Gemini-TTS upgrade
6. **Decision point:** Implement distinct voices if user data supports it

**Ready to proceed with Phase 1?**
