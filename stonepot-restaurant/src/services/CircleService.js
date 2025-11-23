/**
 * Circle Service for Stonepot Restaurant
 * Manages family/friend circles and collaborative ordering
 */

import { getFirebaseService } from './FirebaseService.js';
import { getCustomerService } from './CustomerService.js';

class CircleService {
  constructor(config) {
    this.config = config;
    this.firebaseService = getFirebaseService(config);
    this.customerService = getCustomerService(config);
  }

  /**
   * Create a new circle
   */
  async createCircle(tenantId, creatorPhone, circleName, circleType = 'family') {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${creatorPhone}`;

      // Verify creator exists
      const creator = await this.customerService.getCustomer(tenantId, creatorPhone);
      if (!creator) {
        throw new Error('Creator customer not found');
      }

      const circleData = {
        tenantId,
        name: circleName,
        type: circleType, // 'family' or 'friends'
        createdBy: customerId,
        members: [
          {
            customerId,
            phone: creatorPhone,
            name: creator.name,
            role: 'owner',
            joinedAt: new Date().toISOString()
          }
        ],
        activeOrders: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const circle = await this.firebaseService.createDocument('circles', circleData);

      // Add circle to creator's profile
      await this.customerService.addCustomerToCircle(
        tenantId,
        creatorPhone,
        circle.id,
        circleType
      );

      console.log('[CircleService] Created circle:', circle.id);

      return {
        success: true,
        circle
      };
    } catch (error) {
      console.error('[CircleService] Error creating circle:', error);
      throw error;
    }
  }

  /**
   * Invite member to circle
   */
  async inviteToCircle(circleId, inviterPhone, inviteePhone, inviteeName) {
    await this.firebaseService.initialize();

    try {
      const circle = await this.firebaseService.getDocument('circles', circleId);

      if (!circle) {
        throw new Error('Circle not found');
      }

      // Verify inviter is a member
      const inviterCustomerId = `${circle.tenantId}_${inviterPhone}`;
      const isMember = circle.members.some(m => m.customerId === inviterCustomerId);

      if (!isMember) {
        throw new Error('Inviter is not a member of this circle');
      }

      // Check if invitee is already a member
      const inviteeCustomerId = `${circle.tenantId}_${inviteePhone}`;
      const alreadyMember = circle.members.some(m => m.customerId === inviteeCustomerId);

      if (alreadyMember) {
        return {
          success: false,
          message: 'Customer is already a member'
        };
      }

      // Add member
      const newMember = {
        customerId: inviteeCustomerId,
        phone: inviteePhone,
        name: inviteeName,
        role: 'member',
        invitedBy: inviterCustomerId,
        joinedAt: new Date().toISOString()
      };

      circle.members.push(newMember);

      await this.firebaseService.updateDocument('circles', circleId, {
        members: circle.members
      });

      // Add circle to invitee's profile
      await this.customerService.addCustomerToCircle(
        circle.tenantId,
        inviteePhone,
        circleId,
        circle.type
      );

      console.log('[CircleService] Added member to circle:', circleId, inviteeCustomerId);

      return {
        success: true,
        circle: await this.firebaseService.getDocument('circles', circleId)
      };
    } catch (error) {
      console.error('[CircleService] Error inviting to circle:', error);
      throw error;
    }
  }

  /**
   * Remove member from circle
   */
  async removeMemberFromCircle(circleId, phone) {
    await this.firebaseService.initialize();

    try {
      const circle = await this.firebaseService.getDocument('circles', circleId);

      if (!circle) {
        throw new Error('Circle not found');
      }

      const customerId = `${circle.tenantId}_${phone}`;

      // Cannot remove owner
      const member = circle.members.find(m => m.customerId === customerId);
      if (member?.role === 'owner') {
        throw new Error('Cannot remove circle owner');
      }

      // Remove from members
      circle.members = circle.members.filter(m => m.customerId !== customerId);

      await this.firebaseService.updateDocument('circles', circleId, {
        members: circle.members
      });

      // Remove from customer's profile
      await this.customerService.removeCustomerFromCircle(
        circle.tenantId,
        phone,
        circleId
      );

      console.log('[CircleService] Removed member from circle:', circleId, customerId);

      return {
        success: true,
        circle: await this.firebaseService.getDocument('circles', circleId)
      };
    } catch (error) {
      console.error('[CircleService] Error removing member:', error);
      throw error;
    }
  }

  /**
   * Get circle by ID
   */
  async getCircle(circleId) {
    await this.firebaseService.initialize();

    try {
      const circle = await this.firebaseService.getDocument('circles', circleId);
      return circle;
    } catch (error) {
      console.error('[CircleService] Error getting circle:', error);
      throw error;
    }
  }

  /**
   * Get customer's circles
   */
  async getCustomerCircles(tenantId, phone) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;

      // Query all circles where customer is a member
      const allCircles = await this.firebaseService.queryDocuments('circles', {
        tenantId,
        status: 'active'
      });

      const customerCircles = allCircles.filter(circle =>
        circle.members.some(m => m.customerId === customerId)
      );

      return customerCircles;
    } catch (error) {
      console.error('[CircleService] Error getting customer circles:', error);
      throw error;
    }
  }

  /**
   * Start a collaborative order
   */
  async startCollaborativeOrder(circleId, initiatorPhone, sessionId) {
    await this.firebaseService.initialize();

    try {
      const circle = await this.firebaseService.getDocument('circles', circleId);

      if (!circle) {
        throw new Error('Circle not found');
      }

      const orderData = {
        circleId,
        tenantId: circle.tenantId,
        sessionId,
        initiatedBy: `${circle.tenantId}_${initiatorPhone}`,
        participants: [
          {
            customerId: `${circle.tenantId}_${initiatorPhone}`,
            phone: initiatorPhone,
            joinedAt: new Date().toISOString()
          }
        ],
        items: [],
        total: 0,
        status: 'active',
        splitType: 'equal', // 'equal', 'itemized', or 'custom'
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const collaborativeOrder = await this.firebaseService.createDocument(
        'collaborative_orders',
        orderData
      );

      // Add to circle's active orders
      circle.activeOrders = circle.activeOrders || [];
      circle.activeOrders.push(collaborativeOrder.id);

      await this.firebaseService.updateDocument('circles', circleId, {
        activeOrders: circle.activeOrders
      });

      console.log('[CircleService] Started collaborative order:', collaborativeOrder.id);

      return {
        success: true,
        collaborativeOrder
      };
    } catch (error) {
      console.error('[CircleService] Error starting collaborative order:', error);
      throw error;
    }
  }

  /**
   * Join collaborative order
   */
  async joinCollaborativeOrder(collaborativeOrderId, phone, name) {
    await this.firebaseService.initialize();

    try {
      const order = await this.firebaseService.getDocument(
        'collaborative_orders',
        collaborativeOrderId
      );

      if (!order) {
        throw new Error('Collaborative order not found');
      }

      const customerId = `${order.tenantId}_${phone}`;

      // Check if already participating
      const alreadyJoined = order.participants.some(p => p.customerId === customerId);

      if (!alreadyJoined) {
        order.participants.push({
          customerId,
          phone,
          name,
          joinedAt: new Date().toISOString()
        });

        await this.firebaseService.updateDocument('collaborative_orders', collaborativeOrderId, {
          participants: order.participants
        });
      }

      console.log('[CircleService] Joined collaborative order:', collaborativeOrderId, customerId);

      return {
        success: true,
        order: await this.firebaseService.getDocument('collaborative_orders', collaborativeOrderId)
      };
    } catch (error) {
      console.error('[CircleService] Error joining collaborative order:', error);
      throw error;
    }
  }

  /**
   * Add item to collaborative order
   */
  async addItemToCollaborativeOrder(collaborativeOrderId, phone, item) {
    await this.firebaseService.initialize();

    try {
      const order = await this.firebaseService.getDocument(
        'collaborative_orders',
        collaborativeOrderId
      );

      if (!order) {
        throw new Error('Collaborative order not found');
      }

      const customerId = `${order.tenantId}_${phone}`;

      // Verify participant
      const isParticipant = order.participants.some(p => p.customerId === customerId);
      if (!isParticipant) {
        throw new Error('Customer is not a participant in this order');
      }

      // Add item with owner tracking
      const orderItem = {
        ...item,
        addedBy: customerId,
        addedAt: new Date().toISOString()
      };

      order.items = order.items || [];
      order.items.push(orderItem);
      order.total = (order.total || 0) + (item.price * item.quantity);

      await this.firebaseService.updateDocument('collaborative_orders', collaborativeOrderId, {
        items: order.items,
        total: order.total
      });

      console.log('[CircleService] Added item to collaborative order:', collaborativeOrderId);

      return {
        success: true,
        order: await this.firebaseService.getDocument('collaborative_orders', collaborativeOrderId)
      };
    } catch (error) {
      console.error('[CircleService] Error adding item to collaborative order:', error);
      throw error;
    }
  }

  /**
   * Finalize collaborative order
   */
  async finalizeCollaborativeOrder(collaborativeOrderId) {
    await this.firebaseService.initialize();

    try {
      const order = await this.firebaseService.getDocument(
        'collaborative_orders',
        collaborativeOrderId
      );

      if (!order) {
        throw new Error('Collaborative order not found');
      }

      // Update status
      await this.firebaseService.updateDocument('collaborative_orders', collaborativeOrderId, {
        status: 'finalized',
        finalizedAt: new Date().toISOString()
      });

      // Remove from circle's active orders
      const circle = await this.firebaseService.getDocument('circles', order.circleId);
      if (circle) {
        circle.activeOrders = (circle.activeOrders || []).filter(
          id => id !== collaborativeOrderId
        );

        await this.firebaseService.updateDocument('circles', order.circleId, {
          activeOrders: circle.activeOrders
        });
      }

      console.log('[CircleService] Finalized collaborative order:', collaborativeOrderId);

      return {
        success: true,
        order: await this.firebaseService.getDocument('collaborative_orders', collaborativeOrderId)
      };
    } catch (error) {
      console.error('[CircleService] Error finalizing collaborative order:', error);
      throw error;
    }
  }
}

// Singleton instance
let circleService = null;

export function getCircleService(config) {
  if (!circleService) {
    circleService = new CircleService(config);
  }
  return circleService;
}

export default CircleService;
