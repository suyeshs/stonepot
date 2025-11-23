'use client';

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { X } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';
import { cartStore } from '../../stores/cartStore';
import { CustomerInfo } from './CustomerInfo';
import { OrderTypeSelection } from './OrderTypeSelection';
import { AddressEntry } from './AddressEntry';
import { CheckoutSummary } from './CheckoutSummary';
import { Payment } from './Payment';
import { OrderConfirmation } from './OrderConfirmation';

interface OrderFlowProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  backendUrl: string;
}

export const OrderFlow = observer(function OrderFlow({
  isOpen,
  onClose,
  sessionId,
  backendUrl
}: OrderFlowProps) {
  const [currentStep, setCurrentStep] = useState<'customer' | 'order-type' | 'address' | 'checkout' | 'payment' | 'confirmation'>('customer');

  // Reset flow when opened
  useEffect(() => {
    if (isOpen) {
      // Determine starting step based on what info we already have
      if (!orderStore.customer) {
        setCurrentStep('customer');
      } else if (!orderStore.orderType || orderStore.orderType === 'delivery') {
        // If we have customer but no order type, or order type is delivery, start at order-type
        setCurrentStep('order-type');
      } else {
        // If we have customer and non-delivery order type, start at checkout
        setCurrentStep('checkout');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCustomerInfoComplete = () => {
    setCurrentStep('order-type');
  };

  const handleOrderTypeSelected = () => {
    if (orderStore.orderType === 'delivery') {
      setCurrentStep('address');
    } else {
      setCurrentStep('checkout');
    }
  };

  const handleAddressVerified = () => {
    setCurrentStep('checkout');
  };

  const handleCheckoutConfirm = async () => {
    if (!sessionId) {
      console.error('[OrderFlow] No session ID available');
      return;
    }

    try {
      orderStore.setProcessing(true);

      // Create order via backend
      const response = await fetch(`${backendUrl}/api/restaurant/sessions/${sessionId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: orderStore.customer,
          cart: {
            items: cartStore.items.map(item => ({
              dishName: item.name,
              dishType: item.type,
              quantity: item.quantity,
              price: item.price,
              customization: item.customization
            })),
            subtotal: cartStore.total
          },
          orderType: orderStore.orderType,
          paymentMethod: orderStore.paymentMethod,
          deliveryAddress: orderStore.deliveryAddress,
          specialInstructions: orderStore.specialInstructions
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      // Store order data
      orderStore.setCurrentOrder(data);

      // If online payment, move to payment step
      if (orderStore.paymentMethod === 'online' && data.razorpayOrder) {
        orderStore.setRazorpayOrder(data.razorpayOrder);
        setCurrentStep('payment');
      } else {
        // Cash payment - order is confirmed
        setCurrentStep('confirmation');
      }
    } catch (error) {
      console.error('[OrderFlow] Order creation failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to create order');
    } finally {
      orderStore.setProcessing(false);
    }
  };

  const handlePaymentSuccess = () => {
    setCurrentStep('confirmation');
  };

  const handlePaymentError = (error: any) => {
    console.error('[OrderFlow] Payment error:', error);
    alert('Payment failed. Please try again.');
  };

  const handleNewOrder = () => {
    cartStore.clearCart();
    orderStore.resetOrder();
    setCurrentStep('customer');
    onClose();
  };

  const handleBack = () => {
    if (currentStep === 'order-type') {
      setCurrentStep('customer');
    } else if (currentStep === 'address') {
      setCurrentStep('order-type');
    } else if (currentStep === 'checkout') {
      if (orderStore.orderType === 'delivery') {
        setCurrentStep('address');
      } else {
        setCurrentStep('order-type');
      }
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'customer':
        return (
          <CustomerInfo
            onComplete={handleCustomerInfoComplete}
            backendUrl={backendUrl}
            sessionId={sessionId || ''}
          />
        );

      case 'order-type':
        return (
          <OrderTypeSelection
            onContinue={handleOrderTypeSelected}
            onBack={handleBack}
          />
        );

      case 'address':
        return (
          <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
            <div className="p-6 pb-4">
              <h2 className="text-2xl font-light neu-text tracking-tight">Delivery Address</h2>
              <p className="text-sm neu-text-secondary opacity-60 mt-1">
                Where should we deliver your order?
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6">
              <AddressEntry
                sessionId={sessionId || ''}
                backendUrl={backendUrl}
                onAddressVerified={handleAddressVerified}
              />
            </div>
            <div className="p-6 border-t border-gray-200/50">
              <button
                onClick={handleBack}
                className="w-full text-gray-600 hover:text-gray-900 py-2 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        );

      case 'checkout':
        return (
          <CheckoutSummary
            onConfirm={handleCheckoutConfirm}
            onBack={handleBack}
          />
        );

      case 'payment':
        return (
          <Payment
            backendUrl={backendUrl}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
          />
        );

      case 'confirmation':
        return (
          <OrderConfirmation
            onNewOrder={handleNewOrder}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" />

      {/* Slide-in Panel */}
      <div
        className="ml-auto relative w-full max-w-md h-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Close Button - Only show if not on confirmation */}
        {currentStep !== 'confirmation' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm hover:bg-white/80 flex items-center justify-center transition-all shadow-lg"
            aria-label="Close order flow"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        )}

        {renderStep()}
      </div>
    </div>
  );
});
