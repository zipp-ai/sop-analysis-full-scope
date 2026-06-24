import apiService from './api';
import API_URLS from '../config/apiUrls';

const departmentService = {
  // Get all departments
  getAllDepartments: async () => {
    try {
      // Call the API endpoint to get departments
      const response = await apiService.get(API_URLS.DEPARTMENTS.LIST);
      return response;
    } catch (error) {
      console.error('Error fetching departments:', error);
      
      let errorMessage = 'Failed to fetch departments.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }
      
      // Return a mock list if the API fails
      return {
        departments: [
        "All"
        ]
      };

    }
  }
};

export default departmentService;