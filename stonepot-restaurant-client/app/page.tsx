'use client';

import { useState, useRef, useEffect } from 'react';
import { VertexAILiveService } from './services/VertexAILiveService';
import { DisplayWebSocketService } from './services/DisplayWebSocket';
import { PartyKitService } from './services/PartyKitService';
import { VADService } from './services/VADService';
import { MultimodalDisplay } from './components/MultimodalDisplay';
import { Cart } from './components/Cart';
import { CartIsland } from './components/CartIsland';
import { CollaborativeOrderPanel } from './components/collaborative/CollaborativeOrderPanel';
import { OrderFlow } from './components/order/OrderFlow';
import { Toast, ToastMessage } from './components/Toast';
import Menu from './components/Menu';
import { menuStore } from './stores/menuStore';
import { cartStore } from './stores/cartStore';
import { orderStore } from './stores/orderStore';
import { collaborativeOrderStore } from './stores/collaborativeOrderStore';
import { menuItems } from './data/menuData';
import { observer } from 'mobx-react-lite';
import { VAD_CONFIG } from './config/vad';

const RestaurantOrderingApp = observer(function RestaurantOrderingApp() {
  // Session state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [isConnecting, setIsConnecting] = useState(false); // Connection in progress
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Display state
  const [displayService, setDisplayService] = useState<DisplayWebSocketService | null>(null);
  const [currentDisplay, setCurrentDisplay] = useState<any>(null);
  const [transcriptions, setTranscriptions] = useState<any[]>([]);
  const displayLockRef = useRef<boolean>(false); // Prevents rapid display clearing
  const criticalDisplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showOrderFlow, setShowOrderFlow] = useState(false);
  const lastScrollY = useRef(0);
  const cartAutoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Collaborative order state
  const [showCollaborativeOrder, setShowCollaborativeOrder] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Load customer phone from localStorage on mount (returning customer)
  useEffect(() => {
    const savedPhone = localStorage.getItem('stonepot_customer_phone');
    if (savedPhone) {
      setCustomerPhone(savedPhone);
      console.log('[App] Loaded returning customer phone:', savedPhone);
    }
  }, []);

  // Save customer phone to localStorage when it changes
  useEffect(() => {
    if (customerPhone) {
      localStorage.setItem('stonepot_customer_phone', customerPhone);
      console.log('[App] Saved customer phone to localStorage:', customerPhone);
    }
  }, [customerPhone]);

  // Audio visualization
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(32).fill(0));
  const [conversationTime, setConversationTime] = useState(0);

  // Refs for voice service
  const vertexAILiveServiceRef = useRef<VertexAILiveService | null>(null);
  const recordingContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const lastSpeechStartRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const idleAnimationRef = useRef<number | null>(null);
  const conversationStartTimeRef = useRef<number>(0);

  // PartyKit ref
  const partykitServiceRef = useRef<PartyKitService | null>(null);

  // VAD ref and state
  const vadServiceRef = useRef<VADService | null>(null);
  const silenceFrameCountRef = useRef(0);
  const vadSpeakingRef = useRef(false);
  const speechBufferFramesRef = useRef(0); // Frames to send after speech ends

  // Conversation timer
  useEffect(() => {
    if (isSessionActive) {
      conversationStartTimeRef.current = Date.now();
      setConversationTime(0);

      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - conversationStartTimeRef.current) / 1000);
        setConversationTime(elapsed);
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setConversationTime(0);
      conversationStartTimeRef.current = 0;
    }
  }, [isSessionActive]);

  // Auto-hide header on scroll
  useEffect(() => {
    if (!isSessionActive) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const currentScrollY = target.scrollTop;

      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        // Scrolling down - hide header
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up - show header
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    const mainElement = document.querySelector('main');
    mainElement?.addEventListener('scroll', handleScroll);

    return () => {
      mainElement?.removeEventListener('scroll', handleScroll);
    };
  }, [isSessionActive]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to show cart with auto-hide
  const showCartWithAutoHide = (duration: number = 8000) => {
    // Clear any existing timer
    if (cartAutoHideTimerRef.current) {
      clearTimeout(cartAutoHideTimerRef.current);
    }

    // Show cart
    setShowCart(true);

    // Set new auto-hide timer
    cartAutoHideTimerRef.current = setTimeout(() => {
      setShowCart(false);
      cartAutoHideTimerRef.current = null;
    }, duration);
  };

  // Helper to keep cart open (cancel auto-hide)
  const keepCartOpen = () => {
    if (cartAutoHideTimerRef.current) {
      clearTimeout(cartAutoHideTimerRef.current);
      cartAutoHideTimerRef.current = null;
    }
    setShowCart(true);
  };

  // Toast notifications
  const showToast = (message: string, type: ToastMessage['type'] = 'info', duration?: number) => {
    const id = Date.now().toString();
    const toast: ToastMessage = { id, message, type, duration };
    setToasts((prev) => [...prev, toast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // PartyKit Connection
  const connectToPartyKit = async (roomUrl: string, orderData: any) => {
    try {
      console.log('[PartyKit] Connecting to room:', roomUrl);

      const service = new PartyKitService();
      partykitServiceRef.current = service;

      const tenantId = orderData.tenantId || sessionInfo?.tenantId || 'default';
      const customerId = `${tenantId}_${customerPhone}`;

      // Setup callbacks before connecting
      service.onSync((state) => {
        console.log('[PartyKit] Synced state:', state);
        showToast('Connected to group order', 'success');
      });

      service.onParticipantJoined((participant) => {
        const isMe = participant.id === customerId;
        if (!isMe) {
          showToast(`${participant.name} joined the order`, 'participant');
        }
      });

      service.onParticipantLeft((participant) => {
        showToast(`${participant.name} left`, 'info');
      });

      service.onItemAdded((item, participant) => {
        const isMe = participant.id === customerId;
        if (!isMe) {
          showToast(`${participant.name} added ${item.dishName}`, 'info');
        }
      });

      service.onItemRemoved((itemId, participant) => {
        const isMe = participant.id === customerId;
        if (!isMe) {
          showToast(`${participant.name} removed an item`, 'info');
        }
      });

      service.onOrderFinalized(() => {
        showToast('Order has been finalized!', 'success', 6000);
      });

      service.onError((error) => {
        console.error('[PartyKit] Error:', error);
        showToast('Connection error. Reconnecting...', 'error');
      });

      // Connect to PartyKit
      await service.connect(
        roomUrl,
        customerId,
        customerName || 'Guest',
        orderData.circleId,
        tenantId,
        customerPhone
      );

      // Setup store
      collaborativeOrderStore.setRoomData({
        roomId: orderData.id || orderData.sessionId,
        circleId: orderData.circleId,
        circleName: orderData.circleName || 'Group Order',
        currentUserId: customerId
      });

      // Open collaborative order panel
      setShowCollaborativeOrder(true);

      console.log('[PartyKit] Connected successfully');
    } catch (error) {
      console.error('[PartyKit] Connection failed:', error);
      showToast('Failed to connect to group order', 'error');
    }
  };

  const disconnectFromPartyKit = () => {
    if (partykitServiceRef.current) {
      partykitServiceRef.current.disconnect();
      partykitServiceRef.current = null;
    }
    setShowCollaborativeOrder(false);
  };

  // Handle manual order flow
  const handlePlaceOrder = () => {
    if (cartStore.items.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }
    setShowCart(false);
    setShowOrderFlow(true);
  };

  const handleOrderFlowClose = () => {
    setShowOrderFlow(false);
  };

  // Idle animation
  // Helper: Convert Float32 to PCM16
  const convertFloat32ToPCM16 = (float32Data: Float32Array): ArrayBuffer => {
    const pcmData = new Int16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcmData.buffer;
  };

  const startIdleAnimation = () => {
    if (idleAnimationRef.current) return;

    let time = 0;
    const animate = () => {
      time += 0.05;
      const newLevels = Array.from({ length: 32 }, (_, i) => {
        const wave1 = Math.sin(time + i * 0.5) * 0.15;
        const wave2 = Math.sin(time * 1.3 - i * 0.3) * 0.1;
        return Math.abs(wave1 + wave2);
      });
      setAudioLevels(newLevels);
      idleAnimationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  const stopIdleAnimation = () => {
    if (idleAnimationRef.current) {
      cancelAnimationFrame(idleAnimationRef.current);
      idleAnimationRef.current = null;
    }
  };

  const startSession = async () => {
    try {
      console.log('[Restaurant] Starting session...');

      // INSTANT FEEDBACK: Show orbs immediately before any async operations
      setIsConnecting(true); // Mark as connecting
      setSessionStatus('listening');
      setIsSessionActive(true);
      startIdleAnimation();

      // VAD DISABLED - Model tensor mismatch issue
      // Initialize VAD FIRST (while user waits)
      // console.log('[VAD] Initializing Voice Activity Detection...');
      // const vadService = new VADService();
      // await vadService.initialize();
      // vadServiceRef.current = vadService;
      // console.log('[VAD] Ready ✓');

      // Request microphone permission
      console.log('[Restaurant] Requesting microphone permission...');
      await startContinuousMicrophoneCapture();
      console.log('[Restaurant] Microphone access granted');

      // Create session with backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-334610188311.us-central1.run.app';
      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'https://stonepot-restaurant-display.suyesh.workers.dev';

      console.log('[Restaurant] Creating backend session...');
      const response = await fetch(`${apiUrl}/api/restaurant/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'demo-restaurant',
          userId: 'demo-user',
          language: 'en'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Restaurant] Session created:', data);
      setSessionInfo(data);

      // Initialize Vertex AI Live service
      let wsUrl = `${apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')}${data.websocketUrl}`;

      // Add customerPhone to URL if available (for returning customers)
      if (customerPhone) {
        const separator = wsUrl.includes('?') ? '&' : '?';
        wsUrl += `${separator}customerPhone=${encodeURIComponent(customerPhone)}`;
        console.log('[Restaurant] Adding returning customer phone to WebSocket URL');
      }

      vertexAILiveServiceRef.current = new VertexAILiveService(wsUrl);

      // Set up audio playback callback
      vertexAILiveServiceRef.current.onAudio(async (audioData: ArrayBuffer) => {
        console.log('[Restaurant] Audio response received');
        await playPCMAudio(audioData);
      });

      // Set up message callback
      vertexAILiveServiceRef.current.onMessage((message: any) => {
        console.log('[Restaurant] Message:', message.type);
        if (message.type === 'session_ready') {
          setSessionStatus('listening');
        } else if (message.type === 'session_reconnecting') {
          console.log('[Restaurant] Session reconnecting...');
          setSessionStatus('thinking');
          showToast('Reconnecting session...', 'info');
        } else if (message.type === 'session_reconnect_failed') {
          console.error('[Restaurant] Session reconnection failed');
          setSessionStatus('idle');
          showToast('Session expired. Please start a new conversation.', 'error');

          // CRITICAL: End the session to stop the audio loop
          endSession();
        } else if (message.type === 'error') {
          console.error('[Restaurant] Error:', message.message);
          showToast(message.message || 'An error occurred', 'error');
        }
      });

      // Connect to Vertex AI Live
      await vertexAILiveServiceRef.current.connect('en');
      console.log('[Restaurant] Connected to Vertex AI Live');

      // Initialize display service
      const service = new DisplayWebSocketService(workerUrl);
      setDisplayService(service);

      // Connect to display WebSocket
      await service.connect(data.sessionId);
      console.log('[Restaurant] Connected to display service');

      // Handle display updates
      service.on('initial_state', (state: any) => {
        console.log('[Restaurant] Initial state:', state);
        setTranscriptions(state.transcriptions || []);
        if (state.displayUpdates?.length > 0) {
          setCurrentDisplay(state.displayUpdates[state.displayUpdates.length - 1]);
        }
      });

      service.on('update', (update: any) => {
        console.log('[Restaurant] Display update:', update);
        if (update.type === 'transcription') {
          setTranscriptions((prev) => [...prev, update]);

          // Check if user is asking about cart or wanting to continue ordering
          const text = update.data?.text?.toLowerCase() || '';
          const cartRelatedPhrases = ['cart', 'order', 'what did i', 'what have i', 'show me', 'whats in'];
          const continueOrderingPhrases = ['add', 'also', 'and', 'want', 'get me', 'ill have', 'i need'];

          if (cartRelatedPhrases.some(phrase => text.includes(phrase))) {
            // User is asking about cart - keep it open indefinitely
            keepCartOpen();
          } else if (continueOrderingPhrases.some(phrase => text.includes(phrase)) && cartStore.itemCount > 0) {
            // User is adding more items - keep cart visible but with auto-hide
            showCartWithAutoHide(12000); // 12 seconds for multi-item ordering
          }
        } else if (update.type === 'customer_update') {
          // SINGLE SOURCE OF TRUTH: Backend broadcasts customer data
          console.log('[Restaurant] Customer update from backend:', update.customer);
          if (update.customer) {
            orderStore.setCustomer({
              name: update.customer.name,
              phone: update.customer.phone,
              email: update.customer.email || undefined
            });
            // Persist phone for returning customer detection
            if (update.customer.phone) {
              setCustomerPhone(update.customer.phone);
              localStorage.setItem('stonepot_customer_phone', update.customer.phone);
            }
          }
        } else if (update.type === 'customer_addresses') {
          // OPTIMIZATION: Backend sends saved addresses via WebSocket
          // This eliminates the need for HTTP request in AddressEntry component
          console.log('[Restaurant] Customer addresses from backend:', update.addresses?.length || 0);
          if (update.addresses && update.addresses.length > 0) {
            // Store addresses in sessionStorage for AddressEntry to pick up
            sessionStorage.setItem('stonepot_saved_addresses', JSON.stringify(update.addresses));
          }
        } else {
          // Protected display update with minimum display duration for critical flows
          const isCriticalDisplay = ['checkout_summary', 'payment_pending', 'address_verification'].includes(update.type);

          // Clear any existing critical display timer
          if (criticalDisplayTimerRef.current) {
            clearTimeout(criticalDisplayTimerRef.current);
            criticalDisplayTimerRef.current = null;
          }

          // Update display
          setCurrentDisplay(update);

          // For critical displays, set a lock to prevent accidental clearing
          if (isCriticalDisplay) {
            displayLockRef.current = true;
            criticalDisplayTimerRef.current = setTimeout(() => {
              displayLockRef.current = false;
              criticalDisplayTimerRef.current = null;
            }, 2000); // Minimum 2 second display duration
          } else {
            displayLockRef.current = false;
          }

          // Highlight menu items when shown
          if (update.type === 'dish_card' || update.type === 'menu_item' || update.type === 'combo_item') {
            if (update.data?.name) {
              menuStore.highlightItem(update.data.name);
            }
          }

          // Handle cart updates from voice ordering
          if (update.type === 'cart_item_added' && update.data?.item) {
            const { dishName, quantity } = update.data.item;
            console.log('[Restaurant] Adding item to cart:', dishName, quantity);

            // Find the menu item to get full details
            const menuItem = menuItems.find(
              item => item.name.toLowerCase() === dishName.toLowerCase()
            );

            if (menuItem) {
              // Add multiple items based on quantity
              for (let i = 0; i < (quantity || 1); i++) {
                if ('choices' in menuItem) {
                  // It's a combo item - use default choice if available
                  const defaultChoice = menuItem.choices[0];
                  cartStore.addComboItem(menuItem, defaultChoice);
                } else {
                  cartStore.addMenuItem(menuItem);
                }
              }

              // Auto-show cart when item is added (8 seconds to review)
              showCartWithAutoHide(8000);
            }
          }

          // Handle cart updates from voice ordering (including removals)
          if (update.type === 'cart_updated' && update.data?.cart) {
            console.log('[Restaurant] Cart updated from voice:', update.data.action);

            // Sync entire cart from backend
            const backendCart = update.data.cart;

            // Clear current cart and rebuild from backend state
            cartStore.clearCart();

            // Add all items from backend cart
            if (backendCart.items && backendCart.items.length > 0) {
              backendCart.items.forEach((backendItem: any) => {
                // Find the menu item to get full details
                const menuItem = menuItems.find(
                  item => item.name.toLowerCase() === backendItem.dishName.toLowerCase()
                );

                if (menuItem) {
                  // Add items based on quantity
                  for (let i = 0; i < backendItem.quantity; i++) {
                    if ('choices' in menuItem) {
                      // It's a combo item - use customization if available
                      const choice = backendItem.customization || menuItem.choices[0];
                      cartStore.addComboItem(menuItem, choice);
                    } else {
                      cartStore.addMenuItem(menuItem);
                    }
                  }
                }
              });
            }

            // Show cart for modifications and additions
            // Keep cart open longer when removing (10s) so user can see what's left
            // Shorter for additions (8s) to not interrupt ordering flow
            if (update.data.action === 'remove') {
              showCartWithAutoHide(10000); // 10 seconds after removal
            } else if (update.data.action === 'decrease') {
              showCartWithAutoHide(8000); // 8 seconds after quantity decrease
            } else if (update.data.action === 'increase') {
              showCartWithAutoHide(6000); // 6 seconds after quantity increase
            }

            // Sync to PartyKit if in collaborative mode
            if (collaborativeOrderStore.roomId && partykitServiceRef.current && update.data.action === 'add') {
              const addedItem = backendCart.items[backendCart.items.length - 1];
              if (addedItem) {
                partykitServiceRef.current.sendAddItem({
                  dishName: addedItem.dishName,
                  dishType: addedItem.dishType,
                  quantity: addedItem.quantity,
                  price: addedItem.price,
                  customization: addedItem.customization
                });
              }
            }
          }

          // Handle customer info capture
          if (update.type === 'customer_info_captured' && update.data?.customer) {
            setCustomerName(update.data.customer.name);
            setCustomerPhone(update.data.customer.phone);
            showToast(`Welcome, ${update.data.customer.name}!`, 'success');
          }

          // Handle circle created
          if (update.type === 'circle_created' && update.data?.circle) {
            showToast(`Circle "${update.data.circle.name}" created`, 'success');
          }

          // Handle member invited
          if (update.type === 'member_invited' && update.data) {
            showToast(`${update.data.inviteeName} added to circle`, 'success');
          }

          // Handle collaborative order started
          if (update.type === 'collaborative_order_started' && update.data) {
            const { partykitRoomUrl, collaborativeOrder } = update.data;
            if (partykitRoomUrl && collaborativeOrder) {
              connectToPartyKit(partykitRoomUrl, collaborativeOrder);
            }
          }

          // Handle collaborative order finalized
          if (update.type === 'collaborative_order_finalized') {
            collaborativeOrderStore.finalize();
            showToast('Order finalized! Proceeding to payment...', 'success', 6000);
          }
        }
      });

      service.on('error', (error: any) => {
        console.error('[Display service error:', error);
      });

      // Mark connection as complete
      setIsConnecting(false);
      console.log('[Restaurant] Session started successfully');
    } catch (error: any) {
      console.error('[Restaurant] Failed:', error);
      setError(error.message);
      setSessionStatus('idle');
      setIsSessionActive(false);
      setIsConnecting(false); // Reset connecting state
      stopIdleAnimation(); // Stop animation on error
    }
  };

  const startContinuousMicrophoneCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const audioContext = new AudioContext({ sampleRate: 16000 });
    recordingContextRef.current = audioContext;

    // CRITICAL: Verify actual sample rate
    const actualSampleRate = audioContext.sampleRate;
    console.log(`[Audio] Requested sample rate: 16000 Hz | Actual sample rate: ${actualSampleRate} Hz`);

    if (actualSampleRate !== 16000) {
      console.error(`[Audio] ⚠️ SAMPLE RATE MISMATCH! Browser using ${actualSampleRate} Hz instead of 16000 Hz`);
      console.error('[Audio] VAD will NOT work correctly - resampling required!');
    }

    // Load AudioWorklet processor
    await audioContext.audioWorklet.addModule('/audio-processor.js');

    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, 'audio-stream-processor');

    // Handle messages from AudioWorklet
    workletNode.port.onmessage = async (event) => {
      const { type, data, rms, duration } = event.data;

      if (type === 'speech-start') {
        // INTERRUPTION DETECTION: User started speaking
        if (sessionStatus === 'speaking') {
          console.log('[Audio] INTERRUPTION - User spoke while AI was speaking');

          // Stop current audio playback immediately
          if (playbackContextRef.current) {
            playbackContextRef.current.close().catch(() => {});
            playbackContextRef.current = null;
          }

          // Clear visualization
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          // Reset playback state
          nextPlayTimeRef.current = 0;
          isPlayingRef.current = false;

          // Send interruption signal to backend
          if (vertexAILiveServiceRef.current) {
            vertexAILiveServiceRef.current.interrupt();
          }
        }

        lastSpeechStartRef.current = performance.now();
        setSessionStatus('listening');
        stopIdleAnimation();
        // console.log(`[Audio] Speech detected (RMS: ${rms.toFixed(4)})`);
      } else if (type === 'speech-end') {
        // RMS-based speech end (for interruption only)
        // VAD will handle the actual turn completion
        // console.log(`[Audio] RMS silence detected after ${duration.toFixed(0)}ms`);
      } else if (type === 'audio-data') {
        // REVERTED: Direct audio sending without VAD (VAD will be fixed later)
        if (!vertexAILiveServiceRef.current?.isActive()) {
          return;
        }

        // Don't send audio when OrderFlow is open (user is checking out)
        if (showOrderFlow) {
          return;
        }

        // Convert ArrayBuffer to Float32Array, then to PCM16
        const float32Data = new Float32Array(data);
        const pcmData = convertFloat32ToPCM16(float32Data);

        // Send all audio directly to Gemini
        if (vertexAILiveServiceRef.current.isActive()) {
          vertexAILiveServiceRef.current.sendAudio(pcmData);
        }

        /* VAD CODE COMMENTED OUT - Model expects 'state' but we're sending 'h' and 'c'
        // Run VAD
        const vadResult = await vadServiceRef.current.process(float32Data);

        if (vadResult.isSpeech) {
          // Speech detected - convert to PCM16 and send to Gemini
          const pcmData = convertFloat32ToPCM16(float32Data);

          if (vertexAILiveServiceRef.current.isActive()) {
            vertexAILiveServiceRef.current.sendAudio(pcmData);
          }

          // Reset silence counter
          silenceFrameCountRef.current = 0;

          // Mark as speaking if not already
          if (!vadSpeakingRef.current) {
            vadSpeakingRef.current = true;
            setSessionStatus('listening');
            stopIdleAnimation();
            console.log('[VAD] Speech started');
          }

          // Reset buffer counter
          speechBufferFramesRef.current = VAD_CONFIG.positiveSpeechPad;

        } else if (vadSpeakingRef.current) {
          // Silence detected while speaking
          silenceFrameCountRef.current++;

          // Continue sending audio for a short buffer period after speech ends
          // This prevents cutting off final syllables
          if (speechBufferFramesRef.current > 0) {
            const pcmData = convertFloat32ToPCM16(float32Data);
            if (vertexAILiveServiceRef.current.isActive()) {
              vertexAILiveServiceRef.current.sendAudio(pcmData);
            }
            speechBufferFramesRef.current--;
          }

          // If silence persists beyond threshold, mark turn complete
          if (silenceFrameCountRef.current >= VAD_CONFIG.maxSilenceFrames) {
            vadSpeakingRef.current = false;
            silenceFrameCountRef.current = 0;
            speechBufferFramesRef.current = 0;

            // Send turn complete signal to Gemini
            if (vertexAILiveServiceRef.current) {
              vertexAILiveServiceRef.current.sendTurnComplete();
            }

            setSessionStatus('thinking');
            setAudioLevels(new Array(32).fill(0));
            console.log('[VAD] Turn complete - sustained silence detected');

            // Log VAD stats every turn for cost tracking
            if (VAD_CONFIG.debug) {
              vadServiceRef.current?.logStats();
            }
          }
        }
        */
      }
    };

    // Connect audio pipeline
    source.connect(workletNode);
    workletNode.connect(audioContext.destination);

    setSessionStatus('listening');
    console.log('[Restaurant] AudioWorklet streaming started');
  };

  const startAudioVisualization = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualization = () => {
      analyser.getByteFrequencyData(dataArray);

      const barCount = 32;
      const barWidth = Math.floor(bufferLength / barCount);
      const newLevels: number[] = [];

      for (let i = 0; i < barCount; i++) {
        const start = i * barWidth;
        const end = start + barWidth;
        let sum = 0;

        for (let j = start; j < end; j++) {
          sum += dataArray[j];
        }

        const average = sum / barWidth;
        const normalized = Math.min((average / 255) * 3.0, 1);
        newLevels.push(normalized);
      }

      setAudioLevels(newLevels);
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    };

    updateVisualization();
  };

  const playPCMAudio = async (audioData: ArrayBuffer) => {
    try {
      // Initialize playback audio context if needed
      if (!playbackContextRef.current) {
        playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = playbackContextRef.current.currentTime;

        // Create analyser for visualization
        analyserRef.current = playbackContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.connect(playbackContextRef.current.destination);
      }

      const audioContext = playbackContextRef.current;
      const pcm16 = new Int16Array(audioData);

      // Convert Int16 PCM to Float32
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      // Create audio buffer
      const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      // Schedule audio chunk
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to analyser for visualization
      if (analyserRef.current) {
        source.connect(analyserRef.current);
      } else {
        source.connect(audioContext.destination);
      }

      const currentTime = audioContext.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      source.start(startTime);

      const duration = audioBuffer.duration;
      nextPlayTimeRef.current = startTime + duration;

      // Update UI on first chunk
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setSessionStatus('speaking');
        startAudioVisualization();
      }

      // Detect end of playback
      const timeUntilEnd = (startTime + duration - audioContext.currentTime) * 1000 + 200;
      setTimeout(() => {
        if (audioContext.currentTime >= nextPlayTimeRef.current - 0.05) {
          isPlayingRef.current = false;
          setSessionStatus('listening');

          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          startIdleAnimation();
        }
      }, Math.max(timeUntilEnd, 0));
    } catch (error) {
      console.error('[Restaurant] Audio playback error:', error);
    }
  };

  /**
   * Handle user actions from display (button clicks)
   */
  const handleDisplayAction = (action: string, data: any) => {
    console.log('[Restaurant] Display action:', action, data);

    if (displayService) {
      displayService.sendAction(action, data);
    } else {
      console.error('[Restaurant] Display service not available');
    }
  };

  const endSession = async () => {
    // Clear cart auto-hide timer
    if (cartAutoHideTimerRef.current) {
      clearTimeout(cartAutoHideTimerRef.current);
      cartAutoHideTimerRef.current = null;
    }

    // Stop all animations
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    stopIdleAnimation();

    // VAD DISABLED
    // Log final VAD stats before cleanup
    // if (vadServiceRef.current) {
    //   console.log('[VAD] Final session statistics:');
    //   vadServiceRef.current.logStats();
    //   vadServiceRef.current.dispose();
    //   vadServiceRef.current = null;
    // }

    // Reset VAD state
    // silenceFrameCountRef.current = 0;
    // vadSpeakingRef.current = false;
    // speechBufferFramesRef.current = 0;

    // Disconnect services
    if (vertexAILiveServiceRef.current) {
      vertexAILiveServiceRef.current.disconnect();
      vertexAILiveServiceRef.current = null;
    }

    if (displayService) {
      displayService.disconnect();
      setDisplayService(null);
    }

    // Disconnect PartyKit
    disconnectFromPartyKit();

    // Close audio contexts
    if (recordingContextRef.current) {
      await recordingContextRef.current.close();
      recordingContextRef.current = null;
    }

    if (playbackContextRef.current) {
      await playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    analyserRef.current = null;
    nextPlayTimeRef.current = 0;
    isPlayingRef.current = false;
    setIsSessionActive(false);
    setSessionStatus('idle');
    setAudioLevels(new Array(32).fill(0));
    setTranscriptions([]);
    setCurrentDisplay(null);
  };

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#f8f9fa] to-[#0a0a0a]">
        <div className="max-w-md w-full mx-4 p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
          <h3 className="text-lg font-bold mb-2 text-red-400">Error</h3>
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col neu-bg">
      {!isSessionActive ? (
        /* Landing Screen - Menu Display */
        <>
          {/* Compact Header */}
          <header className="neu-header">
            <div className="header-content">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 neu-card rounded-full flex items-center justify-center">
                  <span className="text-lg md:text-xl">🍽️</span>
                </div>
                <h1 className="text-sm md:text-base font-bold neu-text">The Coorg Food Company</h1>
              </div>
            </div>
          </header>

          {/* Menu Display */}
          <main className="flex-1 overflow-y-auto pt-16 md:pt-20 p-6">
            <div className="max-w-7xl mx-auto">
              <Menu />
            </div>
          </main>

          {/* Cart Island for browsing mode */}
          <CartIsland onClick={() => setShowCart(true)} />

          {/* Voice Order FAB - Pulsating Orb */}
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-center gap-3">
            <button
              onClick={startSession}
              className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 group"
              aria-label="Start voice conversation"
            >
              {/* Outer Glow Ring - Pulsating */}
              <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />

              {/* Middle Glow Ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 opacity-80 blur-md group-hover:blur-lg transition-all" />

              {/* Inner Orb */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse" />
              </div>
            </button>

            {/* Label */}
            <span className="text-sm font-semibold neu-text">
              Start Voice Order
            </span>
          </div>

          {/* Order Panel - Slide-in from Right */}
          {showCart && (
            <div
              className="fixed inset-0 z-50 flex"
              onClick={() => setShowCart(false)}
            >
              {/* Backdrop with blur */}
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" />

              {/* Slide-in Panel */}
              <div className="ml-auto relative w-full max-w-md h-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <Cart onPlaceOrder={handlePlaceOrder} />
              </div>
            </div>
          )}
        </>
      ) : (
        /* Active Session - Voice-First Layout */
        <>
          {/* Auto-hiding Mobile-Optimized Header */}
          <header className={`neu-header transition-transform duration-300 ${
            isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
          }`}>
            <div className="header-content">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 neu-card rounded-full flex items-center justify-center">
                  <span className="text-lg md:text-xl">🍽️</span>
                </div>
                <h1 className="text-sm md:text-base font-bold neu-text">CFC</h1>
              </div>

              {/* Voice Status Indicator */}
              <div className="flex items-center gap-2 md:gap-3">
                <div className="neu-concave px-2 py-1 md:px-4 md:py-2 rounded-full flex items-center gap-1 md:gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    sessionStatus === 'listening' ? 'bg-blue-500 animate-pulse' :
                    sessionStatus === 'thinking' ? 'bg-yellow-500 animate-pulse' :
                    sessionStatus === 'speaking' ? 'bg-green-500 animate-pulse' :
                    'bg-gray-400'
                  }`} />
                  <span className="text-xs font-medium neu-text capitalize hidden md:inline">{sessionStatus}</span>
                </div>
                <button
                  onClick={endSession}
                  className="neu-button text-xs px-2 py-1 md:px-4 md:py-2 rounded-lg font-medium text-red-500"
                >
                  <span className="hidden md:inline">End Session</span>
                  <span className="md:hidden">End</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6 pb-32">
            <div className="max-w-7xl mx-auto">
              {/* Full Menu Display */}
              <Menu />

              {/* Voice-triggered Dish Card Modal */}
              {currentDisplay && (currentDisplay.type === 'dish_card' || currentDisplay.type === 'menu_item' || currentDisplay.type === 'combo_item') && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                  <div
                    className="max-w-md w-full animate-scale-in"
                  >
                    <MultimodalDisplay
                      visualData={currentDisplay}
                      onAction={handleDisplayAction}
                    />
                  </div>
                </div>
              )}

              {/* Order/Payment Flow Modal - Non-dismissible to prevent accidental closure */}
              {currentDisplay && (
                currentDisplay.type === 'checkout_summary' ||
                currentDisplay.type === 'payment_pending' ||
                currentDisplay.type === 'order_confirmed' ||
                currentDisplay.type === 'address_verification'
              ) && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                  <div className="max-w-md w-full h-full max-h-[90vh] animate-scale-in">
                    <MultimodalDisplay
                      visualData={currentDisplay}
                      onAction={handleDisplayAction}
                    />
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Voice Mic FAB with Integrated Visualizer */}
          <div className={`neu-voice-mic ${sessionStatus === 'listening' ? 'animate-pulse' : ''}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Circular Audio Visualizer */}
              <svg
                className="w-full h-full"
                viewBox="0 0 100 100"
                style={{ willChange: 'transform' }}
              >
                {audioLevels.slice(0, 16).map((level, i) => {
                  const numBars = 16;
                  const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
                  const baseRadius = 25;
                  const barLength = 5 + level * 15;
                  const innerRadius = baseRadius;
                  const outerRadius = baseRadius + barLength;

                  const x1 = 50 + Math.cos(angle) * innerRadius;
                  const y1 = 50 + Math.sin(angle) * innerRadius;
                  const x2 = 50 + Math.cos(angle) * outerRadius;
                  const y2 = 50 + Math.sin(angle) * outerRadius;

                  const color = sessionStatus === 'thinking'
                    ? `rgba(255, 149, 0, ${0.4 + level * 0.6})`
                    : sessionStatus === 'speaking'
                    ? `rgba(34, 197, 94, ${0.4 + level * 0.6})`
                    : `rgba(59, 130, 246, ${0.4 + level * 0.6})`;

                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      style={{
                        filter: `drop-shadow(0 0 ${2 + level * 4}px ${color})`,
                        transition: 'all 75ms ease-out',
                      }}
                    />
                  );
                })}
              </svg>

              {/* Connection Loading Spinner Overlay */}
              {isConnecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-sm rounded-full">
                  <svg className="animate-spin h-12 w-12" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>


          {/* Cart Island - Floating cart indicator */}
          <CartIsland onClick={() => setShowCart(true)} />

          {/* Order Panel - Slide-in from Right */}
          {showCart && (
            <div
              className="fixed inset-0 z-50 flex"
              onClick={() => setShowCart(false)}
            >
              {/* Backdrop with blur */}
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" />

              {/* Slide-in Panel */}
              <div className="ml-auto relative w-full max-w-md h-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                  animation: 'slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <Cart onPlaceOrder={handlePlaceOrder} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Toast Notifications */}
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Collaborative Order Panel */}
      <CollaborativeOrderPanel
        isOpen={showCollaborativeOrder}
        onClose={() => {
          disconnectFromPartyKit();
          showToast('Left group order', 'info');
        }}
      />

      {/* Order Flow Panel */}
      <OrderFlow
        isOpen={showOrderFlow}
        onClose={handleOrderFlowClose}
        sessionId={sessionInfo?.sessionId}
        backendUrl={process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-334610188311.us-central1.run.app'}
      />
    </div>
  );
});

export default RestaurantOrderingApp;
