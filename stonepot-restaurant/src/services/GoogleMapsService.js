/**
 * Google Maps Service
 * Handles geocoding, address validation, and distance calculations
 */

import { Client } from '@googlemaps/google-maps-services-js';

export class GoogleMapsService {
  constructor(config) {
    this.apiKey = config.googleMaps?.apiKey;
    this.enabled = config.googleMaps?.geocodingEnabled !== false;

    if (!this.apiKey && this.enabled) {
      console.warn('[GoogleMaps] API key not configured. Geocoding features will be disabled.');
      this.enabled = false;
    }

    this.client = new Client({});
  }

  /**
   * Geocode an address string to coordinates
   * @param {string} addressString - Full address description
   * @param {string} [region='IN'] - Country code for bias
   * @returns {Promise<{lat: number, lng: number, formattedAddress: string}>}
   */
  async geocodeAddress(addressString, region = 'IN') {
    if (!this.enabled) {
      throw new Error('Google Maps geocoding is not enabled');
    }

    try {
      console.log('[GoogleMaps] Geocoding address:', addressString);

      const response = await this.client.geocode({
        params: {
          address: addressString,
          region,
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const location = result.geometry.location;

        console.log('[GoogleMaps] Geocoding successful:', {
          lat: location.lat,
          lng: location.lng,
          formatted: result.formatted_address
        });

        return {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          addressComponents: result.address_components
        };
      } else if (response.data.status === 'ZERO_RESULTS') {
        throw new Error('Address not found. Please provide a more specific address.');
      } else {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }
    } catch (error) {
      console.error('[GoogleMaps] Geocoding error:', error);
      throw new Error(error.message || 'Failed to geocode address');
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<{formattedAddress: string, addressComponents: Array}>}
   */
  async reverseGeocode(lat, lng) {
    if (!this.enabled) {
      throw new Error('Google Maps geocoding is not enabled');
    }

    try {
      console.log('[GoogleMaps] Reverse geocoding:', { lat, lng });

      const response = await this.client.reverseGeocode({
        params: {
          latlng: { lat, lng },
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];

        return {
          formattedAddress: result.formatted_address,
          addressComponents: result.address_components,
          placeId: result.place_id
        };
      } else {
        throw new Error(`Reverse geocoding failed: ${response.data.status}`);
      }
    } catch (error) {
      console.error('[GoogleMaps] Reverse geocoding error:', error);
      throw new Error(error.message || 'Failed to reverse geocode coordinates');
    }
  }

  /**
   * Calculate distance between two coordinates
   * @param {Object} origin - {lat, lng}
   * @param {Object} destination - {lat, lng}
   * @returns {Promise<{distance: number, duration: number, distanceText: string, durationText: string}>}
   */
  async calculateDistance(origin, destination) {
    if (!this.enabled) {
      throw new Error('Google Maps geocoding is not enabled');
    }

    try {
      console.log('[GoogleMaps] Calculating distance:', { origin, destination });

      const response = await this.client.distancematrix({
        params: {
          origins: [`${origin.lat},${origin.lng}`],
          destinations: [`${destination.lat},${destination.lng}`],
          mode: 'driving',
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK' && response.data.rows.length > 0) {
        const element = response.data.rows[0].elements[0];

        if (element.status === 'OK') {
          return {
            distance: element.distance.value / 1000, // Convert meters to km
            duration: element.duration.value / 60, // Convert seconds to minutes
            distanceText: element.distance.text,
            durationText: element.duration.text
          };
        } else {
          throw new Error(`Distance calculation failed: ${element.status}`);
        }
      } else {
        throw new Error(`Distance Matrix API error: ${response.data.status}`);
      }
    } catch (error) {
      console.error('[GoogleMaps] Distance calculation error:', error);
      throw new Error(error.message || 'Failed to calculate distance');
    }
  }

  /**
   * Validate address using Places API autocomplete
   * @param {string} input - Address input text
   * @param {Object} [sessionToken] - Optional session token for billing optimization
   * @returns {Promise<Array>} Array of place predictions
   */
  async autocompleteAddress(input, sessionToken = null) {
    if (!this.enabled) {
      throw new Error('Google Maps Places API is not enabled');
    }

    try {
      console.log('[GoogleMaps] Autocomplete address:', input);

      const params = {
        input,
        key: this.apiKey,
        components: ['country:in'], // Restrict to India
        types: ['address']
      };

      if (sessionToken) {
        params.sessiontoken = sessionToken;
      }

      const response = await this.client.placeAutocomplete({
        params
      });

      if (response.data.status === 'OK') {
        return response.data.predictions.map(prediction => ({
          description: prediction.description,
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text
        }));
      } else if (response.data.status === 'ZERO_RESULTS') {
        return [];
      } else {
        throw new Error(`Places Autocomplete failed: ${response.data.status}`);
      }
    } catch (error) {
      console.error('[GoogleMaps] Autocomplete error:', error);
      return [];
    }
  }

  /**
   * Get place details by place ID
   * @param {string} placeId - Google Place ID
   * @returns {Promise<Object>} Place details including coordinates
   */
  async getPlaceDetails(placeId) {
    if (!this.enabled) {
      throw new Error('Google Maps Places API is not enabled');
    }

    try {
      console.log('[GoogleMaps] Getting place details:', placeId);

      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          fields: ['formatted_address', 'geometry', 'address_components', 'name'],
          key: this.apiKey
        }
      });

      if (response.data.status === 'OK') {
        const result = response.data.result;

        return {
          formattedAddress: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          addressComponents: result.address_components,
          name: result.name
        };
      } else {
        throw new Error(`Place Details failed: ${response.data.status}`);
      }
    } catch (error) {
      console.error('[GoogleMaps] Place details error:', error);
      throw new Error(error.message || 'Failed to get place details');
    }
  }

  /**
   * Extract pincode from address components
   * @param {Array} addressComponents - Google address components
   * @returns {string|null} Pincode/postal code
   */
  extractPincode(addressComponents) {
    const postalCode = addressComponents.find(
      component => component.types.includes('postal_code')
    );
    return postalCode ? postalCode.long_name : null;
  }

  /**
   * Extract city from address components
   * @param {Array} addressComponents - Google address components
   * @returns {string|null} City name
   */
  extractCity(addressComponents) {
    const city = addressComponents.find(
      component => component.types.includes('locality') ||
                  component.types.includes('administrative_area_level_2')
    );
    return city ? city.long_name : null;
  }

  /**
   * Extract state from address components
   * @param {Array} addressComponents - Google address components
   * @returns {string|null} State name
   */
  extractState(addressComponents) {
    const state = addressComponents.find(
      component => component.types.includes('administrative_area_level_1')
    );
    return state ? state.long_name : null;
  }
}

export default GoogleMapsService;
