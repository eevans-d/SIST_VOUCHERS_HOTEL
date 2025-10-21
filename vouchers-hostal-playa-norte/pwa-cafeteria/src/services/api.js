import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class APIService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para agregar token y correlation ID
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        config.headers['x-correlation-id'] = uuidv4();
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor para manejo de errores
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expirado o inválido
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async checkHealth() {
    try {
      const response = await this.client.get('/health');
      return { online: true, data: response.data };
    } catch (error) {
      return { online: false, error: error.message };
    }
  }

  // ============================================
  // VOUCHERS
  // ============================================

  async validateVoucher(code, hmac = null) {
    const response = await this.client.post('/vouchers/validate', {
      code,
      hmac
    });
    return response.data;
  }

  async redeemVoucher(code, cafeteria_id, device_id) {
    const response = await this.client.post('/vouchers/redeem', {
      code,
      cafeteria_id,
      device_id,
      local_timestamp: new Date().toISOString()
    });
    return response.data;
  }

  async getVoucher(code) {
    const response = await this.client.get(`/vouchers/${code}`);
    return response.data;
  }

  // ============================================
  // SYNC
  // ============================================

  async syncRedemptions(device_id, redemptions) {
    const response = await this.client.post('/sync/redemptions', {
      device_id,
      redemptions
    });
    return response.data;
  }

  async getSyncHistory(device_id, limit = 50) {
    const response = await this.client.get('/sync/history', {
      params: { device_id, limit }
    });
    return response.data;
  }

  // ============================================
  // AUTH
  // ============================================

  async login(username, password) {
    const response = await this.client.post('/auth/login', {
      username,
      password
    });
    
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user_data', JSON.stringify(response.data.user));
    }
    
    return response.data;
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }

  getCurrentUser() {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }
}

export const apiService = new APIService();