'use client';

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { User, Phone, Mail } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';

interface CustomerInfoProps {
  onComplete: () => void;
  backendUrl: string;
  sessionId: string;
}

export const CustomerInfo = observer(function CustomerInfo({
  onComplete,
  backendUrl,
  sessionId
}: CustomerInfoProps) {
  const [name, setName] = useState(orderStore.customer?.name || '');
  const [phone, setPhone] = useState(orderStore.customer?.phone || '');
  const [email, setEmail] = useState(orderStore.customer?.email || '');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const validatePhone = (phone: string): boolean => {
    // Indian phone number validation (10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  const handleContinue = async () => {
    const newErrors: { name?: string; phone?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(phone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // SINGLE SOURCE OF TRUTH: Sync to backend, which will broadcast to WebSocket
    // The WebSocket listener will update orderStore automatically
    if (sessionId && backendUrl) {
      try {
        const response = await fetch(`${backendUrl}/api/restaurant/sessions/${sessionId}/customer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined
          })
        });

        if (!response.ok) {
          throw new Error('Failed to sync customer info');
        }

        console.log('[CustomerInfo] Customer synced to backend - WebSocket will update orderStore');
      } catch (error) {
        console.error('[CustomerInfo] Failed to sync customer info:', error);
        // Fallback: Update local store if backend sync fails
        orderStore.setCustomer({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined
        });
      }
    } else {
      // No backend session - update local store directly
      orderStore.setCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined
      });
    }

    onComplete();
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 pb-4">
        <h2 className="text-2xl font-light neu-text tracking-tight">Your Details</h2>
        <p className="text-sm neu-text-secondary opacity-60 mt-1">
          We need a few details to confirm your order
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              placeholder="John Doe"
              className={`w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border ${
                errors.name ? 'border-red-300' : 'border-gray-200'
              } focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none`}
            />
          </div>
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPhone(value);
                if (errors.phone) setErrors({ ...errors, phone: undefined });
              }}
              placeholder="9876543210"
              maxLength={10}
              className={`w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border ${
                errors.phone ? 'border-red-300' : 'border-gray-200'
              } focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none`}
            />
          </div>
          {errors.phone && (
            <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Email (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email (Optional)
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none"
            />
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50/60 backdrop-blur-sm rounded-xl p-4 border border-blue-200/50">
          <p className="text-sm text-blue-700">
            We'll use this information to update you about your order status
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200/50">
        <button
          onClick={handleContinue}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  );
});
