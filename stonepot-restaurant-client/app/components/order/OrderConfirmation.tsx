'use client';

import { observer } from 'mobx-react-lite';
import { CheckCircle2, MapPin, Clock, CreditCard, Truck, Phone } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';
import { cartStore } from '../../stores/cartStore';

interface OrderConfirmationProps {
  onNewOrder?: () => void;
}

export const OrderConfirmation = observer(function OrderConfirmation({
  onNewOrder
}: OrderConfirmationProps) {
  const order = orderStore.currentOrder;

  if (!order) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-gray-500">No order information available</p>
      </div>
    );
  }

  const handleNewOrder = () => {
    cartStore.clearCart();
    orderStore.resetOrder();
    if (onNewOrder) {
      onNewOrder();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl overflow-y-auto">
      <div className="flex-1 p-6 space-y-6">
        {/* Success Animation */}
        <div className="text-center py-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75" />
            <div className="relative bg-gradient-to-br from-green-500 to-green-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h2 className="text-3xl font-light neu-text mt-6 mb-2">Order Confirmed!</h2>
          <p className="text-gray-600">
            Thank you for your order
          </p>
        </div>

        {/* Order ID */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-100/50 text-center">
          <p className="text-sm text-gray-600 mb-2">Order ID</p>
          <p className="text-2xl font-semibold text-gray-900 font-mono">{order.orderId}</p>
        </div>

        {/* Order Status */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            {order.orderType === 'delivery' ? (
              <Truck className="w-6 h-6" />
            ) : (
              <Clock className="w-6 h-6" />
            )}
            <h3 className="text-lg font-semibold">
              {order.orderType === 'delivery' ? 'Delivery Order' : order.orderType === 'pickup' ? 'Pickup Order' : 'Dine-in Order'}
            </h3>
          </div>
          {order.estimatedDeliveryTime && (
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Clock className="w-4 h-4" />
              Estimated Time: {order.estimatedDeliveryTime}
            </div>
          )}
          {!order.estimatedDeliveryTime && (
            <p className="text-sm opacity-90">
              We'll prepare your order shortly
            </p>
          )}
        </div>

        {/* Delivery Address */}
        {order.orderType === 'delivery' && order.deliveryAddress && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Delivery Address
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {order.deliveryAddress.formatted}
            </p>
          </div>
        )}

        {/* Payment Status */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {order.paymentMethod === 'online' ? 'Paid Online' : `Cash on ${order.orderType === 'delivery' ? 'Delivery' : 'Pickup'}`}
            </span>
            <span className="text-lg font-bold text-gray-900">₹{order.total.toFixed(2)}</span>
          </div>
          {order.paymentMethod === 'online' && (
            <div className="mt-2 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
              ✓ Payment Successful
            </div>
          )}
        </div>

        {/* Order Items Summary */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-3">
            Order Summary ({order.items.length} items)
          </h3>
          <div className="space-y-2">
            {order.items.slice(0, 3).map((item: any, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.quantity}x {item.dishName || item.name}
                </span>
                <span className="text-gray-900 font-medium">
                  ₹{(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-sm text-gray-500 italic">
                +{order.items.length - 3} more items
              </p>
            )}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between font-semibold">
                <span className="text-gray-900">Total</span>
                <span className="text-orange-600">₹{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-blue-50/60 backdrop-blur-sm rounded-2xl p-5 border border-blue-200/50">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Need Help?</h4>
              <p className="text-sm text-blue-700">
                Contact us if you have any questions about your order
              </p>
            </div>
          </div>
        </div>

        {/* Track Order Info */}
        <div className="text-center space-y-2 py-4">
          <p className="text-sm text-gray-600">
            We'll notify you when your order is ready
          </p>
          <p className="text-xs text-gray-500">
            Keep this page for order reference
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200/50 space-y-3">
        <button
          onClick={handleNewOrder}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          Place New Order
        </button>
      </div>
    </div>
  );
});
