# Multi-Agent Three-Way Communication Architecture

**Version:** 2.0 (Enhanced)
**Date:** November 13, 2025
**Enhancement:** True Agent-to-Agent Communication

---

## Problem Statement

The initial architecture (v1.0) enables **sequential agent responses**:
```
User → Primary Agent → Specialist Agent → User
```

But we need **true three-way communication** where:
```
        User
       ↗  ↓  ↖
Primary ←→ Specialist
```

**Requirements:**
1. ✅ User can talk to both agents
2. ✅ Primary Agent can consult Specialist Agent
3. ✅ Specialist Agent can consult Primary Agent
4. ✅ Agents can exchange information before responding to user
5. ✅ Natural conversational flow (not robotic handoffs)
6. ✅ Cost-effective (not 3x the cost)
7. ✅ Low latency (<1 second per turn)

---

## Architecture: Orchestrated Three-Way Dialogue

### Core Concept

**Backend Orchestrator** acts as a "conversation director" that:
1. Receives user input
2. Determines which agents should respond
3. Enables agents to consult each other via function calls
4. Synthesizes agent dialogue into natural conversation
5. Presents unified response to user

### Message Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    User Input (Audio)                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│              Conversation Orchestrator                        │
│  • Analyzes user input                                        │
│  • Determines which agents should participate                 │
│  • Manages agent dialogue sequence                            │
└────────────────────┬─────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────▼─────┐   ┌────▼─────┐   ┌────▼─────┐
│ Primary  │   │Specialist│   │  Vertex  │
│  Agent   │◄─►│  Agent   │   │ AI Live  │
│ (Logic)  │   │ (Logic)  │   │ (Voice)  │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│            Response Synthesizer                               │
│  • Combines agent responses                                   │
│  • Formats as natural dialogue                                │
│  • Sends to Vertex AI for voice synthesis                     │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│                User Output (Audio)                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Approach

### Option A: Backend Agent Dialogue with Vertex AI for Voice (RECOMMENDED)

**Architecture:**

```javascript
// Agents are backend logic modules, not separate Vertex AI sessions
// Vertex AI Live is used ONLY for voice synthesis and user interaction

┌─────────────────────────────────────────────────────┐
│  Single Vertex AI Live Session (Voice Interface)    │
│  • Receives user audio                              │
│  • Sends voice responses                            │
│  • System instruction: "You are a conversational    │
│    interface for multiple financial experts"        │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│       Conversation Orchestrator (Backend)           │
│  • Routes messages to agent logic                   │
│  • Manages agent consultation                       │
│  • Formats responses                                │
└──────────────────┬──────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
┌──────▼──────┐        ┌──────▼──────┐
│Primary Agent│        │ Specialist  │
│   Module    │◄──────►│    Module   │
│             │consult │             │
└─────────────┘        └─────────────┘
```

**How It Works:**

1. **User Input Processing:**
   ```javascript
   User: "I'm a farmer needing a loan. Should I apply for PM-KISAN too?"

   Orchestrator analyzes:
   - Topics: ["loans", "government_scheme"]
   - Detected agents: ["primary", "government_schemes_specialist"]
   - Consultation needed: true (both topics present)
   ```

2. **Agent Consultation (Backend):**
   ```javascript
   // Step 1: Primary Agent processes loan aspect
   const primaryResponse = await primaryAgent.process({
     userInput: "I'm a farmer needing a loan...",
     context: session.conversationHistory,
     consultSpecialist: true,
     specialistType: "government_schemes_specialist"
   });

   // Primary Agent decides to consult specialist
   primaryResponse.needsConsultation = true;
   primaryResponse.consultationQuery = "What are PM-KISAN benefits for a farmer?";

   // Step 2: Specialist Agent processes consultation
   const specialistResponse = await specialistAgent.process({
     consultationFrom: "primary",
     query: primaryResponse.consultationQuery,
     userContext: "Farmer needing loan"
   });

   // Step 3: Primary Agent synthesizes final response
   const finalResponse = await primaryAgent.synthesize({
     ownResponse: primaryResponse.text,
     specialistInput: specialistResponse.text,
     userQuery: "I'm a farmer needing a loan. Should I apply for PM-KISAN too?"
   });
   ```

3. **Response Formatting (Natural Dialogue):**
   ```javascript
   // Backend formats as multi-speaker dialogue
   const dialogue = `
   [Primary Agent]: "Great question! As a farmer, you have options for both financial support.
   Let me break this down with help from our schemes specialist.

   For the loan aspect, a Kisan Credit Card would be ideal with interest rates as low as 4%
   after government subsidy. You can get up to ₹3 lakh for farm equipment and inputs.

   [Schemes Specialist]: "And regarding PM-KISAN, yes, you're likely eligible!
   PM-KISAN provides ₹6,000 per year in direct income support to farmer families.
   You can receive this WHILE also taking a loan - they're complementary benefits.

   [Primary Agent]: "Exactly! So I'd recommend both:
   1. Apply for the Kisan Credit Card for immediate funding needs
   2. Register for PM-KISAN for ongoing income support

   Would you like help with the application process for either?"
   `;

   // Send to Vertex AI for voice synthesis
   await vertexSession.sendTextForSynthesis(dialogue);
   ```

4. **Voice Output:**
   - Vertex AI synthesizes the entire dialogue as one voice
   - Optional: Add verbal cues like "My colleague suggests..." to distinguish speakers
   - User hears natural, collaborative response

**Pros:**
- ✅ True agent consultation (agents exchange info in backend)
- ✅ Cost-effective (single Vertex AI session)
- ✅ Low latency (backend consultation is fast, <500ms)
- ✅ Natural dialogue (formatted explicitly)
- ✅ Full control over agent logic
- ✅ Easy to add more agents

**Cons:**
- ❌ Single voice (all agents sound the same)
- ❌ Backend complexity (need agent logic modules)
- ❌ Not real-time agent streaming (consultation happens first)

---

### Option B: Multi-Turn Context Injection (Real-Time Dialogue)

**Architecture:**

```javascript
// Use Vertex AI Live's multi-turn capability to simulate agent dialogue

User → Vertex AI (with agent instructions)
    ↓
Vertex AI generates Primary Agent response
    ↓
Backend injects "Specialist Agent" turn via clientContent
    ↓
Vertex AI continues as Specialist
    ↓
Backend injects "Primary Agent" turn
    ↓
Vertex AI synthesizes and responds to user
```

**How It Works:**

1. **User Input:**
   ```javascript
   User: "I'm a farmer needing a loan. Should I apply for PM-KISAN too?"
   ```

2. **Primary Agent Response (Vertex AI):**
   ```javascript
   // Vertex AI responds as Primary Agent (configured in system instruction)
   AI: "That's a great question involving both loans and government schemes.
        Let me consult with our schemes specialist about PM-KISAN eligibility."

   // Function call:
   {
     name: "consult_specialist",
     args: {
       specialist: "government_schemes_specialist",
       query: "Is a farmer eligible for PM-KISAN? What are the benefits?"
     }
   }
   ```

3. **Backend Injects Specialist Response:**
   ```javascript
   // Backend sends specialist context as model turn
   const specialistTurn = {
     clientContent: {
       turns: [{
         role: 'model',
         parts: [{
           text: `[Government Schemes Specialist responding to Primary Agent]:

           Yes, farmers who own agricultural land are eligible for PM-KISAN.
           The scheme provides ₹6,000 per year in three installments directly to
           bank accounts. This is separate from loans, so they can receive both
           benefits simultaneously. The farmer just needs an Aadhaar card and
           land ownership documents to register.

           [Specialist to Primary Agent]: You can now explain loan options along
           with this PM-KISAN information to the user.`
         }]
       }],
       turnComplete: true
     }
   };

   vertexSession.ws.send(JSON.stringify(specialistTurn));
   ```

4. **Primary Agent Synthesizes (Vertex AI):**
   ```javascript
   // Vertex AI continues, now with specialist input
   AI: "Thank you, Specialist! So here's the complete picture:

        For the loan, I recommend a Kisan Credit Card with subsidized 4% interest
        rates. You can borrow up to ₹3 lakh for equipment and inputs.

        AND as my colleague mentioned, you're eligible for PM-KISAN which gives
        ₹6,000 per year. You can have both benefits at the same time!

        Would you like to start with the loan application or PM-KISAN registration?"
   ```

**Message Sequence:**
```
1. User audio → Vertex AI
2. AI (as Primary): "Let me consult specialist..." [Function call]
3. Backend: Inject specialist response as model turn
4. AI (as Primary): "Thank you! Based on that info..." [Final response]
5. User hears complete response
```

**Pros:**
- ✅ Uses Vertex AI's native capabilities
- ✅ True multi-turn dialogue
- ✅ AI synthesizes naturally
- ✅ Single session (cost-effective)

**Cons:**
- ❌ Specialist logic still in system instruction (not separate)
- ❌ Harder to maintain distinct agent personalities
- ❌ Context bleeding between agent roles

---

### Option C: Function-Based Agent Communication (MOST PRACTICAL)

**Architecture:**

```javascript
// Agents communicate via function calls
// Backend handles agent logic
// Vertex AI handles voice interface

Primary Agent (Vertex AI) → Function: consult_specialist()
                                ↓
                        Backend Agent Logic
                                ↓
                     Specialist Agent Module
                                ↓
                     Return specialist response
                                ↓
          Vertex AI synthesizes combined response
```

**Implementation:**

1. **New Function: `consult_specialist`**

```javascript
// In SharedFunctionSchema.js
{
  name: "consult_specialist",
  description: "Consult with a specialist agent for expert information on specific topics",
  parameters: {
    type: "object",
    properties: {
      specialist_type: {
        type: "string",
        enum: ["government_schemes_specialist", "fraud_analyst", "insurance_expert"],
        description: "Which specialist to consult"
      },
      consultation_query: {
        type: "string",
        description: "Specific question to ask the specialist"
      },
      user_context: {
        type: "string",
        description: "Relevant user information for the specialist"
      },
      reason: {
        type: "string",
        description: "Why you need specialist input"
      }
    },
    required: ["specialist_type", "consultation_query"]
  }
}
```

2. **Backend Agent Modules:**

```javascript
// src/agents/PrimaryAgent.js
class PrimaryAgent {
  async processUserQuery(query, session) {
    // Analyze query
    const topics = this.detectTopics(query);

    // Determine if consultation needed
    if (topics.includes('government_scheme') && topics.includes('loans')) {
      return {
        needsConsultation: true,
        consultationRequest: {
          specialist_type: "government_schemes_specialist",
          consultation_query: "What government schemes are available for farmers needing loans?",
          user_context: query
        }
      };
    }

    return {
      needsConsultation: false,
      response: this.generateResponse(query, session)
    };
  }

  async synthesizeWithSpecialistInput(userQuery, specialistResponse) {
    // Combine own knowledge with specialist input
    return `Based on the loan options I can offer and the government schemes
            my colleague mentioned, here's my recommendation: ${specialistResponse}...`;
  }
}

// src/agents/GovernmentSchemesSpecialist.js
class GovernmentSchemesSpecialist {
  async respondToConsultation(consultationRequest) {
    const { consultation_query, user_context } = consultationRequest;

    // Process consultation query
    const schemeInfo = await this.getSchemeInformation(consultation_query);

    // Return specialist response
    return {
      schemes: schemeInfo,
      recommendation: "The farmer should apply for PM-KISAN...",
      eligibility: "Likely eligible based on...",
      responseText: "PM-KISAN provides ₹6,000 annually. Combined with a
                     Kisan Credit Card loan, this gives both immediate funding
                     and ongoing support."
    };
  }
}
```

3. **Orchestrator Handles Function Call:**

```javascript
// In VertexAILiveService.js
async handleFunctionCall(session, functionCall) {
  if (functionCall.name === 'consult_specialist') {
    const { specialist_type, consultation_query, user_context } = functionCall.args;

    // Get specialist module
    const specialist = this.getSpecialistModule(specialist_type);

    // Specialist processes consultation
    const specialistResponse = await specialist.respondToConsultation({
      consultation_query,
      user_context,
      session
    });

    // Return to Vertex AI for synthesis
    return {
      toolResponse: {
        functionResponses: [{
          id: functionCall.id,
          name: functionCall.name,
          response: {
            specialist_says: specialistResponse.responseText,
            detailed_info: specialistResponse,
            synthesis_instruction: "Incorporate this specialist information
                                    naturally into your response to the user.
                                    Acknowledge the specialist's input."
          }
        }]
      }
    };
  }
}
```

4. **Vertex AI Synthesizes:**

```javascript
// Vertex AI receives function response and generates final response
AI: "I consulted with our government schemes specialist, and here's what we recommend:

     For your farming needs, I can arrange a Kisan Credit Card with 4% interest
     (after subsidy) for up to ₹3 lakh.

     Additionally, my colleague confirmed you're eligible for PM-KISAN, which
     provides ₹6,000 per year in direct income support. This is separate from
     the loan, so you benefit from both!

     The specialist suggests applying for PM-KISAN first (takes 2-3 weeks),
     while we process your Kisan Credit Card application simultaneously.

     Would you like me to guide you through both applications?"
```

**Flow Visualization:**

```
User: "I'm a farmer needing a loan and want to know about PM-KISAN"
  ↓
Primary Agent (Vertex AI): Detects two topics
  ↓
Function Call: consult_specialist("government_schemes_specialist", "PM-KISAN info")
  ↓
Backend → Government Schemes Specialist Module
  ↓
Specialist Response: "PM-KISAN provides ₹6,000/year, eligible if owns land..."
  ↓
Function Response → Vertex AI
  ↓
Primary Agent synthesizes: "My colleague says PM-KISAN... Combined with the loan I recommend..."
  ↓
User hears natural, collaborative response
```

**Pros:**
- ✅ True agent consultation (backend agents communicate)
- ✅ Natural synthesis by Vertex AI
- ✅ Cost-effective (single session + function calls)
- ✅ Low latency (~500ms for backend consultation)
- ✅ Clean separation of agent logic
- ✅ Scales to multiple specialists
- ✅ Agents remain "in character" via synthesis instruction

**Cons:**
- ❌ Single voice (limitation of Vertex AI Live)
- ❌ Backend complexity (need agent modules)

---

## Recommended Architecture: Hybrid Approach

**Combine Context Injection + Function-Based Consultation**

### When to Use Each Method:

1. **Function-Based Consultation** (for quick info exchange):
   - Primary agent needs specific information from specialist
   - Specialist doesn't need to "join" the conversation long-term
   - Example: "What's the PM-KISAN eligibility criteria?"

2. **Context Injection** (for sustained specialist participation):
   - Specialist needs to handle multiple follow-up questions
   - User wants to dive deep into specialist topic
   - Example: User asks 5+ questions about government schemes

### Implementation:

```javascript
class AgentOrchestrator {
  async handleUserMessage(userInput, session) {
    // Analyze user input
    const analysis = await this.analyzeInput(userInput, session);

    if (analysis.needsSpecialistConsultation) {
      // Quick consultation via function call
      return await this.consultSpecialistViaFunction(analysis);

    } else if (analysis.needsSpecialistActivation) {
      // Long-term specialist participation via context injection
      return await this.activateSpecialistAgent(analysis);

    } else {
      // Primary agent handles directly
      return await this.primaryAgentResponse(analysis);
    }
  }

  async consultSpecialistViaFunction(analysis) {
    // Backend agent consultation
    const specialistModule = this.getSpecialistModule(analysis.specialistType);
    const specialistResponse = await specialistModule.consult(analysis.query);

    // Return function response for Vertex AI to synthesize
    return {
      type: 'function_response',
      specialist_input: specialistResponse,
      synthesis_mode: 'collaborative'
    };
  }

  async activateSpecialistAgent(analysis) {
    // Context injection for sustained specialist participation
    const contextMessage = this.buildSpecialistContext(analysis);

    // Inject into Vertex AI session
    session.ws.send(JSON.stringify(contextMessage));

    // Mark specialist as active
    session.activeAgents.push(analysis.specialistType);

    return { type: 'specialist_activated' };
  }
}
```

---

## Example Conversation Flow

### Scenario: Farmer Needs Loan + Scheme Info

**Turn 1: User asks about both topics**

```
User: "I'm a farmer. I need ₹2 lakh for equipment. Should I get a loan or is there a government scheme?"

Primary Agent (Vertex AI):
  - Detects: topics = ["loans", "government_scheme"]
  - Function call: consult_specialist()

Backend:
  - Routes to Government Schemes Specialist module
  - Specialist returns: "PM-KISAN provides ₹6K/year, not enough for ₹2L equipment.
                         Recommend loan PLUS PM-KISAN for ongoing support."

Primary Agent (synthesizes):
  "Great question! I consulted with our schemes specialist. Here's what we recommend:

   For ₹2 lakh equipment purchase, you'll need a loan since government schemes
   like PM-KISAN provide smaller annual amounts (₹6,000/year).

   However, my colleague suggests you should BOTH:
   1. Take a Kisan Credit Card loan at 4% interest for the equipment
   2. Register for PM-KISAN for ongoing ₹6,000 annual support

   This gives you immediate funding plus long-term income support.
   Shall we start with the loan application?"
```

**Turn 2: User wants more scheme details**

```
User: "Tell me more about PM-KISAN. Am I eligible?"

Primary Agent:
  - Detects: Deep dive into government schemes
  - Function call: activate_specialist()

Backend:
  - Injects Government Schemes Specialist context
  - Specialist becomes active participant

Specialist (via context injection):
  "Hello! I'm taking over the scheme discussion. Let me check your PM-KISAN eligibility.

   Are you the owner of agricultural land, or do you work on someone else's farm?"

[Specialist now handles follow-up questions about schemes]
```

**Turn 3: User switches back to loan**

```
User: "Ok, I'm eligible for PM-KISAN. Now let's talk about the loan."

Specialist:
  - Detects: Off-topic (loans)
  - Function call: handback_to_primary()

Backend:
  - Deactivates specialist
  - Primary agent resumes

Primary Agent:
  "Perfect! Now let's discuss the Kisan Credit Card loan.
   You can get up to ₹3 lakh at 4% interest after subsidy..."
```

---

## Code Architecture

### New Agent Communication Protocol

```typescript
// src/types/AgentCommunication.ts

interface AgentConsultationRequest {
  from: 'primary' | 'specialist' | 'user';
  to: 'primary' | 'specialist';
  consultationType: 'quick_query' | 'extended_dialogue' | 'handoff';
  query: string;
  context: {
    userInput: string;
    conversationHistory: Message[];
    userProfile: UserProfile;
  };
}

interface AgentConsultationResponse {
  from: 'primary' | 'specialist';
  to: 'primary' | 'user';
  responseType: 'information' | 'recommendation' | 'action_required';
  content: {
    text: string;
    structuredData?: any;
    confidenceLevel: number;
    suggestedFollowUp?: string;
  };
  synthesisInstruction?: string;
}

interface AgentDialogue {
  participants: string[];  // ['primary', 'government_schemes_specialist']
  turns: {
    speaker: string;
    message: string;
    timestamp: string;
    messageType: 'consultation' | 'response' | 'synthesis';
  }[];
  finalResponse: string;
}
```

### Enhanced AgentOrchestrator

```javascript
// src/services/AgentOrchestrator.js (v2.0)

class AgentOrchestrator {
  constructor() {
    this.primaryAgent = new PrimaryAgentModule();
    this.specialists = {
      government_schemes_specialist: new GovernmentSchemesSpecialistModule(),
      fraud_analyst: new FraudAnalystModule(),
      insurance_expert: new InsuranceExpertModule()
    };
  }

  /**
   * Orchestrate agent-to-agent consultation
   */
  async orchestrateConsultation(request) {
    const { from, to, query, context } = request;

    // Log consultation
    logger.info('[Orchestrator] Agent consultation', {
      from,
      to,
      query: query.substring(0, 50)
    });

    // Route to target agent
    const targetAgent = to === 'specialist'
      ? this.specialists[request.specialistType]
      : this.primaryAgent;

    // Agent processes consultation
    const response = await targetAgent.processConsultation({
      query,
      context,
      requestingAgent: from
    });

    // Return structured response
    return {
      from: to,
      to: from,
      content: response,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Orchestrate three-way dialogue
   */
  async orchestrateThreeWayDialogue(userInput, session) {
    const dialogue = {
      participants: ['user', 'primary'],
      turns: [],
      finalResponse: null
    };

    // Step 1: Primary agent analyzes user input
    const primaryAnalysis = await this.primaryAgent.analyze(userInput, session);

    dialogue.turns.push({
      speaker: 'primary',
      message: '[Internal] Analyzing user query...',
      timestamp: new Date().toISOString(),
      messageType: 'analysis'
    });

    // Step 2: If consultation needed, consult specialist
    if (primaryAnalysis.needsConsultation) {
      dialogue.participants.push(primaryAnalysis.specialistType);

      // Primary consults specialist
      const consultation = await this.orchestrateConsultation({
        from: 'primary',
        to: 'specialist',
        specialistType: primaryAnalysis.specialistType,
        query: primaryAnalysis.consultationQuery,
        context: { userInput, session }
      });

      dialogue.turns.push({
        speaker: 'primary',
        message: `[To Specialist] ${consultation.query}`,
        timestamp: new Date().toISOString(),
        messageType: 'consultation'
      });

      dialogue.turns.push({
        speaker: primaryAnalysis.specialistType,
        message: consultation.content.text,
        timestamp: new Date().toISOString(),
        messageType: 'response'
      });

      // Step 3: Primary synthesizes with specialist input
      const synthesis = await this.primaryAgent.synthesize({
        userInput,
        ownAnalysis: primaryAnalysis,
        specialistInput: consultation.content
      });

      dialogue.finalResponse = synthesis.text;

      dialogue.turns.push({
        speaker: 'primary',
        message: synthesis.text,
        timestamp: new Date().toISOString(),
        messageType: 'synthesis'
      });
    } else {
      // Primary handles directly
      const response = await this.primaryAgent.respond(userInput, session);
      dialogue.finalResponse = response.text;

      dialogue.turns.push({
        speaker: 'primary',
        message: response.text,
        timestamp: new Date().toISOString(),
        messageType: 'direct_response'
      });
    }

    // Save dialogue for analytics
    await this.saveDialogue(session.id, dialogue);

    return dialogue;
  }

  /**
   * Format dialogue for natural voice output
   */
  formatDialogueForVoice(dialogue) {
    // Convert agent dialogue into natural speech
    let voiceScript = '';

    const lastTurn = dialogue.turns[dialogue.turns.length - 1];

    if (dialogue.participants.length > 2) {
      // Multi-agent response - make it conversational
      voiceScript = dialogue.finalResponse;
    } else {
      // Single agent response
      voiceScript = lastTurn.message;
    }

    return voiceScript;
  }
}
```

### Specialist Agent Module

```javascript
// src/agents/GovernmentSchemesSpecialistModule.js

class GovernmentSchemesSpecialistModule {
  constructor() {
    this.knowledgeBase = new SchemeKnowledgeBase();
  }

  /**
   * Process consultation from primary agent
   */
  async processConsultation(request) {
    const { query, context, requestingAgent } = request;

    logger.info('[Specialist] Processing consultation', {
      from: requestingAgent,
      query
    });

    // Analyze consultation query
    const queryType = this.classifyQuery(query);

    // Fetch relevant scheme information
    const schemeInfo = await this.knowledgeBase.query(query, context);

    // Build response for requesting agent
    const response = {
      text: this.formatConsultationResponse(schemeInfo, queryType),
      structuredData: schemeInfo,
      confidenceLevel: this.calculateConfidence(schemeInfo),
      suggestedFollowUp: this.generateFollowUp(schemeInfo, context)
    };

    // Add synthesis instruction for primary agent
    if (requestingAgent === 'primary') {
      response.synthesisInstruction =
        `Incorporate this scheme information naturally.
         Mention that you consulted with the schemes specialist.
         Combine with your loan/financial advice for a complete recommendation.`;
    }

    return response;
  }

  formatConsultationResponse(schemeInfo, queryType) {
    if (queryType === 'eligibility') {
      return `Based on the user's profile, they are ${schemeInfo.eligibleStatus}
              for ${schemeInfo.schemeName}. The scheme provides ${schemeInfo.benefits}.
              Recommend that they ${schemeInfo.recommendation}.`;
    } else if (queryType === 'benefits') {
      return `${schemeInfo.schemeName} provides: ${schemeInfo.benefits}.
              The user can receive this along with other financial products like loans.`;
    } else if (queryType === 'comparison') {
      return `Comparing ${schemeInfo.schemes.join(' and ')}:
              ${schemeInfo.comparison}.
              Recommend ${schemeInfo.bestFit} based on user's situation.`;
    }

    return schemeInfo.summary;
  }
}
```

---

## User Experience

### Example: Three-Way Conversation (User Perspective)

**What the user hears:**

```
User: "I'm a farmer needing ₹2 lakh for a tractor. Should I get a loan or government help?"

AI: "That's a perfect question for both financial planning and government schemes.
     Let me quickly consult with our schemes specialist...

     [Brief pause - 500ms]

     Okay, here's what we recommend as a team:

     For a ₹2 lakh tractor purchase, you'll need a loan since government schemes
     typically provide smaller annual amounts. I recommend a Kisan Credit Card
     loan at just 4% interest after government subsidy.

     However, my colleague from schemes pointed out that you should ALSO register
     for PM-KISAN, which gives you ₹6,000 per year in direct income support.
     You can have both the loan AND PM-KISAN - they work together!

     So the complete plan is:
     1. Kisan Credit Card loan for ₹2 lakh (4% interest)
     2. PM-KISAN registration for ₹6,000 annual support

     This way you get immediate funding plus ongoing government support.
     Would you like me to help you apply for both?"

User: "Yes! How do I apply for PM-KISAN?"

AI: "Great! For detailed PM-KISAN guidance, let me bring in our schemes specialist
     who will walk you through the eligibility and application process..."

     [Specialist context activated]

     "Hello! I'm the schemes specialist. Let's check your PM-KISAN eligibility.
     First, do you own the agricultural land, or do you work on rented land?"

User: "I own 3 acres."

AI (as Specialist): "Perfect! You're definitely eligible since you own the land.
     Here's how to apply..."
```

**Behind the scenes:**

1. Turn 1: Primary agent calls `consult_specialist()` function → Backend routes to specialist module → Specialist returns PM-KISAN info → Primary synthesizes response
2. Turn 2: Primary agent calls `activate_specialist()` → Specialist context injected → Specialist takes over
3. Turn 3: Specialist handles follow-up directly

---

## Cost Analysis

### Function-Based Consultation Cost

**Per Consultation:**
- Function call: ~1 token (negligible)
- Backend processing: <500ms compute (~$0.001)
- Specialist response: ~100 tokens (~$0.002)
- Primary synthesis: ~200 tokens (~$0.004)
- **Total: ~$0.007 per consultation**

**Compared to Alternatives:**
- Multiple Vertex AI sessions: ~$0.25 per session × 2 = $0.50 (71x more expensive)
- Session recreation: ~$0.10 per switch (14x more expensive)
- Function-based: ~$0.007 ✅ Most cost-effective

### Monthly Cost (10,000 conversations, 30% use consultation)

- Base conversations: 10,000 × $0.25 = $2,500
- Consultations: 3,000 × $0.007 = $21
- **Total: $2,521/month (+0.84% increase)**

**Compared to Multi-Session Approach:**
- Multi-session: 3,000 × $0.50 = $1,500 additional
- Total: $4,000/month (+60% increase) ❌ Too expensive

---

## Implementation Checklist

### Phase 1: Function-Based Consultation (Week 1)

- [ ] Create `AgentModule` base class
- [ ] Implement `PrimaryAgentModule.js`
- [ ] Implement `GovernmentSchemesSpecialistModule.js`
- [ ] Add `consult_specialist` function to schema
- [ ] Update `AgentOrchestrator` with consultation routing
- [ ] Add dialogue tracking to sessions

### Phase 2: Three-Way Orchestration (Week 2)

- [ ] Implement `orchestrateThreeWayDialogue()` method
- [ ] Add agent-to-agent communication protocol
- [ ] Create dialogue formatting for voice
- [ ] Add synthesis instructions for natural responses
- [ ] Implement dialogue persistence

### Phase 3: Testing & Refinement (Week 3)

- [ ] Test consultation scenarios
- [ ] Test specialist activation after consultation
- [ ] Test agent handbacks
- [ ] Optimize response times (<500ms consultation)
- [ ] Tune synthesis prompts for natural dialogue

---

## Summary: Three-Way Communication Achieved

**Architecture: Function-Based Agent Consultation + Context Injection**

✅ **True Three-Way Communication:**
- User talks to Primary Agent
- Primary Agent consults Specialist Agent (backend)
- Specialist Agent responds to Primary Agent
- Primary Agent synthesizes and responds to User

✅ **Agent-to-Agent Dialogue:**
- Agents exchange information via function calls
- Backend modules handle agent logic
- Consultation happens in <500ms

✅ **Natural User Experience:**
- User hears collaborative response
- Agents "talk to each other" (synthesized)
- Seamless specialist activation when needed

✅ **Cost-Effective:**
- Single Vertex AI session
- Function calls add only $0.007 per consultation
- 0.84% monthly cost increase (vs 60% for multi-session)

✅ **Scalable:**
- Easy to add more specialists
- Agent modules are independent
- Orchestrator manages complexity

**Next Steps:** Ready for implementation approval?

