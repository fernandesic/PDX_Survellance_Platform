/**
 * LlmAssistant — T-030 / T-129.
 *
 * Replaces the original inline OutbreakChat with a real grounded chat
 * panel backed by /outbreaks/<id>/ask/. Every reply renders citation
 * chips that open the EvidenceDrawer. "no data" comes back as a clean
 * refusal pill, never an apologetic improvisation.
 */

import { useState } from 'react';
import { askOutbreak, type AskResult } from '../services/outbreakApi';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  meta?: AskResult;
}

interface Props {
  outbreakId: number;
  onCitationClick?: (citation: string) => void;
  /**
   * Initial expanded state. The Now-pane right rail passes true so the
   * assistant is always visible. Standalone uses keep the default
   * collapsed-on-load behaviour.
   */
  defaultExpanded?: boolean;
}

export default function LlmAssistant({ outbreakId, onCitationClick, defaultExpanded = false }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    setBusy(true);
    setExpanded(true);
    try {
      const result = await askOutbreak(outbreakId, q);
      const content = result.answer
        ? result.answer
        : `no data (${result.reason || 'no_data'})`;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content, meta: result },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chat failed';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${msg}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`ob-card ob-chat-card ${expanded ? 'ob-chat--expanded' : ''}`}>
      <div
        className="ob-chat-header"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <h3 className="ob-card-title" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
          Outbreak Intelligence Assistant
          <span className="ob-chat-badge">Cite or Die · grounded</span>
        </h3>
        <span className="ob-chat-toggle">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <>
          <div className="ob-chat-messages">
            {messages.length === 0 && (
              <div className="ob-chat-empty">
                Ask about this outbreak. Every claim is cited with
                [evt:N], [cap:KEY], or [path:FIELD]. If the data does not
                contain the answer, the assistant returns <code>no data</code>.
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`ob-chat-msg ${msg.role === 'user' ? 'ob-chat-msg--user' : 'ob-chat-msg--ai'}`}
              >
                <div className="ob-chat-role">{msg.role === 'user' ? 'You' : 'AI'}</div>
                <div className="ob-chat-content">
                  {msg.role === 'assistant' && msg.meta && !msg.meta.answer ? (
                    <span className="ob-chat-refusal">{msg.content}</span>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.meta && (msg.meta.citations?.length ?? 0) > 0 && (
                  <div className="ob-chat-cite-row">
                    {msg.meta.citations.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="ob-chat-cite"
                        onClick={() => onCitationClick?.(c)}
                      >
                        {c}
                      </button>
                    ))}
                    {msg.meta.source && (
                      <span className="ob-chat-source-pill">{msg.meta.source}</span>
                    )}
                  </div>
                )}
                {msg.meta?.invalid_citations && msg.meta.invalid_citations.length > 0 && (
                  <div className="ob-chat-cite-row ob-chat-cite-row--invalid">
                    rejected: {msg.meta.invalid_citations.join(', ')}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="ob-chat-msg ob-chat-msg--ai">
                <div className="ob-chat-role">AI</div>
                <div className="ob-chat-content">thinking...</div>
              </div>
            )}
          </div>
          <div className="ob-chat-input-row">
            <input
              type="text"
              className="ob-chat-input"
              placeholder="e.g. signals last 7 days, IHR bottlenecks, CHW coverage gaps..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={busy}
            />
            <button
              className="ob-ingest-btn"
              onClick={handleSend}
              disabled={busy || !input.trim()}
            >
              {busy ? '...' : 'Ask'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
