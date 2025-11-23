'use client';

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { MapPin, Check, AlertCircle, Clock } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';

interface SavedAddress {
  formatted: string;
  placeId: string | null; // Null for legacy addresses
  coordinates?: { lat: number; lng: number }; // For legacy address migration
  apartment?: string;
  landmark?: string;
  instructions?: string;
  city?: string;
  pincode?: string;
  label: 'home' | 'work' | 'other';
  isDefault: boolean;
  requiresMigration?: boolean; // Flag for legacy addresses
}

// Simplified address display: flat + building + pincode
function getSimplifiedAddress(address: SavedAddress): string {
  const parts = [];
  if (address.apartment) parts.push(address.apartment);
  if (address.landmark) parts.push(address.landmark);
  if (address.pincode) parts.push(address.pincode);
  return parts.join(' • ') || address.formatted;
}

// Get label icon and color
function getLabelStyle(label: string): { icon: string; color: string } {
  switch (label) {
    case 'home':
      return { icon: '🏠', color: 'text-blue-600' };
    case 'work':
      return { icon: '💼', color: 'text-purple-600' };
    default:
      return { icon: '📍', color: 'text-gray-600' };
  }
}

interface AddressEntryProps {
  sessionId: string;
  backendUrl: string;
  onAddressVerified?: () => void;
}

export const AddressEntry = observer(function AddressEntry({
  sessionId,
  backendUrl,
  onAddressVerified
}: AddressEntryProps) {
  const [addressInput, setAddressInput] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [apartment, setApartment] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<'home' | 'work' | 'other'>('other');
  const [setAsDefault, setSetAsDefault] = useState(false);

  // Load saved addresses for returning customers (placeId optimization)
  useEffect(() => {
    const loadSavedAddresses = async () => {
      const customerPhone = orderStore.customer?.phone;
      if (!customerPhone) return;

      try {
        // OPTIMIZATION: First check sessionStorage (populated via WebSocket)
        const cachedAddresses = sessionStorage.getItem('stonepot_saved_addresses');
        if (cachedAddresses) {
          const addresses = JSON.parse(cachedAddresses);
          if (addresses.length > 0) {
            setSavedAddresses(addresses);
            setShowSavedAddresses(true);
            console.log('[AddressEntry] Loaded', addresses.length, 'saved addresses from WebSocket cache');
            // Clear cache after use
            sessionStorage.removeItem('stonepot_saved_addresses');
            return;
          }
        }

        // Fallback: HTTP request if WebSocket hasn't sent addresses yet
        const response = await fetch(
          `${backendUrl}/api/restaurant/sessions/${sessionId}/address-history?phone=${customerPhone}`
        );
        const data = await response.json();

        if (data.success && data.addresses.length > 0) {
          setSavedAddresses(data.addresses);
          setShowSavedAddresses(true);
          console.log('[AddressEntry] Loaded', data.addresses.length, 'saved addresses from HTTP fallback');
        }
      } catch (err) {
        console.error('[AddressEntry] Failed to load saved addresses:', err);
      }
    };

    loadSavedAddresses();
  }, [sessionId, backendUrl, orderStore.customer?.phone]);

  // Quick select saved address (handles both optimized and legacy addresses)
  const handleQuickSelect = async (savedAddress: SavedAddress) => {
    setIsVerifying(true);
    setError(null);

    try {
      let endpoint = '';
      let body = {};

      // Choose endpoint based on whether address has placeId
      if (savedAddress.placeId) {
        // Optimized path: Use placeId (40% cheaper, 50% faster)
        endpoint = `${backendUrl}/api/restaurant/sessions/${sessionId}/quick-address`;
        body = {
          placeId: savedAddress.placeId,
          apartment: savedAddress.apartment,
          landmark: savedAddress.landmark,
          instructions: savedAddress.instructions,
          label: savedAddress.label,
          isDefault: savedAddress.isDefault,
        };
        console.log('[AddressEntry] Using optimized placeId lookup for', savedAddress.label);
      } else if (savedAddress.coordinates) {
        // Legacy path: Migrate address by reverse geocoding coordinates
        endpoint = `${backendUrl}/api/restaurant/sessions/${sessionId}/migrate-address`;
        body = {
          coordinates: savedAddress.coordinates,
          apartment: savedAddress.apartment,
          landmark: savedAddress.landmark,
          instructions: savedAddress.instructions,
          label: savedAddress.label,
          isDefault: savedAddress.isDefault,
        };
        console.log('[AddressEntry] Migrating legacy address to get placeId');
      } else {
        throw new Error('Address has neither placeId nor coordinates');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify address');
      }

      if (!data.eligible) {
        setError(data.message || 'Delivery not available to this address');
        return;
      }

      // Store verified address
      orderStore.setDeliveryAddress({
        formatted: data.address.formatted,
        coordinates: data.address.coordinates,
        placeId: data.address.placeId,
        pincode: data.address.pincode,
        city: data.address.city,
        state: data.address.state,
        apartment: data.address.apartment,
        landmark: data.address.landmark,
        instructions: data.address.instructions,
      });

      orderStore.setDeliveryFee(data.delivery.fee);
      orderStore.setEstimatedDeliveryTime(data.delivery.estimatedTime);

      console.log('[AddressEntry] Used optimized placeId lookup');

      if (onAddressVerified) {
        onAddressVerified();
      }
    } catch (err) {
      console.error('Quick address lookup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify address');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyAddress = async () => {
    if (!addressInput.trim()) {
      setError('Please enter an address');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/restaurant/sessions/${sessionId}/geocode-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addressString: addressInput,
          apartment: apartment || undefined,
          landmark: landmark || undefined,
          pincode: pincode || undefined,
          instructions: instructions || undefined,
          label: selectedLabel,
          isDefault: setAsDefault,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify address');
      }

      if (!data.eligible) {
        setError(data.message || 'Delivery not available to this address');
        return;
      }

      // Store verified address in orderStore
      orderStore.setDeliveryAddress({
        formatted: data.address.formatted,
        coordinates: data.address.coordinates,
        placeId: data.address.placeId,
        pincode: data.address.pincode,
        city: data.address.city,
        state: data.address.state,
        apartment: apartment || undefined,
        landmark: landmark || undefined,
        instructions: instructions || undefined,
      });

      orderStore.setDeliveryFee(data.delivery.fee);
      orderStore.setEstimatedDeliveryTime(data.delivery.estimatedTime);

      if (onAddressVerified) {
        onAddressVerified();
      }
    } catch (err) {
      console.error('Address verification error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify address');
    } finally {
      setIsVerifying(false);
    }
  };

  if (orderStore.isAddressVerified && orderStore.deliveryAddress) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200/50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-green-900 mb-1">Address Verified</h3>
              <p className="text-sm text-green-700 mb-3">
                {orderStore.deliveryAddress.formatted}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="bg-white/80 rounded-lg px-3 py-1.5">
                  <span className="text-green-600">Delivery: </span>
                  <span className="font-medium text-green-900">
                    {orderStore.deliveryFee === 0 ? 'FREE' : `₹${orderStore.deliveryFee}`}
                  </span>
                </div>
                <div className="bg-white/80 rounded-lg px-3 py-1.5">
                  <span className="text-green-600">Time: </span>
                  <span className="font-medium text-green-900">
                    {orderStore.estimatedDeliveryTime}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => orderStore.clearAddress()}
          className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Change address
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Saved Addresses (Optimized with placeId) */}
      {showSavedAddresses && savedAddresses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-600" />
            <label className="text-sm font-medium text-gray-700">
              Quick Select (Optimized)
            </label>
          </div>
          {savedAddresses.map((addr, idx) => {
            const labelStyle = getLabelStyle(addr.label);
            const simplifiedAddress = getSimplifiedAddress(addr);

            return (
              <button
                key={idx}
                onClick={() => handleQuickSelect(addr)}
                disabled={isVerifying}
                className={`w-full text-left p-4 backdrop-blur-sm rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  addr.isDefault
                    ? 'bg-green-50/80 hover:bg-green-100/80 border-green-200/50'
                    : 'bg-orange-50/80 hover:bg-orange-100/80 border-orange-200/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`text-2xl flex-shrink-0 ${labelStyle.color}`}>
                    {labelStyle.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {addr.label}
                      </p>
                      {addr.isDefault && (
                        <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      {simplifiedAddress}
                    </p>
                  </div>
                  <span className={`text-xs font-medium flex-shrink-0 ${addr.isDefault ? 'text-green-600' : 'text-orange-600'}`}>
                    {addr.placeId ? '⚡ Fast' : 'Saved'}
                  </span>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => setShowSavedAddresses(false)}
            className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors py-2"
          >
            Or enter a new address
          </button>
        </div>
      )}

      {/* Manual Address Entry */}
      {(!showSavedAddresses || savedAddresses.length === 0) && (
        <div className="space-y-3">
          {/* Main Address Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Address *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="House no, Street, Area"
                className="w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none"
              />
            </div>
          </div>

        {/* Apartment/Floor */}
        <div>
          <input
            type="text"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            placeholder="Apartment, Floor (optional)"
            className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none"
          />
        </div>

        {/* Landmark */}
        <div>
          <input
            type="text"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="Nearby landmark (optional)"
            className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none"
          />
        </div>

        {/* Pincode */}
        <div>
          <input
            type="text"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="Pincode (optional)"
            maxLength={6}
            className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none"
          />
        </div>

        {/* Delivery Instructions */}
        <div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Delivery instructions (optional)"
            rows={2}
            className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all outline-none resize-none"
          />
        </div>

        {/* Save Address Label */}
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Save this address as:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['home', 'work', 'other'].map((label) => {
              const labelStyle = getLabelStyle(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedLabel(label as 'home' | 'work' | 'other')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    selectedLabel === label
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white/60 hover:border-orange-300'
                  }`}
                >
                  <span className="text-2xl mb-1">{labelStyle.icon}</span>
                  <span className="text-xs font-medium text-gray-700 capitalize">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Set as Default */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">Set as default address</span>
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm rounded-xl p-4 border border-red-200/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Verify Button */}
        <button
          onClick={handleVerifyAddress}
          disabled={isVerifying || !addressInput.trim()}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isVerifying ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying Address...
            </span>
          ) : (
            'Verify Address'
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          We'll check if we deliver to your location
        </p>

        {/* Back to saved addresses */}
        {savedAddresses.length > 0 && (
          <button
            onClick={() => setShowSavedAddresses(true)}
            className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Back to saved addresses
          </button>
        )}
      </div>
      )}
    </div>
  );
});
