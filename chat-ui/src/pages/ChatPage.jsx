import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import botIcon from '../assets/ss (1).svg';
import newCompassIcon from '../assets/2.svg';
import ThemeToggle from '../components/ThemeToggle';
import ReactMarkdown from 'react-markdown';


const getApiBaseUrl = () => {
  if (import.meta.env.PROD) return '';
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
};
const API_BASE_URL = getApiBaseUrl();
const STREAM_URL = `${API_BASE_URL}/api/chat/stream`;
const LEGACY_URL = `${API_BASE_URL}/api/chat`;

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const isArabic = (text) => ARABIC_RE.test(text);

const SUGGESTIONS = [
  'ما الفرق بين شحن FCL و LCL؟',
  'ما هي وظائف بوليصة الشحن؟',
  'ما المقصود بوحدة القياس TEU؟',
  'ما هي أنواع السفن التجارية؟',
];

function SendIcon() {
  return (
    <svg className="send-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function WelcomeScreen({ onSuggestionClick }) {
  return (
    <div className="welcome">
      <div className="welcome-icon">
        <img src={newCompassIcon} alt="compass" className="welcome-compass-img" />
      </div>
      <h2>مرحباً بك على متن رحلتنا المعرفية في أساسيات النقل البحري</h2>
      <p>حدد وجهتك بسؤال، وسأبحر بك في النصوص لاستخراج الإجابة الدقيقة مباشرة</p>
      <div className="welcome-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="suggestion-chip" onClick={() => onSuggestionClick(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const dir = isArabic(message.text) ? 'rtl' : 'ltr';

  return (
    <div className={`message-row ${message.role}`}>
      {message.role === 'bot' && (
        <div className="message-avatar">
          <img src={botIcon} alt="bot" className="bot-avatar-img" />
        </div>
      )}
      <div className="message-bubble" dir={dir}>
        {message.role === 'bot' ? (
          <ReactMarkdown
            components={{
              strong: ({ node, ...props }) => <strong style={{ color: '#3C91E6', fontWeight: 'bold' }} {...props} />,
            }}
          >
            {message.text}
          </ReactMarkdown>
        ) : (
          message.text
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-row">
      <div className="message-avatar" style={{ background: 'transparent', border: 'none' }}>
        <img src={botIcon} alt="bot" className="bot-avatar-img" />
      </div>
      <div className="typing-bubble">
        <div className="typing-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

function ErrorBubble({ text }) {
  return (
    <div className="message-row error">
      <div className="message-bubble">⚠️ {text}</div>
    </div>
  );
}

/**
 * Parses NDJSON lines from a string and dispatches callbacks.
 */
function processNDJSONLines(text, { onSources, onChunk, onDone, onError }) {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const data = JSON.parse(trimmed);
      if (data.type === 'sources' && onSources) onSources(data.sources);
      else if (data.type === 'chunk' && onChunk) onChunk(data.text);
      else if (data.type === 'done' && onDone) onDone(data.model);
      else if (data.type === 'error' && onError) onError(data.message);
    } catch {
      // Skip malformed JSON lines
    }
  }
}

/**
 * Reads an NDJSON stream with a fallback for mobile browsers.
 * 
 * Strategy:
 *   1. Try ReadableStream (getReader) — works for streaming on desktop.
 *   2. Fallback to response.text() — works universally (mobile, ngrok, proxies)
 *      but waits for the full response before rendering.
 */
async function readNDJSONStream(response, callbacks) {
  // Fallback: if body or getReader isn't available, read as text
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    processNDJSONLines(text, callbacks);
    return;
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed);
          if (data.type === 'sources' && callbacks.onSources) callbacks.onSources(data.sources);
          else if (data.type === 'chunk' && callbacks.onChunk) callbacks.onChunk(data.text);
          else if (data.type === 'done' && callbacks.onDone) callbacks.onDone(data.model);
          else if (data.type === 'error' && callbacks.onError) callbacks.onError(data.message);
        } catch {
          // Skip malformed JSON
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer.trim());
        if (data.type === 'chunk' && callbacks.onChunk) callbacks.onChunk(data.text);
        else if (data.type === 'done' && callbacks.onDone) callbacks.onDone(data.model);
      } catch {
        // ignore
      }
    }

    reader.releaseLock();
  } catch (streamErr) {
    // If streaming fails mid-way (e.g. mobile browser issue), try text fallback
    console.warn('Stream reader failed, trying text fallback:', streamErr);
    try {
      const text = await response.text();
      processNDJSONLines(text, callbacks);
    } catch {
      // response already consumed — nothing we can do
      if (callbacks.onError) {
        callbacks.onError('حدث خطأ أثناء تلقي الرد. حاول مرة أخرى.');
      }
    }
  }
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pendingRequests, setPendingRequests] = useState(0);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingRequests]);

  const sendMessage = async (text) => {
    const question = text.trim();
    if (!question) return;

    const userMsg = { role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPendingRequests((prev) => prev + 1);

    const fetchHeaders = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };
    const body = JSON.stringify({ question });

    try {
      // ── Attempt 1: Streaming endpoint ──────────────────────────────
      let gotText = false;

      try {
        const res = await fetch(STREAM_URL, {
          method: 'POST',
          headers: fetchHeaders,
          body,
        });

        // If response is HTML (ngrok interstitial), skip straight to fallback
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || ct.includes('text/html')) {
          throw new Error('non-stream response');
        }

        // Add placeholder bot message
        setMessages((prev) => [...prev, { role: 'bot', text: '', sources: [] }]);

        await readNDJSONStream(res, {
          onSources: (sources) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'bot') updated[updated.length - 1] = { ...last, sources };
              return updated;
            });
          },
          onChunk: (chunkText) => {
            gotText = true;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'bot') {
                updated[updated.length - 1] = { ...last, text: last.text + chunkText };
              }
              return updated;
            });
          },
          onDone: () => {},
          onError: (errorMsg) => {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'error', text: errorMsg };
              return updated;
            });
            gotText = true; // prevent fallback on intentional error
          },
        });

        // If stream completed but produced no text, throw to trigger fallback
        if (!gotText) {
          throw new Error('empty-stream');
        }

        // Clean up
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'bot') {
            updated[updated.length - 1] = {
              ...last,
              text: last.text.replace(/%/g, '').replace(/\|\|\|/g, ''),
            };
          }
          return updated;
        });

      } catch (streamErr) {
        // ── Attempt 2: Non-streaming fallback ──────────────────────────
        console.warn('Streaming failed, using legacy endpoint:', streamErr.message);

        // Remove the empty bot placeholder if it was added
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'bot' && !last.text) return prev.slice(0, -1);
          return prev;
        });

        const res = await fetch(LEGACY_URL, {
          method: 'POST',
          headers: fetchHeaders,
          body,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.detail || `Server error (${res.status})`);
        }

        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'bot',
            text: data.answer || 'لم يتم العثور على إجابة.',
            sources: data.sources || [],
          },
        ]);
      }

    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: err.message || 'فشل الاتصال بالخادم' },
      ]);
    } finally {
      setPendingRequests((prev) => Math.max(0, prev - 1));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const inputDir = isArabic(input) ? 'rtl' : 'ltr';

  return (
    <div className="app">
      <header className="header">
        <button className="back-btn" onClick={() => navigate('/')} title="العودة للرئيسية">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div className="header-title">
          <h1>المساعد اللوجستي البحري</h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && pendingRequests === 0 && (
            <WelcomeScreen onSuggestionClick={sendMessage} />
          )}

          {messages.map((msg, i) =>
            msg.role === 'error' ? (
              <ErrorBubble key={i} text={msg.text} />
            ) : (
              <MessageBubble key={i} message={msg} />
            )
          )}

          {pendingRequests > 0 && messages[messages.length - 1]?.role !== 'bot' && <TypingIndicator />}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <div className="input-field-container">
            <input
              ref={inputRef}
              className="input-field"
              type="text"
              dir={inputDir}
              placeholder="اكتب سؤالك هنا..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </div>
          <button
            className="send-button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
