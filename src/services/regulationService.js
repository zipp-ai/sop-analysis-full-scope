import apiService from './api';
import API_URLS from '../config/apiUrls';

const regulationService = {
  // Get all regulations for the organization
  getOrganizationRegulations: async () => {
    return await apiService.get(API_URLS.REGULATIONS.ORGANIZATION);
  },
};

export default regulationService; 