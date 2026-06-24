import { useState, useEffect, useMemo, useRef } from "react";
import Navigation from "../../common/Navigation/Navigation";
import QueryInput from "../../common/QueryInput/QueryInput";
import QueryResponse from "../../common/QueryResponse/QueryResponse";
import SOPDropdown from "../../common/SOPDropdown/SOPDropdown";
import RegulationDropdown from "../../common/RegulationDropdown/RegulationDropdown";
import { queryAPI,endSessionAPI } from "../../../services/queryAPI";
import "./ChatPage.css";
import toastService from "../../../services/toastService";
import sopService from "../../../services/sopService";
import regulationService from "../../../services/regulationService";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import { MessageCircle, Settings, X, Trash2 } from "lucide-react";
import supabase from "../../../supabase";
import chatSessionService from "../../../services/chatSessionService";
import Modal from "../../common/Modal/Modal";

function ChatPage() {
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSOPs, setSelectedSOPs] = useState([]);
  const [selectedRegulations, setSelectedRegulations] = useState([]);
  const [sops, setSops] = useState([]);
  const [regulations, setRegulations] = useState([]);
  //const [loading, setLoading] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const chatMessagesRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const [loadingSOPs, setLoadingSOPs] = useState(false);
  const [loadingRegulations, setLoadingRegulations] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isEndingSession, setIsEndingSession] = useState(false);


  const [sessionTimestamp, setSessionTimestamp] = useState(() => {
    return sessionStorage.getItem("chatSessionTimestamp") || null;
  });

  const [sessionStart, setSessionStart] = useState(() => {
    return sessionStorage.getItem("chatSessionStart") || null;
  });
  // Auto-scroll to bottom function
  const scrollToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  };

  useEffect(() => {
  const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id) {
        setUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  // Clear chat due to inactivity
  const clearChatDueToInactivity = () => {
    if (chatHistory.length > 0) {
      setChatHistory([]);
      setError(null);
      toastService.info("Chat cleared due to inactivity");
    }
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Only set timer if there are messages in chat
    if (chatHistory.length > 0) {
      // Set new timer for 5 minutes (300000 ms)
      inactivityTimerRef.current = setTimeout(() => {
        clearChatDueToInactivity();
      }, 5 * 60 * 1000);
    }
  };

  // Activity event handlers
  const handleUserActivity = () => {
    resetInactivityTimer();
  };

  // Set up inactivity timer when chat history changes
  useEffect(() => {
    resetInactivityTimer();
    
    // Clean up timer on unmount
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [chatHistory.length]);

  // Set up activity listeners
  useEffect(() => {
    const events = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // Cleanup event listeners
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, []);

  // Scroll to bottom when chat history changes or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  useEffect(() => {
    const fetchSOPs = async () => {
      setLoadingSOPs(true);
      try {
        const data = await sopService.getAllSOPs();
        setSops(data.sops_data);
      } catch (e) {
        setSops([]);
      } finally {
        setLoadingSOPs(false);
      }
    };
    fetchSOPs();
  }, []);

  useEffect(() => {
    const fetchRegulations = async () => {
      setLoadingRegulations(true);
      try {
        const data = await regulationService.getOrganizationRegulations();
        // Extract regulation details from the combined response
        const regulationDetails = Array.isArray(data)
          ? data.map((item) => ({
              ...item.regulation_details,
              id: item.regulation_id,
              blob_file_name:
                item.regulation_details?.name || item.regulation_details?.title,
            }))
          : [];
        setRegulations(regulationDetails);
      } catch (e) {
        console.error("Error fetching regulations:", e);
        setRegulations([]);
      } finally {
        setLoadingRegulations(false);
      }
    };
    fetchRegulations();
  }, []);

  useEffect(() => {
    const savedHistory = sessionStorage.getItem('chatHistory');
    if (savedHistory) {
      setChatHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
  if (sessionTimestamp) {
      sessionStorage.setItem("chatSessionTimestamp", sessionTimestamp);
    }
  }, [sessionTimestamp]);

  const { allowedSOPTitles, allowedRegulationTitles, titleToBlobMap } = useMemo(() => {
    const mapping = {};
    const sopTitles = [];
    const regulationTitles = [];
    sops.forEach((sop) => {
      if (sop.title && sop.blob_file_name) {
        mapping[sop.title] = sop.blob_file_name;
        sopTitles.push(sop.title);
      }
    });

    regulations.forEach((regulation) => {
        const title = regulation.title || regulation.name;
        const blobFileName =
          regulation.blob_file_name || regulation.name || regulation.title;
        if (title && blobFileName) {
          mapping[title] = blobFileName;
          regulationTitles.push(title);
        }
      });
    return { allowedSOPTitles: sopTitles,
        allowedRegulationTitles: regulationTitles,
        titleToBlobMap: mapping, };
  }, [sops,regulations]);

  const handleQuery = async (query) => {
    // Reset inactivity timer on new message
    resetInactivityTimer();
    
    // Add user message immediately to chat history
    const userMessage = {
      query,
      response: null, // We'll fill this later
      timestamp: new Date().toISOString(),
      isUserMessage: true,
    };

    // When adding new messages, limit history to last 5 turns
    setChatHistory(prevHistory => {
      const newHistory = [...prevHistory, userMessage];
      // Keep only the most recent 5 turns (5 user messages + 5 responses)
      if (newHistory.length > 5) {
        return newHistory.slice(newHistory.length - 5);
      }
      return newHistory;
    });
    setIsLoading(true);
    setError(null);

    try {
      if (!sessionStart) {
        const start = new Date().toISOString();
        setSessionStart(start);
        sessionStorage.setItem("chatSessionStart", start);
      }
      if (!sessionTimestamp) {
        const ts = new Date()
          .toISOString()
          .replace(/[-:.TZ]/g, "")
          .slice(0, 14); // yyyymmddhhmmss
        setSessionTimestamp(ts);
      }
      // Extract titles from selected objects
      const selectedSOPTitles = selectedSOPs.map(sop => sop.title);
      const selectedRegulationTitles = selectedRegulations.map(reg => reg.title || reg.name);
      const allSelectedTitles = [...selectedSOPTitles, ...selectedRegulationTitles];
      const allAvailableTitles = [
        ...allowedSOPTitles,
        ...allowedRegulationTitles,
      ];

      const filterTitles =
        allSelectedTitles.length > 0 ? allSelectedTitles : allAvailableTitles;

      const filterBlobNames = filterTitles
        .map((title) => titleToBlobMap[title])
        .filter(Boolean);

      const blobToTitleMapping = {};
      Object.entries(titleToBlobMap).forEach(([title, blobName]) => {
        blobToTitleMapping[blobName] = title;
      });

      // Use existing chat history (excluding the current message) for API context
      const historyForAPI = chatHistory.map((turn) => ({
        user_query: turn.query,
        bot_answer: turn.response?.answer || "",
      }));

      // Use the latest sessionTimestamp (from state or just set)
      const tsToSend =
        sessionTimestamp ||
        new Date()
          .toISOString()
          .replace(/[-:.TZ]/g, "")
          .slice(0, 14);

      const result = await queryAPI(
        query,
        userId,
        filterBlobNames,
        historyForAPI,
        blobToTitleMapping,
        tsToSend
      );

      // Update the last message with the AI response
      setChatHistory((prevHistory) => {
        const newHistory = [...prevHistory];
        const lastIndex = newHistory.length - 1;
        newHistory[lastIndex] = {
          ...newHistory[lastIndex],
          response: result,
          isUserMessage: false,
        };
        return newHistory;
      });

    } catch (err) {
      setError(err.message || "An error occurred while processing your query");
      console.error("Query error:", err);
      toastService.error("Error processing your query");
      
      // Remove the incomplete message on error
      setChatHistory((prevHistory) => prevHistory.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSOPToggle = (sop) => {
    const isSelected = selectedSOPs.some(s => s.id === sop.id);
    if (isSelected) {
      setSelectedSOPs(selectedSOPs.filter(s => s.id !== sop.id));
    } else {
      setSelectedSOPs([...selectedSOPs, sop]);
    }
  };

  const handleRegulationToggle = (regulation) => {
    const isSelected = selectedRegulations.some(r => r.id === regulation.id);
    if (isSelected) {
      setSelectedRegulations(selectedRegulations.filter(r => r.id !== regulation.id));
    } else {
      setSelectedRegulations([...selectedRegulations, regulation]);
    }
  };

  const handleCloseChat = () => {
    if (chatHistory.length > 0) {
      setShowCloseConfirmation(true);
    }
  };

  const handleEndSession = async () => {
    if (!userId || !sessionStart) {
      toastService.error("No active session to end.");
      return;
    }
    setIsEndingSession(true);
    try {
      // 1. Set session end time
      const sessionEnd = new Date().toISOString();
      // 2. Call backend to end session and upload log, get actual blob URL
      const endSessionResponse = await endSessionAPI(userId, sessionTimestamp);
      const blob_storage_url = endSessionResponse?.blob_url;
      const session_cost = endSessionResponse?.session_cost || 0.0;
      if (!blob_storage_url) {
        throw new Error("Failed to get blob URL from backend.");
      }
      // 3. Upload metadata to Supabase via backend
      await chatSessionService.uploadChatSession({
        user_id: userId,
        blob_storage_url,
        session_start: sessionStart,
        session_end: sessionEnd,
        session_cost: session_cost,
      });
      // toastService.success("Session ended successfully!");
      setChatHistory([]);
      setSessionStart(null);
      setSessionTimestamp(null);
      sessionStorage.removeItem("chatHistory");
      sessionStorage.removeItem("chatSessionStart");
      sessionStorage.removeItem("chatSessionTimestamp");
    } catch (err) {
      toastService.error(
        err?.response?.data?.detail ||
          err.message ||
          "Failed to end session or upload log."
      );
    } finally {
      setIsEndingSession(false);
    }
  };

  const confirmCloseChat = () => {
    setChatHistory([]);
    setError(null);
    setShowCloseConfirmation(false);
    handleEndSession();
    
    // Clear inactivity timer since chat is manually cleared
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    toastService.success("Chat cleared successfully");
  };

  const cancelCloseChat = () => {
    setShowCloseConfirmation(false);
  };

  const handleStarterQuestion = (question) => {
    // Remove quotes from the question
    const cleanQuestion = question.replace(/^"/, '').replace(/"$/, '');
    handleQuery(cleanQuestion);
  };

  return (
    <div className="whatsapp-chat-page">
      <Navigation />
      
      {/* WhatsApp-style Chat Header */}
      <div className="chat-header">
        <div className="chat-header-content">
          <div className="chat-header-info">
            <img src="/logoSquare.png" alt="AI Assistant" className="header-avatar" />
            <div className="header-text">
              <h3 className="header-title">Compliance Assistant</h3>
              <p className="header-subtitle">
                {isLoading ? "Typing..." : "Ask about SOPs & Regulations"}
              </p>
            </div>
          </div>
          <div className="chat-header-actions">
            {chatHistory.length > 0 && (
              <button 
                className="header-action-btn close-chat-btn" 
                onClick={handleCloseChat}
                title="Clear Chat"
              >
                Clear Chat
              </button>
            )}
           
          </div>
        </div>
      </div>

      {/* Close Confirmation Modal */}
      {showCloseConfirmation && (
        <div className="modal-overlay">
          <div className="close-confirmation-modal">
            <div className="modal-header">
              <h3>Clear Chat History?</h3>
              <button 
                className="modal-close-btn"
                onClick={cancelCloseChat}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <p>Are you sure you want to clear all messages? 
                <br/>This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-btn cancel-btn"
                onClick={cancelCloseChat}
              >
                Cancel
              </button>
              <button 
                className="modal-btn confirm-btn"
                onClick={confirmCloseChat}
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <div className="error-bubble">
            <p>⚠️ {error}</p>
          </div>
        </div>
      )}

      {/* Chat Container */}
      <div className="whatsapp-chat-container">
        
        {/* Welcome Message or Chat History */}
        <div className="chat-messages" ref={chatMessagesRef}>
          {chatHistory.length === 0 && !isLoading && !error ? (
            <div className="welcome-message-container">
              <div className="welcome-message-bubble">
                <p className="welcome-text">
                  I'm here to help you with questions about your SOPs and regulations. 
                  You can filter responses by selecting specific documents below.
                </p>
                
                <div className="sop-dropdown-container">
                  <SOPDropdown
                    sops={sops}
                    selectedSOPs={selectedSOPs}
                    onSOPToggle={handleSOPToggle}
                    loading={loadingSOPs}
                    placeholder="Select SOPs"
                    isChatPage={true}
                  />
                  <RegulationDropdown
                    regulations={regulations}
                    selectedRegulations={selectedRegulations}
                    onRegulationToggle={handleRegulationToggle}
                    loading={loadingRegulations}
                    placeholder="Select Regulations"
                    isChatPage={true}
                  />
                </div>

                {(selectedSOPs.length > 0 || selectedRegulations.length > 0) && (
                  <div className="filter-status">
                    <p className={`filter-indicator${selectedSOPs.length === 0 ? " empty" : ""}`}>
                      {selectedSOPs.length > 0 && (
                        <>{selectedSOPs.length} SOPs selected</>
                      )}
                    </p>
                    <p className={`filter-indicator${selectedRegulations.length === 0 ? " empty" : ""}`}>

                    {selectedRegulations.length > 0 && (
                          <>{selectedRegulations.length} Regulations selected</>
                        )}
                        </p>
                  </div>
                )}

                <div className="welcome-starter">
                  <p>Try asking something like:</p>
                  <div className="starter-questions">
                    <span onClick={() => handleStarterQuestion("What are the key compliance requirements?")}>"What are the key compliance requirements?"</span>
                    <span onClick={() => handleStarterQuestion("How should I handle data privacy?")}>"How should I handle data privacy?"</span>
                    <span onClick={() => handleStarterQuestion("What are the audit procedures?")}>"What are the audit procedures?"</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {chatHistory.map((chat, index) => (
                <QueryResponse
                  key={index}
                  query={chat.query}
                  response={chat.response}
                  timestamp={chat.timestamp}
                  showOnlyUserMessage={chat.response === null}
                />
              ))}
              
              {isLoading && (
                <div className="typing-indicator">
                  <div className="ai-avatar-container">
                    <img src="/logoSquare.png" alt="AI Assistant" className="ai-avatar" />
                  </div>
                  <div className="typing-bubble">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
               <QueryInput
                  onSubmit={handleQuery}
                  isLoading={isLoading}
                  onEndSession={handleEndSession}
                  showEndSession={!!sessionTimestamp}
               />
            </>
          )}
        </div>


        {/* Input Area */}
        <QueryInput onSubmit={handleQuery} isLoading={isLoading} />
      </div>
    </div>
  );
}

export default ChatPage;