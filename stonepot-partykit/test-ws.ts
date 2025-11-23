/**
 * WebSocket Test for PartyKit Server
 * Run with: bun run test-ws.ts
 */

const PARTYKIT_URL = 'wss://stonepot-collaborative-orders.suyeshs.partykit.dev';
const TEST_ROOM = 'test_room_' + Date.now();

console.log('🧪 Testing PartyKit WebSocket Connection');
console.log('═'.repeat(80));
console.log(`Server: ${PARTYKIT_URL}`);
console.log(`Room: ${TEST_ROOM}`);
console.log('═'.repeat(80));

// PartyKit default party name is "main" when not specified
const wsUrl = `${PARTYKIT_URL}/party/main/${TEST_ROOM}`;
console.log(`\nConnecting to: ${wsUrl}\n`);

const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log('✅ WebSocket CONNECTED!');
  console.log('─'.repeat(80));

  const joinMsg = {
    type: 'join',
    participantId: 'test_user_' + Date.now(),
    participantName: 'Bun Test User',
    timestamp: Date.now(),
    data: {
      circleId: 'test_circle',
      tenantId: 'test_tenant',
      phone: '1234567890'
    }
  };

  console.log('\n📤 Sending JOIN message:');
  console.log(JSON.stringify(joinMsg, null, 2));
  ws.send(JSON.stringify(joinMsg));
};

ws.onmessage = (event) => {
  console.log('\n📥 MESSAGE RECEIVED:');
  console.log('─'.repeat(80));
  try {
    const data = JSON.parse(event.data as string);
    console.log(JSON.stringify(data, null, 2));

    // If successful, test ADD_ITEM
    if (data.type === 'participant_joined' || data.type === 'sync') {
      setTimeout(() => {
        const addItemMsg = {
          type: 'add_item',
          participantId: 'test_user_' + Date.now(),
          participantName: 'Bun Test User',
          timestamp: Date.now(),
          data: {
            dishName: 'Test Chicken Biryani',
            dishType: 'non-veg',
            quantity: 2,
            price: 399
          }
        };

        console.log('\n📤 Sending ADD_ITEM message:');
        console.log(JSON.stringify(addItemMsg, null, 2));
        ws.send(JSON.stringify(addItemMsg));

        // Close after 2 more seconds
        setTimeout(() => {
          console.log('\n✅ Test completed successfully!');
          ws.close();
          process.exit(0);
        }, 2000);
      }, 1000);
    }
  } catch (e) {
    console.log('Raw message:', event.data);
  }
};

ws.onerror = (error) => {
  console.error('\n❌ WebSocket ERROR:');
  console.error(error);
};

ws.onclose = (event) => {
  console.log('\n🔌 Connection CLOSED');
  console.log(`Code: ${event.code}`);
  console.log(`Reason: ${event.reason || 'No reason provided'}`);
  console.log(`Clean: ${event.wasClean}`);

  if (event.code === 1006) {
    console.error('\n⚠️  Code 1006 = Abnormal closure - connection failed!');
    console.error('Possible issues:');
    console.error('  1. Server not deployed or down');
    console.error('  2. Incorrect WebSocket path');
    console.error('  3. Server crashed on connection');
    process.exit(1);
  }

  process.exit(0);
};

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n⏱️  Timeout - no response from server');
  ws.close();
  process.exit(1);
}, 10000);
