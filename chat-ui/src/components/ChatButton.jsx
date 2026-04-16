import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HiSparkles } from 'react-icons/hi2';
import ChatWidget from './ChatWidget';
import './ChatButton.css';

export default function ChatButton() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (location.pathname === '/' || location.pathname === '/chat') {
    return null;
  }

  return (
    <>
      {open && <ChatWidget onClose={() => setOpen(false)} />}
      <button
        className={`chat-fab ${open ? 'chat-fab--hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Open Chatbot"
        title="محادثة المساعد"
      >
        <HiSparkles size={24} color="#22d3ee" className="chat-fab-icon" />
      </button>
    </>
  );
}
