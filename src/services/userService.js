import apiService from './api';
import API_URLS from '../config/apiUrls';

const userService = {
  // Get user profile
  getUserProfile: async () => {
    return await apiService.get(API_URLS.USER.PROFILE);
  },

  // Get complete profile data with regulations - OPTIMIZED
  getCompleteProfile: async () => {
    return await apiService.get(API_URLS.USER.PROFILE_COMPLETE);
  },

  // Update user profile
  updateUserProfile: async (userData, userId) => {
    try {
      return await apiService.patch(API_URLS.USER.UPDATE_USER(userId), userData);
    } catch (error) {
      console.error('Error updating user profile:', error);

      let errorMessage = 'Failed to update user profile.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // Get user recent activity
  getRecentActivity: async () => {
    try {
      return await apiService.get(API_URLS.USER.RECENT_ACTIVITY);
    } catch (error) {
      console.error('Error fetching recent activity:', error);

      let errorMessage = 'Failed to fetch recent activity.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // Record user's login time
  recordLoginTime: async () => {
    try {
      return await apiService.post(API_URLS.USER.RECORD_LOGIN);
    } catch (error) {
      console.log("Error logging login time: ", error);

      let errorMessage = "Failed to fetch recent activity.";
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },
  // Other user-related API methods can be added here
  updateOrganizationMetadata: async (orgId, metadata) => {
    try {
      return await apiService.patch(API_URLS.ORGANIZATION.METADATA_UPDATE(orgId), { ...metadata });
    } catch (error) {
      console.error('Error updating organization metadata:', error);

      let errorMessage = 'Failed to update organization metadata.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },
  // Get SOPs count for organization
  getSOPsCount: async () => {
    try {
      return await apiService.get(API_URLS.USER.SOPS_COUNT);
    } catch (error) {
      console.error('Error fetching SOPs count:', error);

      let errorMessage = 'Failed to fetch SOPs count.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // Get regulations count for organization
  getRegulationsCount: async () => {
    try {
      return await apiService.get(API_URLS.USER.REGULATIONS_COUNT);
    } catch (error) {
      console.error('Error fetching regulations count:', error);

      let errorMessage = 'Failed to fetch regulations count.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // Get gap count for organization
  getGapCount: async () => {
    try {
      return await apiService.get(API_URLS.USER.GAP_COUNT);
    } catch (error) {
      console.error('Error fetching gap count:', error);

      let errorMessage = 'Failed to fetch gap count.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },
};

export default userService;