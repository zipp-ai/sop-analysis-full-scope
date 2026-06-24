import axios from "axios";
import API_URLS from "../config/apiUrls";
import supabase from "../supabase";

const chatSessionService = {
  uploadChatSession: async ({
    user_id,
    blob_storage_url,
    session_start,
    session_end,
    session_cost = 0.0,  
  }) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await axios.post(
        API_URLS.CHAT_SESSION.UPLOAD,
        { user_id, blob_storage_url, session_start, session_end, session_cost },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error uploading chat log:", error);
      let errorMessage = "Failed to upload chat log.";
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }
      const errorToThrow = new Error(errorMessage);
      errorToThrow.response = error.response;
      throw errorToThrow;
    }
  },
};

export default chatSessionService;
