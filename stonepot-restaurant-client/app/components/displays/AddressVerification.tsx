'use client';

import { MapPin, CheckCircle, AlertCircle } from 'lucide-react';

interface AddressVerificationProps {
  data: {
    address: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    verified: boolean;
    deliverable: boolean;
    distance?: number;
    message?: string;
  };
}

export function AddressVerification({ data }: AddressVerificationProps) {
  return (
    <div className="h-full flex items-center justify-center p-8 bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      <div className="max-w-md w-full space-y-6">
        {/* Icon */}
        <div className="text-center">
          <div className="relative inline-block">
            <div className={`relative ${
              data.verified && data.deliverable
                ? 'bg-gradient-to-br from-green-500 to-green-600'
                : data.verified
                ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                : 'bg-gradient-to-br from-red-500 to-red-600'
            } w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg`}>
              {data.verified && data.deliverable ? (
                <CheckCircle className="w-10 h-10 text-white" />
              ) : (
                <AlertCircle className="w-10 h-10 text-white" />
              )}
            </div>
          </div>
          <h2 className="text-2xl font-light neu-text mt-6 mb-2">
            {data.verified && data.deliverable
              ? 'Address Verified'
              : data.verified
              ? 'Address Found'
              : 'Verification Failed'}
          </h2>
        </div>

        {/* Address Card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-1">Address</h3>
              <p className="text-sm text-gray-700">{data.address}</p>
            </div>
          </div>
        </div>

        {/* Details */}
        {data.verified && data.coordinates && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Coordinates</span>
                <span className="text-gray-900 font-mono text-xs">
                  {data.coordinates.lat.toFixed(6)}, {data.coordinates.lng.toFixed(6)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-600">Delivery Available</span>
                <span className={`font-medium ${
                  data.deliverable ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.deliverable ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        {data.message && (
          <div className={`rounded-xl p-4 ${
            data.verified && data.deliverable
              ? 'bg-green-50 border border-green-200'
              : 'bg-orange-50 border border-orange-200'
          }`}>
            <p className={`text-sm ${
              data.verified && data.deliverable
                ? 'text-green-700'
                : 'text-orange-700'
            }`}>
              {data.message}
            </p>
          </div>
        )}

        {/* Action Hint */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {data.verified && data.deliverable
              ? 'You can proceed with your order'
              : data.verified
              ? 'Please provide a different address'
              : 'Please try again or enter manually'}
          </p>
        </div>
      </div>
    </div>
  );
}
