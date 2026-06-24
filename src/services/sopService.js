import apiService from './api';
import API_URLS from '../config/apiUrls';
import axios from 'axios';
import supabase from '../supabase';

const sopService = {
  // Get all SOPs
  getAllSOPs: async () => {
    return await apiService.get(API_URLS.SOP.LIST);
  },

  // Upload a new SOP
  uploadSOP: async (formData) => {
    try {
      // Get the token from supabase
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Make a direct axios call for file upload
      const response = await axios.post(API_URLS.SOP.UPLOAD, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error uploading SOP:', error);
      
      let errorMessage = 'Failed to upload SOP.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }
      
      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },

  // Delete a SOP
  deleteSOP: async (sopId) => {
    try {
      const response = await apiService.delete(`${API_URLS.SOP.DELETE}/${sopId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting SOP:', error);
      
      let errorMessage = 'Failed to delete SOP.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }
      
      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },
  
  // Download a SOP
  downloadSOP: async (sopId, isAiGenerated = false, fileName = '') => {
    try {
      // Get the token from localStorage
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Choose endpoint based on SOP type
      const downloadUrl = `${API_URLS.SOP.DOWNLOAD}/${sopId}`;
      // Make a direct axios call for file download with responseType blob
      const response = await axios.get(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob' // Important for file downloads
      });
      
      // For AI-generated SOPs, we need to handle the download differently
      if (isAiGenerated) {
        // Create a blob URL and trigger download
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        
        // Create a temporary link element to trigger the download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName ? `${fileName}.pdf` : `sop_${sopId}.pdf`; // Use SOP title if provided
        
        // Append to body, click, and cleanup
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Return success response
        return { success: true, message: 'File downloaded successfully' };
      }
      
      return response;
    } catch (error) {
      console.error('Error downloading SOP:', error);
      
      let errorMessage = 'Failed to download SOP.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }
      
      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },
};

export default sopService; 