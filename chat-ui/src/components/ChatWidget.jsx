import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './ChatWidget.css';

const getApiBaseUrl = () => {
  if (import.meta.env.PROD) return '';
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
};
const API_BASE = getApiBaseUrl();
const STREAM_URL = `${API_BASE}/api/chat/stream`;
const LEGACY_URL = `${API_BASE}/api/chat`;

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const isArabic = (text) => ARABIC_RE.test(text);

const GREETING = 'مرحبا بك أنا مساعدك البحري الذكي، أساعدك في تبسيط مفاهيم الموانئ وسلاسل الإمداد البحرية. كيف يمكنني مساعدتك اليوم؟';

const SUGGESTIONS = [
  'ما الفرق بين شحن FCL و LCL؟',
  'ما هي وظائف بوليصة الشحن؟',
];

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
    console.warn('Stream reader failed, trying text fallback:', streamErr);
    try {
      const text = await response.text();
      processNDJSONLines(text, callbacks);
    } catch {
      if (callbacks.onError) {
        callbacks.onError('حدث خطأ أثناء تلقي الرد. حاول مرة أخرى.');
      }
    }
  }
}

export default function ChatWidget({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (text) => {
    const question = text.trim();
    if (!question) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    const fetchHeaders = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };
    const body = JSON.stringify({ question });

    try {
      // ── Attempt 1: Streaming ───────────────────────────────────────
      let gotText = false;

      try {
        const res = await fetch(STREAM_URL, {
          method: 'POST',
          headers: fetchHeaders,
          body,
        });

        const ct = res.headers.get('content-type') || '';
        if (!res.ok || ct.includes('text/html')) {
          throw new Error('non-stream response');
        }

        setMessages((prev) => [...prev, { role: 'bot', text: '', sources: [] }]);
        setLoading(false);

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
            gotText = true;
          },
        });

        if (!gotText) throw new Error('empty-stream');

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
        // ── Attempt 2: Non-streaming fallback ────────────────────────
        console.warn('Streaming failed, using legacy endpoint:', streamErr.message);

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
      setLoading(false);
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
    <div className="cw-overlay" onClick={onClose}>
      <div className="cw-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cw-header">
          <button className="cw-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <h3 className="cw-title">مساعدك اللوجستي البحري</h3>
        </div>

        {/* Messages */}
        <div className="cw-messages">
          {messages.map((msg, i) => {
            const dir = isArabic(msg.text) ? 'rtl' : 'ltr';
            if (msg.role === 'error') {
              return (
                <div key={i} className="cw-msg cw-error" dir="rtl">
                  ⚠️ {msg.text}
                </div>
              );
            }
            return (
              <div key={i} className={`cw-msg cw-${msg.role}`} dir={dir}>
                {msg.role === 'bot' ? (
                  <ReactMarkdown
                    components={{
                      strong: ({ node, ...props }) => (
                        <strong style={{ color: '#38bdf8', fontWeight: 'bold' }} {...props} />
                      ),
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
            );
          })}

          {loading && (
            <div className="cw-msg cw-bot cw-typing">
              <span /><span /><span />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="cw-input-area">
          <div className="cw-input-bar">
            <input
              ref={inputRef}
              className="cw-input"
              type="text"
              dir={inputDir}
              placeholder={GREETING}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <button
              className="cw-send"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
