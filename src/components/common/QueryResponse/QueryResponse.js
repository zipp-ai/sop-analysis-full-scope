import {User} from "lucide-react";
import "./QueryResponse.css";

const QueryResponse = ({ query, response, timestamp, showOnlyUserMessage = false }) => {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown time";
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="whatsapp-message-container">
      {/* User Query - Right Side */}
      <div className="message-group user-message-group">
        <div className="message-bubble user-bubble">
          <p className="message-text">{query}</p>
          <div className="message-timestamp user-timestamp">
            <span>{formatTimestamp(timestamp)}</span>
          </div>
        </div>
      </div>

      {/* AI Response - Left Side - Only show if we have a response and not showOnlyUserMessage */}
      {!showOnlyUserMessage && response && (
        <div className="message-group ai-message-group">
          <div className="ai-avatar-container">
            <img src="/logoSquare.png" alt="AI Assistant" className="ai-avatar" />
          </div>
          <div className="message-bubble ai-bubble">
            <p className="message-text ai-message-text">{response.answer}</p>
            <div className="message-timestamp ai-timestamp">
              <span>{formatTimestamp(timestamp)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryResponse;