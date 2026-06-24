import API_URLS from "../config/apiUrls";
import apiService from "./api";

export const queryAPI = async (
  query,
  userId = null,
  filterTitles = null,
  chatHistory = [],
  blobToTitleMapping = null,
  sessionTimestamp = null
) => {
  try {
    const requestBody = {
      query,
      user_id: userId,
      filter_titles: [],
      chat_history: [],
    };

    // Add filter titles if provided
    if (filterTitles && filterTitles.length > 0) {
      requestBody.filter_titles = filterTitles;
    }

    // Add chat history if provided
    if (chatHistory && chatHistory.length > 0) {
      requestBody.chat_history = chatHistory;
    }

    // Add blob to title mapping if provided
    if (blobToTitleMapping) {
      requestBody.blob_to_title_mapping = blobToTitleMapping;
    }

    // Add session timestamp if provided
    if (sessionTimestamp) {
      requestBody.session_timestamp = sessionTimestamp;
    }
    const response = await apiService.post(API_URLS.CHAT.QUERY, requestBody);
    return response;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const endSessionAPI = async (userId, sessionTimestamp) => {
  try {
    const requestBody = {
      user_id: userId,
      session_timestamp: sessionTimestamp,
    };
    const response = await apiService.post(API_URLS.CHAT.END_SESSION,requestBody);
    return response;
  } catch (error) {
    console.error("End Session API Error:", error);
    throw error;
  }
};
