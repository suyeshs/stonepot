import { makeAutoObservable } from 'mobx';

export interface DeliveryAddress {
  formatted: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeId?: string;
  pincode?: string;
  city?: string;
  state?: string;
  apartment?: string;
  landmark?: string;
  instructions?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
}

export interface OrderData {
  orderId: string;
  customer: CustomerInfo;
  items: any[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  orderType: 'delivery' | 'pickup' | 'dine-in';
  paymentMethod: 'online' | 'cash';
  deliveryAddress?: DeliveryAddress;
  deliveryTime?: string;
  specialInstructions?: string;
  estimatedDeliveryTime?: string;
  status: string;
  createdAt: number;
}

export interface RazorpayOrderData {
  id: string;
  amount: number;
  currency: string;
  keyId: string;
}

class OrderStore {
  // Customer information
  customer: CustomerInfo | null = null;

  // Delivery address
  deliveryAddress: DeliveryAddress | null = null;
  isAddressVerified: boolean = false;
  deliveryFee: number = 0;
  estimatedDeliveryTime: string = '';

  // Order configuration
  orderType: 'delivery' | 'pickup' | 'dine-in' = 'delivery';
  paymentMethod: 'online' | 'cash' = 'online';
  specialInstructions: string = '';
  deliveryTime: string = '';

  // Order state
  currentOrder: OrderData | null = null;
  razorpayOrder: RazorpayOrderData | null = null;

  // UI state
  isProcessing: boolean = false;
  error: string | null = null;
  currentStep: 'address' | 'checkout' | 'payment' | 'confirmation' = 'address';

  constructor() {
    makeAutoObservable(this);
  }

  // Customer actions
  setCustomer(customer: CustomerInfo) {
    this.customer = customer;
  }

  // Address actions
  setDeliveryAddress(address: DeliveryAddress) {
    this.deliveryAddress = address;
    this.isAddressVerified = true;
  }

  setDeliveryFee(fee: number) {
    this.deliveryFee = fee;
  }

  setEstimatedDeliveryTime(time: string) {
    this.estimatedDeliveryTime = time;
  }

  clearAddress() {
    this.deliveryAddress = null;
    this.isAddressVerified = false;
    this.deliveryFee = 0;
    this.estimatedDeliveryTime = '';
  }

  // Order configuration
  setOrderType(type: 'delivery' | 'pickup' | 'dine-in') {
    this.orderType = type;
    if (type !== 'delivery') {
      this.clearAddress();
    }
  }

  setPaymentMethod(method: 'online' | 'cash') {
    this.paymentMethod = method;
  }

  setSpecialInstructions(instructions: string) {
    this.specialInstructions = instructions;
  }

  setDeliveryTime(time: string) {
    this.deliveryTime = time;
  }

  // Order flow
  setCurrentStep(step: 'address' | 'checkout' | 'payment' | 'confirmation') {
    this.currentStep = step;
  }

  setCurrentOrder(order: OrderData) {
    this.currentOrder = order;
  }

  setRazorpayOrder(razorpayOrder: RazorpayOrderData) {
    this.razorpayOrder = razorpayOrder;
  }

  // Processing state
  setProcessing(isProcessing: boolean) {
    this.isProcessing = isProcessing;
  }

  setError(error: string | null) {
    this.error = error;
  }

  // Validation
  get isReadyForCheckout(): boolean {
    if (!this.customer) return false;
    if (this.orderType === 'delivery' && !this.isAddressVerified) return false;
    return true;
  }

  get canPlaceOrder(): boolean {
    return this.isReadyForCheckout && !this.isProcessing;
  }

  // Reset
  resetOrder() {
    this.customer = null;
    this.deliveryAddress = null;
    this.isAddressVerified = false;
    this.deliveryFee = 0;
    this.estimatedDeliveryTime = '';
    this.orderType = 'delivery';
    this.paymentMethod = 'online';
    this.specialInstructions = '';
    this.deliveryTime = '';
    this.currentOrder = null;
    this.razorpayOrder = null;
    this.isProcessing = false;
    this.error = null;
    this.currentStep = 'address';
  }
}

export const orderStore = new OrderStore();
