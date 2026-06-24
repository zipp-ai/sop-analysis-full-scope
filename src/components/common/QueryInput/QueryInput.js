import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import "./QueryInput.css";

const QueryInput = ({ onSubmit, isLoading, onEndSession, showEndSession  }) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSubmit(query.trim());
      setQuery("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="whatsapp-input-container">
      <form onSubmit={handleSubmit} className="whatsapp-input-form">
        <div className="input-wrapper">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="whatsapp-input-field"
            disabled={isLoading}
            rows={1}
            style={{
              // height: '22px !important',
              maxHeight: '100px',
              resize: 'none',
              overflow: query.length > 50 ? 'auto' : 'hidden',
              minHeight: '22px !important'
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="whatsapp-send-button"
          >
            {isLoading ? (
              <Loader2 className="send-icon spin" />
            ) : (
              <Send className="send-icon" />
            )}
          </button>
          {showEndSession && (
          <button
            type="button"
            className="end-session-btn"
            onClick={onEndSession}
            disabled={isLoading}
            style={{ marginLeft: 8 }}
          >
            End Session
          </button>
        )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", justifyContent: "center" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            fill="none"
            viewBox="0 0 24 24"
            style={{ color: "#6366f1", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
            <rect x="11" y="10" width="2" height="6" rx="1" fill="currentColor"/>
            <rect x="11" y="7" width="2" height="2" rx="1" fill="currentColor"/>
          </svg>
          <span style={{ fontSize: "10px", color: "#6b7280" }}>
            AI can make mistakes. Check important info.
          </span>
        </div>

      </form>
    </div>
  );
};

export default QueryInput;