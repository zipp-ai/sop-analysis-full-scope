import axios from "axios";
import supabase from "../supabase";

// Create axios instance with default config
const api = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for auth token
api.interceptors.request.use(
  async (config) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
  async (response) => {
    // Check for 200 status
    if (response.status === 200) {
      return response;
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// API service methods
const apiService = {
  // GET request
  get: async (url) => {
    try {
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error("API GET Error:", error);

      let errorMessage = "API GET request failed.";
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // POST request
  post: async (url, data, config = {}) => {
    try {
      if (data instanceof FormData) {
        config.headers = {
          ...config.headers,
          "Content-Type": "multipart/form-data",
        };
      }
      const response = await api.post(url, data, config);

      // If responseType is blob, return full response for headers access
      if (config.responseType === "blob") {
        return response;
      }

      return response.data;
    } catch (error) {
      console.error("API POST Error:", error);

      let errorMessage = "API POST request failed.";
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // PUT request
  put: async (url, data, config = {}) => {
    try {
      if (data instanceof FormData) {
        config.headers = {
          ...config.headers,
          "Content-Type": "multipart/form-data",
        };
      }
      const response = await api.put(url, data, config);
      return response.data;
    } catch (error) {
      console.error("API PUT Error:", error);

      let errorMessage = "API PUT request failed.";
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // DELETE request
  delete: async (url) => {
    try {
      const response = await api.delete(url);
      return response.data;
    } catch (error) {
      console.error("API DELETE Error:", error);

      let errorMessage = "API DELETE request failed.";
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // PATCH request - updated to use the api instance with interceptors
  patch: async (url, data, config = {}) => {
    try {
      if (data instanceof FormData) {
        config.headers = {
          ...config.headers,
          "Content-Type": "multipart/form-data",
        };
      }
      const response = await api.patch(url, data, config);
      return response.data;
    } catch (error) {
      console.error(`Error making PATCH request to ${url}:`, error);

      let errorMessage = "API PATCH request failed.";
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },
};

export default apiService;
