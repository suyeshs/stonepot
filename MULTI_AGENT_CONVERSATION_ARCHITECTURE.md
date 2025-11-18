# Multi-Agent Conversation Architecture

**Version:** 1.0
**Date:** November 13, 2025
**Use Case:** Multi-Agent Financial Advisory (General + Government Schemes Specialist)

---

## Executive Summary

This document defines the architecture for implementing **multi-agent conversations** in Stonepot, where multiple AI agents can participate in a single conversation with the user. The initial implementation features:

- **Primary Agent:** General Financial Advisor (existing)
- **Specialist Agent:** Government Schemes Expert (new)
- **Conversation Pattern:** User ↔ Primary Agent ↔ Specialist Agent (three-way dialogue)

---

## 1. Use Case: Government Schemes Specialist

### Current State

**Single Agent Architecture:**
```
User: "Can you help me with PM-KISAN scheme?"
   ↓
Financial Advisor Agent (Generalist)
   ↓
Response: "PM-KISAN is a government scheme for farmers..."
```

**Limitations:**
- Single agent handles all topics (loans, insurance, schemes, fraud)
- Generic knowledge across all domains
- Cannot provide deep expertise in specialized areas
- Limited by single system instruction

### Desired State

**Multi-Agent Architecture:**
```
User: "Can you help me with PM-KISAN scheme?"
   ↓
Financial Advisor Agent (Generalist)
   ↓ [Recognizes need for specialist]
Financial Advisor: "Let me bring in our government schemes specialist for detailed information."
   ↓
Government Schemes Specialist Agent joins conversation
   ↓
Specialist: "Hello! I specialize in government schemes. PM-KISAN provides ₹6,000 annually to farmers..."
   ↓
User: "Am I eligible?"
   ↓
Specialist: "Let me check the eligibility criteria..."
   ↓
[Both agents remain active in conversation]
```

**Benefits:**
- Deep expertise in government schemes
- Seamless handoff from generalist to specialist
- Both agents can contribute based on their expertise
- Natural three-way conversation flow

---

## 2. Technical Architecture

### 2.1 Agent Orchestration Model

#### Option A: Context Injection (Recommended for MVP)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│              Single Vertex AI Session                        │
│  (Shared context, unified conversation history)              │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │   Agent Orchestrator     │
        │  (Backend Logic Layer)   │
        └────────────┬────────────┘
                     │
     ┌───────────────┼───────────────┐
     ↓               ↓               ↓
┌─────────┐   ┌──────────┐   ┌──────────┐
│ Primary │   │Specialist│   │ Function │
│ Agent   │   │  Agent   │   │ Handlers │
│ (Base)  │   │(Injected)│   │          │
└─────────┘   └──────────┘   └──────────┘
```

**How It Works:**

1. **Session Start:** Single Vertex AI session with Primary Agent system instruction
2. **Topic Detection:** Function call returns `topic: "government_scheme"`
3. **Agent Injection:** Backend injects Specialist Agent context via `clientContent.turns`
4. **Multi-Agent Mode:** Both agents contribute to conversation
5. **Context Management:** Track active agents in session metadata

**Message Flow:**

```javascript
// Step 1: User asks about government scheme
User: "Tell me about Ayushman Bharat scheme"

// Step 2: Primary Agent detects specialist need
Function Call: {
  name: "respond_to_financial_query",
  args: {
    topic: "government_scheme",
    requires_specialist: true,
    specialist_type: "government_schemes"
  }
}

// Step 3: Backend injects Specialist Agent context
Backend → Vertex AI:
{
  clientContent: {
    turns: [{
      role: 'model',
      parts: [{
        text: `[AGENT SWITCH]

The Government Schemes Specialist has joined the conversation.

SPECIALIST IDENTITY:
- Name: Government Schemes Advisor
- Expertise: All Indian government welfare schemes (PM-KISAN, Ayushman Bharat, PMAY, etc.)
- Knowledge: Eligibility criteria, application process, benefits, documentation
- Tone: Authoritative, helpful, detail-oriented

SPECIALIST INSTRUCTIONS:
- You are now the primary responder for this topic
- Provide detailed, accurate information about government schemes
- Guide users through application processes step-by-step
- Check eligibility based on user's situation
- The general financial advisor will assist with context but you lead this conversation

PREVIOUS CONTEXT: User asked about Ayushman Bharat scheme.

Now respond as the Government Schemes Specialist.`
      }]
    }],
    turnComplete: true
  }
}

// Step 4: AI responds as Specialist
AI (as Specialist): "Hello! I'm the Government Schemes Specialist.
Ayushman Bharat is India's flagship health insurance scheme providing
₹5 lakh coverage per family. Let me explain the eligibility and benefits..."

// Step 5: Conversation continues with specialist active
User: "Am I eligible?"
AI (as Specialist): "To determine eligibility, I need to ask a few questions..."
```

**Pros:**
- ✅ No session recreation (no latency)
- ✅ Seamless handoff
- ✅ Full conversation context preserved
- ✅ Low implementation complexity
- ✅ Cost-effective (single session)

**Cons:**
- ❌ Shared system instruction limits specialization
- ❌ Context bleeding between agents
- ❌ Same voice for all agents
- ❌ Requires careful prompt engineering

#### Option B: Parallel Sessions with Orchestrator

**Architecture:**
```
                 ┌──────────────────┐
                 │  User Input      │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │  Orchestrator    │
                 │  (Session 1)     │
                 │  Routes & Merges │
                 └────────┬─────────┘
                          │
            ┌─────────────┼─────────────┐
            │                           │
┌───────────▼────────────┐  ┌──────────▼──────────┐
│   Primary Agent        │  │  Specialist Agent   │
│   (Session 2)          │  │  (Session 3)        │
│  - General financial   │  │  - Govt schemes     │
└────────────────────────┘  └─────────────────────┘
```

**How It Works:**

1. **Orchestrator Session:** Routes user input to appropriate agent
2. **Agent Sessions:** Each agent has dedicated Vertex AI session
3. **Response Synthesis:** Orchestrator merges responses
4. **Context Sharing:** Orchestrator maintains shared context

**Pros:**
- ✅ True agent isolation
- ✅ Dedicated system instructions per agent
- ✅ Clean context separation
- ✅ Scalable (add more agents easily)

**Cons:**
- ❌ High complexity
- ❌ 3x cost (3 concurrent sessions)
- ❌ Higher latency (multi-hop)
- ❌ Complex response synthesis

#### Option C: Session Recreation (Strong Isolation)

**Architecture:**
```
User Input → Primary Agent (Session 1)
                    ↓
         [Specialist needed detected]
                    ↓
         Close Session 1 → Create Session 2 (Specialist)
                    ↓
         Specialist responds → Continue in Session 2
                    ↓
         [If generalist needed again]
                    ↓
         Close Session 2 → Create Session 1 (Primary)
```

**How It Works:**

1. Primary Agent handles initial conversation
2. When specialist needed, close session and create new one
3. Transfer relevant context to new session
4. Continue as specialist
5. Can switch back if needed

**Pros:**
- ✅ True agent switching
- ✅ Clean context per agent
- ✅ Different system instructions
- ✅ Moderate cost (1 session at a time)

**Cons:**
- ❌ 2-3 second latency per switch
- ❌ User hears interruption
- ❌ Difficult to have "both agents" present
- ❌ Context transfer complexity

### 2.2 Recommended Approach

**Hybrid: Context Injection + Function-Based Specialists**

Combine the best of both worlds:

1. **Primary Mode:** Context Injection (Option A)
   - Use for most specialist handoffs
   - Fast, seamless, cost-effective

2. **Fallback Mode:** Session Recreation (Option C)
   - Use when context bleeding is problematic
   - Use when very long specialist conversations expected

**Decision Logic:**
```javascript
if (requiresSpecialist) {
  if (isShortConsultation || contextBleeding === 'low') {
    // Use context injection (fast, seamless)
    injectSpecialistContext(session, specialistType);
  } else if (isLongConsultation || contextBleeding === 'high') {
    // Use session recreation (clean isolation)
    switchSession(sessionId, specialistType);
  }
}
```

---

## 3. Agent Definitions

### 3.1 Primary Agent: General Financial Advisor

**Role:** First point of contact, handles general financial queries, routes to specialists

**System Instruction (Existing):**
```
You are a warm, friendly financial advisor helping people in India with:
- Loans (personal, home, education, business)
- Savings and investments
- Insurance (life, health, vehicle)
- Banking services
- Government schemes (basic information)
- Fraud protection

ROUTING RESPONSIBILITY:
- For detailed government scheme questions, acknowledge and bring in specialist
- For loan calculations, handle directly
- For insurance comparisons, handle directly
- For fraud alerts, handle immediately (don't delegate)

When bringing in specialist, say:
"That's a great question about [scheme name]. Let me bring in our government
schemes specialist who can provide detailed information about eligibility,
benefits, and the application process."
```

**Topics Handled:**
- Loan inquiries (eligibility, rates, documentation)
- Savings accounts and deposits
- Insurance basics
- Banking services (accounts, cards, payments)
- Fraud detection and warnings
- Investment basics
- Credit scores

**Specialist Routing Triggers:**
- User asks about specific government schemes
- User asks about eligibility for schemes
- User asks about application process for schemes
- Keywords: PM-KISAN, Ayushman Bharat, PMAY, Sukanya Samriddhi, etc.

### 3.2 Specialist Agent: Government Schemes Expert

**Role:** Deep expertise in Indian government welfare schemes, eligibility, application process

**System Instruction (New):**
```
You are a Government Schemes Specialist with comprehensive knowledge of
all Indian government welfare schemes.

IDENTITY:
- You are the specialist who was brought into this conversation
- The general financial advisor has handed off this topic to you
- You are authoritative on government schemes but friendly in approach

EXPERTISE AREAS:
1. **Agricultural Schemes:**
   - PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)
   - PM-FBY (Fasal Bima Yojana)
   - Soil Health Card Scheme

2. **Health & Insurance:**
   - Ayushman Bharat (PM-JAY)
   - ESIS (Employee State Insurance Scheme)

3. **Housing:**
   - PMAY (Pradhan Mantri Awas Yojana) - Urban & Rural
   - Credit Linked Subsidy Scheme

4. **Women & Children:**
   - Sukanya Samriddhi Yojana
   - Beti Bachao Beti Padhao
   - PMMVY (Maternity Benefit)

5. **Employment & Skills:**
   - PMEGP (Employment Generation)
   - Skill India Programs
   - MGNREGA

6. **Senior Citizens:**
   - PMVVY (Vaya Vandana Yojana)
   - APY (Atal Pension Yojana)
   - Senior Citizen Savings Scheme

CONVERSATION APPROACH:
1. **Introduce Yourself:** "Hello! I'm the Government Schemes Specialist."
2. **Understand Need:** Ask about the user's situation (income, occupation, state)
3. **Check Eligibility:** Ask specific questions to determine eligibility
4. **Explain Benefits:** Clear breakdown of financial benefits, coverage, features
5. **Guide Application:** Step-by-step process including documents, portals, timeline
6. **Follow-up:** Ask if they need information about related schemes

ELIGIBILITY CHECKING:
- Always ask relevant questions (income, age, occupation, state, family size)
- Be precise about criteria (income limits, age ranges, documentation)
- Explain why they are/aren't eligible
- Suggest alternative schemes if they don't qualify

ACCURACY REQUIREMENTS:
- Provide exact benefit amounts in INR
- Cite official portals for applications
- Mention state-specific variations if applicable
- Update on latest scheme modifications (if you're aware)

TONE & STYLE:
- Authoritative but approachable
- Patient and detail-oriented
- Encouraging (government schemes are designed to help!)
- Clear explanations without jargon

COLLABORATION:
- If user asks about loans/insurance outside schemes, acknowledge and
  say "Let me bring back the financial advisor for that."
- Focus on your expertise; don't try to handle general financial topics
```

**Topics Handled:**
- Detailed scheme information
- Eligibility criteria and checking
- Application process and documentation
- Benefit calculations
- Timeline and disbursement
- State-specific variations
- Related scheme recommendations

**Handback Triggers:**
- User asks about private loans/insurance
- User asks about general banking
- User asks about fraud prevention
- Topic shifts away from government schemes

---

## 4. Conversation Patterns

### Pattern 1: Simple Handoff

```
User: "What is PM-KISAN scheme?"
   ↓
Primary Agent (recognizes specialist need):
  "PM-KISAN is a great scheme for farmers. Let me bring in our
   government schemes specialist for detailed information."
   ↓
[Backend injects Specialist context]
   ↓
Specialist Agent:
  "Hello! I'm the Government Schemes Specialist. PM-KISAN provides
   direct income support of ₹6,000 per year to farmer families.
   Are you a farmer or landowner?"
   ↓
User: "Yes, I have 2 acres."
   ↓
Specialist: "Great! You may be eligible..."
```

### Pattern 2: Multi-Turn with Both Agents

```
User: "I need help with finances."
   ↓
Primary Agent: "I'm here to help! What specifically are you looking for?"
   ↓
User: "I need a loan for my farm and want to know about government schemes."
   ↓
Primary Agent: "Perfect! I can help with the loan, but let me bring in our
                government schemes specialist for the schemes part."
   ↓
[Specialist joins]
   ↓
Specialist: "Hello! I'll cover the government schemes. Which schemes are
             you interested in?"
   ↓
User: "PM-KISAN and Fasal Bima Yojana."
   ↓
Specialist: "Excellent choices! PM-KISAN provides ₹6,000 annually..."
   ↓
User: "And what about the loan?"
   ↓
Primary Agent: "For the farm loan, let me ask some questions..."
   ↓
[Both agents remain active, responding to their respective topics]
```

### Pattern 3: Handback to Primary

```
[Specialist is active]
User: "Thanks for the scheme info. Now I want to get a personal loan."
   ↓
Specialist: "I'm glad I could help! For personal loan information,
             let me bring back the financial advisor."
   ↓
[Backend injects Primary context or clears Specialist]
   ↓
Primary Agent: "I'm back! Let's talk about personal loans..."
```

### Pattern 4: Multi-Agent Collaboration

```
User: "I'm a farmer. Should I take a loan or rely on PM-KISAN?"
   ↓
Primary Agent: "That's a great question requiring both loan and scheme knowledge.
                Let me bring in the schemes specialist."
   ↓
[Specialist joins]
   ↓
Primary Agent: "PM-KISAN provides ₹6,000 per year, which is helpful but
                may not be enough for large investments."
   ↓
Specialist: "Correct! PM-KISAN is meant for basic income support.
             For farm equipment or land improvement, a Kisan Credit Card
             loan at subsidized rates might be better. The financial
             advisor can explain loan options."
   ↓
Primary Agent: "Exactly. A Kisan Credit Card offers up to ₹3 lakh at
                just 4% interest (after subsidy)..."
   ↓
[Collaborative response combining both expertise areas]
```

---

## 5. Implementation Design

### 5.1 Database Schema Extensions

#### Firestore Collections

**agents (new collection):**
```javascript
{
  "government_schemes_specialist": {
    agentId: "government_schemes_specialist",
    name: "Government Schemes Specialist",
    type: "specialist",
    category: "government_schemes",
    systemInstruction: "You are a Government Schemes Specialist...",
    expertise: [
      "PM-KISAN", "Ayushman Bharat", "PMAY", "Sukanya Samriddhi",
      "PM-FBY", "MGNREGA", "APY", "PMVVY"
    ],
    activationTriggers: {
      keywords: [
        "PM-KISAN", "Ayushman Bharat", "government scheme",
        "yojana", "eligibility", "apply for scheme"
      ],
      topics: ["government_scheme", "welfare_program"],
      userIntents: ["check_scheme_eligibility", "apply_for_scheme"]
    },
    handbackTriggers: {
      keywords: ["loan", "insurance", "fraud", "scam"],
      topics: ["loans", "insurance", "fraud_detection"]
    },
    voiceConfig: {
      greeting: "Hello! I'm the Government Schemes Specialist.",
      handoff: "Let me bring back the financial advisor for that.",
      tone: "authoritative, patient, detail-oriented"
    },
    status: "active",
    createdAt: "2025-11-13T00:00:00Z"
  }
}
```

**sessions (extend existing):**
```javascript
{
  "session_456": {
    id: "session_456",
    userId: "user_789",
    tenantId: "default",
    language: "en",

    // NEW: Multi-agent tracking
    activeAgents: ["primary", "government_schemes_specialist"],
    primaryAgent: "primary",
    currentAgent: "government_schemes_specialist",
    agentHistory: [
      {
        agentId: "primary",
        activatedAt: "2025-11-13T10:00:00Z",
        deactivatedAt: null,
        messageCount: 3
      },
      {
        agentId: "government_schemes_specialist",
        activatedAt: "2025-11-13T10:02:15Z",
        deactivatedAt: null,
        messageCount: 5
      }
    ],

    isActive: true,
    createdAt: "2025-11-13T10:00:00Z",
    lastActivity: "2025-11-13T10:05:30Z"
  }
}
```

**user_profiles (extend existing):**
```javascript
{
  "user_789": {
    userId: "user_789",
    conversationHistory: [
      {
        role: "user",
        content: "Tell me about PM-KISAN",
        timestamp: "2025-11-13T10:00:00Z",
        agentId: null  // NEW: Track which agent was active
      },
      {
        role: "assistant",
        content: "Let me bring in our specialist...",
        timestamp: "2025-11-13T10:00:05Z",
        agentId: "primary"  // NEW
      },
      {
        role: "assistant",
        content: "Hello! I'm the Government Schemes Specialist...",
        timestamp: "2025-11-13T10:00:10Z",
        agentId: "government_schemes_specialist"  // NEW
      }
    ],

    // NEW: Agent interaction history
    agentInteractions: {
      "government_schemes_specialist": {
        firstInteraction: "2025-11-13T10:00:10Z",
        lastInteraction: "2025-11-13T10:05:30Z",
        totalInteractions: 12,
        topicsDiscussed: ["PM-KISAN", "Ayushman Bharat"],
        userSatisfaction: 4.5  // Optional: from feedback
      }
    },

    preferences: {},
    lastUpdated: "2025-11-13T10:05:30Z"
  }
}
```

### 5.2 Code Architecture

#### New Services

**1. AgentOrchestrator.js**

```javascript
// /Users/stonepot-tech/projects/stonepot/src/services/AgentOrchestrator.js

class AgentOrchestrator {
  constructor() {
    this.agents = new Map(); // agentId → AgentConfig
    this.loadAgents();
  }

  async loadAgents() {
    // Load from Firestore agents collection
    const agentsSnapshot = await firebaseService.getCollection('agents');
    agentsSnapshot.forEach(agent => {
      this.agents.set(agent.agentId, agent);
    });
  }

  /**
   * Determine if specialist agent is needed
   */
  shouldActivateSpecialist(session, functionCall) {
    const { topic, requires_specialist, user_intent } = functionCall.args;

    // Check topic triggers
    for (const [agentId, agent] of this.agents) {
      if (agent.type === 'specialist') {
        if (agent.activationTriggers.topics.includes(topic)) {
          return agentId;
        }

        if (agent.activationTriggers.userIntents.includes(user_intent)) {
          return agentId;
        }
      }
    }

    // Check explicit specialist request
    if (requires_specialist) {
      const specialistType = functionCall.args.specialist_type;
      return specialistType || null;
    }

    return null;
  }

  /**
   * Inject specialist context into session
   */
  async activateSpecialist(vertexSession, agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Build context injection message
    const contextMessage = {
      clientContent: {
        turns: [{
          role: 'model',
          parts: [{
            text: this.buildAgentActivationContext(agent, vertexSession)
          }]
        }],
        turnComplete: true
      }
    };

    // Send to Vertex AI
    vertexSession.ws.send(JSON.stringify(contextMessage));

    // Update session metadata
    vertexSession.activeAgents.push(agentId);
    vertexSession.currentAgent = agentId;
    vertexSession.agentHistory.push({
      agentId,
      activatedAt: new Date().toISOString(),
      deactivatedAt: null,
      messageCount: 0
    });

    logger.info('[AgentOrchestrator] Activated specialist', {
      sessionId: vertexSession.id,
      agentId,
      agentName: agent.name
    });
  }

  buildAgentActivationContext(agent, session) {
    const previousMessages = session.conversationHistory.slice(-5);
    const context = previousMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `[AGENT SWITCH - MULTI-AGENT MODE ACTIVATED]

The ${agent.name} has joined the conversation.

SPECIALIST IDENTITY:
${agent.systemInstruction}

CURRENT CONVERSATION CONTEXT:
${context}

INSTRUCTIONS:
- You are now the primary responder for topics related to: ${agent.expertise.join(', ')}
- The general financial advisor remains available but you take the lead
- Introduce yourself briefly: "${agent.voiceConfig.greeting}"
- Provide detailed, expert-level information in your domain
- If the conversation shifts away from your expertise, acknowledge and hand back: "${agent.voiceConfig.handoff}"

IMPORTANT: You are part of a multi-agent system. Stay in your role and expertise area.

Now respond to the user's question as the ${agent.name}.`;
  }

  /**
   * Deactivate specialist and return to primary agent
   */
  async deactivateSpecialist(vertexSession, agentId) {
    const contextMessage = {
      clientContent: {
        turns: [{
          role: 'model',
          parts: [{
            text: `[AGENT SWITCH]

The ${agentId} is stepping back. The general financial advisor is now handling the conversation.

Continue as the primary financial advisor, maintaining context from the previous specialist discussion.`
          }]
        }],
        turnComplete: true
      }
    };

    vertexSession.ws.send(JSON.stringify(contextMessage));

    // Update session metadata
    vertexSession.activeAgents = vertexSession.activeAgents.filter(id => id !== agentId);
    vertexSession.currentAgent = 'primary';

    const agentHistoryEntry = vertexSession.agentHistory.find(
      entry => entry.agentId === agentId && !entry.deactivatedAt
    );
    if (agentHistoryEntry) {
      agentHistoryEntry.deactivatedAt = new Date().toISOString();
    }

    logger.info('[AgentOrchestrator] Deactivated specialist', {
      sessionId: vertexSession.id,
      agentId
    });
  }

  /**
   * Check if specialist should hand back to primary
   */
  shouldHandbackToPrimary(session, functionCall) {
    const currentAgent = this.agents.get(session.currentAgent);
    if (!currentAgent || currentAgent.type !== 'specialist') {
      return false;
    }

    const { topic, response } = functionCall.args;

    // Check handback triggers
    if (currentAgent.handbackTriggers.topics.includes(topic)) {
      return true;
    }

    // Check for keywords in response
    const responseLower = response.toLowerCase();
    for (const keyword of currentAgent.handbackTriggers.keywords) {
      if (responseLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    return false;
  }
}

module.exports = AgentOrchestrator;
```

**2. GovernmentSchemesAgent.js (Specialist Configuration)**

```javascript
// /Users/stonepot-tech/projects/stonepot/src/agents/GovernmentSchemesAgent.js

class GovernmentSchemesAgent {
  static getConfig() {
    return {
      agentId: 'government_schemes_specialist',
      name: 'Government Schemes Specialist',
      type: 'specialist',
      category: 'government_schemes',

      systemInstruction: `You are a Government Schemes Specialist with comprehensive knowledge of all Indian government welfare schemes.

[Full system instruction from Section 3.2]`,

      expertise: [
        'PM-KISAN',
        'Ayushman Bharat',
        'PMAY',
        'Sukanya Samriddhi Yojana',
        'PM-FBY',
        'MGNREGA',
        'APY',
        'PMVVY',
        'PMEGP',
        'Beti Bachao Beti Padhao'
      ],

      activationTriggers: {
        keywords: [
          'PM-KISAN', 'pm kisan', 'pradhan mantri kisan',
          'Ayushman Bharat', 'ayushman', 'PM-JAY',
          'PMAY', 'pradhan mantri awas', 'housing scheme',
          'government scheme', 'sarkari yojana', 'yojana',
          'eligibility', 'scheme eligibility', 'apply for scheme',
          'Sukanya Samriddhi', 'girl child scheme',
          'Fasal Bima', 'crop insurance', 'PM-FBY',
          'MGNREGA', 'employment guarantee', 'NREGA',
          'Atal Pension', 'APY', 'pension yojana',
          'skill india', 'PMEGP', 'employment generation'
        ],
        topics: ['government_scheme', 'welfare_program', 'subsidy'],
        userIntents: [
          'check_scheme_eligibility',
          'apply_for_scheme',
          'understand_scheme',
          'compare_schemes'
        ]
      },

      handbackTriggers: {
        keywords: [
          'loan', 'credit', 'borrow', 'EMI',
          'insurance', 'policy', 'premium',
          'fraud', 'scam', 'cheat', 'fake',
          'investment', 'mutual fund', 'stock',
          'bank account', 'savings account', 'debit card'
        ],
        topics: [
          'loans', 'credit', 'insurance', 'fraud_detection',
          'investment', 'banking', 'savings'
        ]
      },

      voiceConfig: {
        greeting: "Hello! I'm the Government Schemes Specialist, here to help you with detailed information about welfare programs.",
        handoff: "For that, let me bring back the financial advisor who can provide more details.",
        tone: 'authoritative, patient, detail-oriented, encouraging'
      },

      knowledgeBase: {
        // Optional: Reference to File Search Store with scheme documents
        fileSearchStoreId: null,  // Can be added later

        // Optional: Reference to external APIs
        externalAPIs: {
          eligibilityChecker: 'https://api.schemes.gov.in/check-eligibility',
          schemeDetails: 'https://api.schemes.gov.in/scheme-info'
        }
      },

      status: 'active',
      version: '1.0',
      createdAt: '2025-11-13T00:00:00Z',
      updatedAt: '2025-11-13T00:00:00Z'
    };
  }

  /**
   * Enhanced function declarations for specialist
   */
  static getFunctionDeclarations() {
    return [{
      name: 'respond_to_scheme_query',
      description: 'Respond to questions about government schemes with detailed, authoritative information',
      parameters: {
        type: 'object',
        properties: {
          response: {
            type: 'string',
            description: 'Your detailed response about the scheme'
          },
          scheme_name: {
            type: 'string',
            description: 'Name of the scheme being discussed'
          },
          scheme_category: {
            type: 'string',
            enum: [
              'agricultural', 'health', 'housing', 'women_children',
              'employment', 'senior_citizen', 'education', 'financial_inclusion'
            ]
          },
          user_intent: {
            type: 'string',
            enum: [
              'learn_about_scheme', 'check_eligibility', 'application_process',
              'required_documents', 'benefits_amount', 'timeline',
              'state_specific_info', 'compare_schemes'
            ]
          },
          eligibility_status: {
            type: 'string',
            enum: ['likely_eligible', 'not_eligible', 'need_more_info', 'unclear'],
            description: 'Preliminary eligibility assessment based on conversation'
          },
          requires_handback: {
            type: 'boolean',
            description: 'Set to true if the user is asking about topics outside government schemes'
          },
          suggested_schemes: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of related schemes to recommend'
          }
        },
        required: ['response', 'user_intent']
      }
    }];
  }

  /**
   * Validate eligibility criteria for common schemes
   */
  static async checkEligibility(schemeName, userProfile) {
    // This would integrate with external APIs or internal logic
    // For MVP, return placeholder logic

    const eligibilityRules = {
      'PM-KISAN': {
        criteria: ['owns_agricultural_land', 'indian_citizen'],
        exclusions: ['govt_employee', 'income_tax_payer', 'institutional_landowner']
      },
      'Ayushman Bharat': {
        criteria: ['below_poverty_line', 'not_covered_by_esic'],
        maxIncome: null  // Based on SECC data, not simple income limit
      },
      'PMAY': {
        criteria: ['first_home', 'below_income_limit'],
        maxIncome: {
          EWS: 300000,      // ₹3 lakh for Economically Weaker Section
          LIG: 600000,      // ₹6 lakh for Low Income Group
          MIG1: 1200000,    // ₹12 lakh for Middle Income Group 1
          MIG2: 1800000     // ₹18 lakh for Middle Income Group 2
        }
      }
    };

    // Return eligibility check result
    return {
      scheme: schemeName,
      eligible: null,  // Determined by criteria check
      reason: '',
      nextSteps: []
    };
  }
}

module.exports = GovernmentSchemesAgent;
```

#### Modified Services

**3. VertexAILiveService.js (Extensions)**

```javascript
// Add to /Users/stonepot-tech/projects/stonepot/src/services/VertexAILiveService.js

const AgentOrchestrator = require('./AgentOrchestrator');

class VertexAILiveService {
  constructor() {
    // Existing constructor code...

    // NEW: Initialize agent orchestrator
    this.agentOrchestrator = new AgentOrchestrator();
  }

  async createSession(sessionId, config = {}) {
    // Existing session creation code...

    // NEW: Initialize multi-agent tracking
    session.activeAgents = ['primary'];
    session.primaryAgent = 'primary';
    session.currentAgent = 'primary';
    session.agentHistory = [{
      agentId: 'primary',
      activatedAt: new Date().toISOString(),
      deactivatedAt: null,
      messageCount: 0
    }];

    // Rest of existing code...
  }

  async handleFunctionCall(session, functionCall) {
    const { name, id, args } = functionCall;

    logger.info('[VertexAILive] Function call received', {
      sessionId: session.id,
      function: name,
      currentAgent: session.currentAgent,
      args: JSON.stringify(args)
    });

    // NEW: Multi-agent routing logic
    if (name === 'respond_to_financial_query') {
      // Check if specialist activation is needed
      const specialistId = this.agentOrchestrator.shouldActivateSpecialist(
        session,
        functionCall
      );

      if (specialistId && !session.activeAgents.includes(specialistId)) {
        logger.info('[VertexAILive] Activating specialist', {
          sessionId: session.id,
          specialistId
        });

        // Activate specialist before processing response
        await this.agentOrchestrator.activateSpecialist(session, specialistId);
      }

      // Check if specialist should hand back to primary
      if (session.currentAgent !== 'primary') {
        const shouldHandback = this.agentOrchestrator.shouldHandbackToPrimary(
          session,
          functionCall
        );

        if (shouldHandback) {
          logger.info('[VertexAILive] Handing back to primary agent', {
            sessionId: session.id,
            fromAgent: session.currentAgent
          });

          await this.agentOrchestrator.deactivateSpecialist(
            session,
            session.currentAgent
          );
        }
      }

      // Process the response (existing code)
      const response = args.response;
      const cleanResponse = validateAndCleanResponse(response);

      // NEW: Track agent message count
      const currentAgentHistory = session.agentHistory.find(
        entry => entry.agentId === session.currentAgent && !entry.deactivatedAt
      );
      if (currentAgentHistory) {
        currentAgentHistory.messageCount++;
      }

      // Send tool response back to Vertex AI (existing code)
      session.ws.send(JSON.stringify({
        toolResponse: {
          functionResponses: [{
            id,
            name,
            response: {
              result: cleanResponse
            }
          }]
        }
      }));

      // NEW: Save conversation with agent metadata
      await this.saveMessageWithAgent(session, 'assistant', cleanResponse);
    }

    // NEW: Handle specialist-specific function calls
    else if (name === 'respond_to_scheme_query') {
      const response = args.response;
      const cleanResponse = validateAndCleanResponse(response);

      // Check if handback is requested
      if (args.requires_handback) {
        await this.agentOrchestrator.deactivateSpecialist(
          session,
          'government_schemes_specialist'
        );
      }

      session.ws.send(JSON.stringify({
        toolResponse: {
          functionResponses: [{
            id,
            name,
            response: { result: cleanResponse }
          }]
        }
      }));

      await this.saveMessageWithAgent(session, 'assistant', cleanResponse);
    }
  }

  /**
   * NEW: Save message with agent metadata
   */
  async saveMessageWithAgent(session, role, content) {
    const message = {
      role,
      content,
      timestamp: new Date().toISOString(),
      agentId: session.currentAgent  // NEW
    };

    // Add to session history
    if (!session.conversationHistory) {
      session.conversationHistory = [];
    }
    session.conversationHistory.push(message);

    // Persist to in-memory cache
    const userHistory = this.conversationHistory.get(session.userId) || [];
    userHistory.push(message);
    this.conversationHistory.set(session.userId, userHistory);
  }

  async closeSession(sessionId, reason = 'user_ended') {
    // Existing close session code...

    // NEW: Save agent interaction summary
    if (session.agentHistory && session.agentHistory.length > 1) {
      await this.saveAgentInteractionSummary(session);
    }

    // Rest of existing code...
  }

  /**
   * NEW: Save agent interaction summary to user profile
   */
  async saveAgentInteractionSummary(session) {
    const agentSummary = {};

    for (const agentEntry of session.agentHistory) {
      if (agentEntry.agentId === 'primary') continue;

      agentSummary[agentEntry.agentId] = {
        activatedAt: agentEntry.activatedAt,
        deactivatedAt: agentEntry.deactivatedAt || new Date().toISOString(),
        messageCount: agentEntry.messageCount,
        duration: agentEntry.deactivatedAt
          ? new Date(agentEntry.deactivatedAt) - new Date(agentEntry.activatedAt)
          : new Date() - new Date(agentEntry.activatedAt)
      };
    }

    // Update user profile with agent interaction history
    await sessionPersistenceService.updateUserProfile(session.userId, {
      [`agentInteractions.${session.agentHistory[1].agentId}`]: {
        lastInteraction: new Date().toISOString(),
        totalInteractions: 1  // Increment logic needed
      }
    });
  }
}
```

**4. SharedFunctionSchema.js (Extensions)**

```javascript
// Modify /Users/stonepot-tech/projects/stonepot/src/services/SharedFunctionSchema.js

class SharedFunctionSchema {
  static getFunctionDeclarations() {
    // Existing function: respond_to_financial_query
    const baseFunction = {
      name: 'respond_to_financial_query',
      description: 'Have a natural conversation about financial topics',
      parameters: {
        type: 'object',
        properties: {
          response: {
            type: 'string',
            description: 'Your conversational response'
          },
          topic: {
            type: 'string',
            enum: [
              'loans', 'credit', 'savings', 'deposits', 'insurance',
              'health_insurance', 'life_insurance', 'banking',
              'payments', 'credit_cards', 'debit_cards',
              'government_scheme',  // NEW: Trigger for specialist
              'fraud_warning', 'scam_alert', 'investment',
              'financial_planning', 'budget', 'tax', 'general_conversation'
            ]
          },
          conversation_stage: {
            type: 'string',
            enum: [
              'greeting', 'understanding_need', 'gathering_details',
              'providing_information', 'explaining_options', 'clarifying',
              'warning_fraud', 'specialist_handoff',  // NEW
              'concluding', 'casual_chat'
            ]
          },
          user_intent: {
            type: 'string',
            enum: [
              'get_loan', 'open_account', 'understand_scheme',
              'check_eligibility', 'compare_options', 'report_fraud',
              'learn_about_topic', 'get_help', 'clarify_doubt',
              'casual_question', 'continue_previous_topic',
              'check_scheme_eligibility',  // NEW
              'apply_for_scheme'  // NEW
            ]
          },
          requires_specialist: {  // NEW
            type: 'boolean',
            description: 'Set to true if this query requires specialist knowledge (e.g., detailed government schemes)'
          },
          specialist_type: {  // NEW
            type: 'string',
            enum: ['government_schemes_specialist', 'fraud_analyst', 'loan_expert'],
            description: 'Type of specialist needed if requires_specialist is true'
          }
        },
        required: ['response', 'topic', 'conversation_stage', 'user_intent']
      }
    };

    return [baseFunction];
  }

  static buildSystemPrompt(context) {
    const { category, tenantConfig, previousContext, language } = context;

    // Existing system prompt with NEW section for multi-agent

    return `You are a warm, friendly financial advisor helping people in India...

[Existing prompt content]

🤝 MULTI-AGENT COLLABORATION:

When users ask detailed questions about GOVERNMENT SCHEMES, you should:
1. Acknowledge the question
2. Provide a brief answer if you can
3. Offer to bring in the Government Schemes Specialist for detailed information
4. Set requires_specialist: true and specialist_type: "government_schemes_specialist"

Example:
User: "Tell me about PM-KISAN eligibility"
You: "PM-KISAN is a great scheme for farmers providing ₹6,000 per year.
      Let me bring in our government schemes specialist who can provide
      detailed eligibility criteria and application guidance."
[Set requires_specialist: true]

SCHEMES THAT TRIGGER SPECIALIST:
- PM-KISAN, Ayushman Bharat, PMAY, Sukanya Samriddhi, PM-FBY, MGNREGA,
  APY, PMVVY, PMEGP, Skill India, any detailed scheme questions

TOPICS YOU HANDLE DIRECTLY:
- General loans, savings, insurance, banking, fraud warnings, basic financial advice

Remember: You're the first point of contact. Route to specialists when needed,
but don't hesitate to handle general queries yourself!

${previousContext ? `\n📝 PREVIOUS CONTEXT:\n${previousContext}` : ''}`;
  }
}
```

### 5.3 API Endpoints

**No new endpoints required** - Multi-agent orchestration happens within existing WebSocket and session creation flows.

**Optional: Agent Management APIs (Future)**

```typescript
// Admin APIs for managing specialist agents

GET /api/agents
// List all available agents

GET /api/agents/:agentId
// Get agent configuration

POST /api/agents
// Create new specialist agent

PATCH /api/agents/:agentId
// Update agent configuration

DELETE /api/agents/:agentId
// Deactivate agent

GET /api/sessions/:sessionId/agents
// Get agents active in a session

POST /api/sessions/:sessionId/agents/:agentId/activate
// Manually activate specialist

POST /api/sessions/:sessionId/agents/:agentId/deactivate
// Manually deactivate specialist
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```javascript
// Test agent activation logic
describe('AgentOrchestrator', () => {
  it('should activate specialist when government scheme topic detected', () => {
    const functionCall = {
      args: { topic: 'government_scheme', response: 'PM-KISAN info...' }
    };

    const specialistId = orchestrator.shouldActivateSpecialist(session, functionCall);
    expect(specialistId).toBe('government_schemes_specialist');
  });

  it('should not activate specialist for general loans', () => {
    const functionCall = {
      args: { topic: 'loans', response: 'Loan information...' }
    };

    const specialistId = orchestrator.shouldActivateSpecialist(session, functionCall);
    expect(specialistId).toBeNull();
  });

  it('should handback when user asks about loans during scheme discussion', () => {
    session.currentAgent = 'government_schemes_specialist';
    const functionCall = {
      args: { topic: 'loans', response: 'Let me bring back the advisor...' }
    };

    const shouldHandback = orchestrator.shouldHandbackToPrimary(session, functionCall);
    expect(shouldHandback).toBe(true);
  });
});
```

### 6.2 Integration Tests

```javascript
// Test full conversation flow with specialist activation
describe('Multi-Agent Conversation', () => {
  it('should activate specialist and maintain context', async () => {
    const session = await createTestSession();

    // User asks about government scheme
    await sendMessage(session, 'Tell me about PM-KISAN');

    // Primary agent should detect and activate specialist
    expect(session.activeAgents).toContain('government_schemes_specialist');
    expect(session.currentAgent).toBe('government_schemes_specialist');

    // Continue conversation
    await sendMessage(session, 'Am I eligible?');

    // Specialist should still be active
    expect(session.currentAgent).toBe('government_schemes_specialist');

    // Switch topic to loans
    await sendMessage(session, 'What about personal loans?');

    // Should hand back to primary
    expect(session.currentAgent).toBe('primary');
  });
});
```

### 6.3 Manual Test Scenarios

**Scenario 1: Simple Specialist Activation**
```
1. Start voice conversation
2. Say: "I want to know about PM-KISAN scheme"
3. Verify: Primary agent offers to bring in specialist
4. Verify: Specialist introduces themselves
5. Ask: "What are the benefits?"
6. Verify: Specialist provides detailed answer
```

**Scenario 2: Multi-Turn with Both Agents**
```
1. Start voice conversation
2. Say: "I need help with my finances"
3. Verify: Primary agent asks what you need
4. Say: "I want a loan and information about Ayushman Bharat"
5. Verify: Primary acknowledges and brings in specialist
6. Verify: Specialist discusses Ayushman Bharat
7. Say: "And what about the loan?"
8. Verify: Primary agent discusses loan options
```

**Scenario 3: Handback to Primary**
```
1. Start in specialist mode (discussing schemes)
2. Say: "Thanks, now I want to know about credit cards"
3. Verify: Specialist hands back to primary
4. Verify: Primary agent discusses credit cards
```

---

## 7. Implementation Timeline

### Week 1: Foundation

**Days 1-2: Database & Agent Config**
- [ ] Add `agents` collection to Firestore
- [ ] Extend `sessions` and `user_profiles` schemas
- [ ] Create GovernmentSchemesAgent configuration
- [ ] Seed agent data in Firestore

**Days 3-5: AgentOrchestrator Service**
- [ ] Implement AgentOrchestrator class
- [ ] Add specialist activation logic
- [ ] Add handback detection logic
- [ ] Add context injection methods
- [ ] Write unit tests

### Week 2: Integration

**Days 1-3: VertexAILiveService Integration**
- [ ] Modify `createSession` for multi-agent tracking
- [ ] Extend `handleFunctionCall` with orchestrator
- [ ] Add agent metadata to conversation history
- [ ] Implement `saveMessageWithAgent`
- [ ] Update `closeSession` with agent summary

**Days 4-5: Function Schema Updates**
- [ ] Extend `respond_to_financial_query` with specialist fields
- [ ] Update primary agent system prompt
- [ ] Create specialist system instruction
- [ ] Add activation triggers and keywords
- [ ] Write integration tests

### Week 3: Testing & Refinement

**Days 1-2: Manual Testing**
- [ ] Test specialist activation scenarios
- [ ] Test handback scenarios
- [ ] Test multi-turn conversations
- [ ] Test edge cases (rapid topic switching, etc.)

**Days 3-4: Bug Fixes & Optimization**
- [ ] Fix identified issues
- [ ] Optimize context injection prompts
- [ ] Tune activation/handback triggers
- [ ] Performance optimization

**Day 5: Documentation & Deployment**
- [ ] Update API documentation
- [ ] Create user-facing documentation
- [ ] Deploy to staging environment
- [ ] Conduct UAT (User Acceptance Testing)

### Week 4: Production Launch

**Days 1-2: Production Deployment**
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Collect user feedback

**Days 3-5: Analytics & Iteration**
- [ ] Analyze specialist activation rates
- [ ] Measure user satisfaction
- [ ] Identify improvement areas
- [ ] Plan next specialist agents

---

## 8. Success Metrics

### Technical Metrics

1. **Specialist Activation Rate:**
   - Target: 15-20% of conversations activate specialist
   - Measure: (Specialist activations) / (Total conversations)

2. **Context Injection Latency:**
   - Target: <200ms to inject specialist context
   - Measure: Time from activation to specialist response

3. **Handback Accuracy:**
   - Target: >90% of handbacks are appropriate
   - Measure: Manual review of handback scenarios

4. **Agent Routing Accuracy:**
   - Target: >95% correct specialist activations
   - Measure: Review false positives and false negatives

### User Experience Metrics

1. **User Satisfaction:**
   - Target: >4.5/5 for conversations with specialist
   - Measure: Post-conversation survey

2. **Conversation Completion Rate:**
   - Target: >85% of specialist conversations reach conclusion
   - Measure: Sessions ending with "concluding" stage

3. **Multi-Turn Engagement:**
   - Target: Average 8+ turns per specialist conversation
   - Measure: Message count in specialist mode

4. **Topic Resolution:**
   - Target: >80% of scheme queries fully answered
   - Measure: Sentiment analysis + explicit user feedback

---

## 9. Cost Analysis

### Incremental Costs

**Per Conversation:**
- Context injection: +1 message per specialist activation (~$0.01)
- Longer conversations: +2-3 turns average (~$0.15)
- **Total increase: ~$0.16 per specialist conversation**

**Monthly (assuming 20% specialist activation rate, 10,000 conversations):**
- Base cost: 10,000 conversations × $0.25 = $2,500
- Specialist cost: 2,000 specialist conversations × $0.16 = $320
- **Total: $2,820 (12.8% increase)**

**ROI:**
- Improved user satisfaction → Higher retention → More conversations
- Better scheme guidance → More scheme applications → Social impact
- Scalable to add more specialists (insurance, fraud, etc.)

---

## 10. Future Enhancements

### Phase 2: Additional Specialists

1. **Insurance Advisor**
   - Health insurance (beyond Ayushman Bharat)
   - Life insurance
   - Vehicle insurance
   - Policy comparisons

2. **Fraud Analyst**
   - Deep dive into scam detection
   - Report fraud cases
   - Educate about fraud prevention
   - Connect to authorities

3. **Loan Expert**
   - Detailed loan calculations
   - Compare loan products
   - Document checklist
   - Improve credit score advice

### Phase 3: Advanced Features

1. **Voice Differentiation:**
   - Different voices per agent (if Vertex AI supports)
   - Gender/accent variety

2. **Proactive Specialist Suggestion:**
   - AI suggests specialist before user asks
   - "I noticed you mentioned farming. Would you like to hear about PM-KISAN?"

3. **Multi-Specialist Collaboration:**
   - Multiple specialists in single conversation
   - Example: Loan Expert + Schemes Specialist for subsidized loans

4. **Agent Learning:**
   - Track which activations were helpful
   - Improve trigger keywords over time
   - Personalized agent recommendations

5. **Specialist Scheduling:**
   - "Connect me with a human specialist"
   - Schedule callback with real advisor
   - Integration with calendly/scheduling tools

---

## 11. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Context bleeding** | Medium | Explicit context scoping in prompts |
| **Confused handoffs** | High | Clear verbal handoff announcements |
| **Activation false positives** | Medium | Tune keywords, review activation logs |
| **User doesn't understand multi-agent** | Medium | Clear introductions, explain specialist role |
| **Increased latency** | Low | Context injection is fast (<200ms) |
| **Higher costs** | Low | Only 12.8% increase, offset by better UX |

---

## Conclusion

This multi-agent conversation architecture enables Stonepot to provide specialized expertise while maintaining a unified, seamless user experience. By using **context injection** rather than session recreation, we achieve:

✅ **Fast activation** (<200ms)
✅ **Seamless handoffs** (no interruptions)
✅ **Natural conversations** (three-way dialogue)
✅ **Cost-effective** (+12.8% only)
✅ **Scalable** (easy to add more specialists)

The Government Schemes Specialist is the first of many potential specialists, paving the way for a comprehensive multi-agent financial advisory platform.

---

**Next Steps:**
1. Review architecture and approve approach
2. Prioritize Week 1 tasks
3. Begin implementation
4. Set up monitoring and analytics

**Document Status:** Ready for Review & Implementation