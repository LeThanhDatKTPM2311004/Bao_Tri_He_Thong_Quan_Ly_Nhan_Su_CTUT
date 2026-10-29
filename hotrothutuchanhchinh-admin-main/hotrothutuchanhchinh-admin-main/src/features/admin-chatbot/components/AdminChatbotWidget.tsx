import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageOutlined } from '@ant-design/icons';
import {
  adminChatbotApi,
  type AdminChatAction,
  type AdminChatAskResult,
} from '../services/adminChatbotApi';
import './AdminChatbotWidget.css';

type ChatMessage = {
  role: 'bot' | 'user';
  text: string;
  actions?: AdminChatAction[];
};

type FabPos = { left: number; top: number };

const FAB_SIZE = 52;
const STORAGE_KEY = 'admin-chatbot-fab-pos';
const DRAG_THRESHOLD = 6;

const defaultFabPos = (): FabPos => ({
  left: Math.max(12, window.innerWidth - FAB_SIZE - 24),
  top: Math.max(12, window.innerHeight - FAB_SIZE - 96),
});

const clampPos = (left: number, top: number): FabPos => {
  const maxLeft = Math.max(8, window.innerWidth - FAB_SIZE - 8);
  const maxTop = Math.max(8, window.innerHeight - FAB_SIZE - 8);
  return {
    left: Math.min(maxLeft, Math.max(8, left)),
    top: Math.min(maxTop, Math.max(8, top)),
  };
};

const loadFabPos = (): FabPos => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFabPos();
    const parsed = JSON.parse(raw) as FabPos;
    if (typeof parsed?.left !== 'number' || typeof parsed?.top !== 'number') {
      return defaultFabPos();
    }
    return clampPos(parsed.left, parsed.top);
  } catch {
    return defaultFabPos();
  }
};

const panelStyleFromFab = (pos: FabPos): CSSProperties => {
  const panelW = Math.min(420, window.innerWidth - 24);
  const panelH = Math.min(580, window.innerHeight - 24);
  let left = pos.left + FAB_SIZE - panelW;
  let top = pos.top - panelH - 12;
  if (left < 8) left = 8;
  if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
  if (top < 8) top = Math.min(pos.top + FAB_SIZE + 12, window.innerHeight - panelH - 8);
  if (top < 8) top = 8;
  return { left, top, right: 'auto', bottom: 'auto' };
};

const renderAnswerText = (text = '') =>
  String(text)
    .split('\n')
    .map((line, idx) => {
      const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return (
        <p
          key={`${idx}-${line.slice(0, 12)}`}
          className="admin-chatbot-line"
          dangerouslySetInnerHTML={{ __html: html || '&nbsp;' }}
        />
      );
    });

export function AdminChatbotWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chips, setChips] = useState<string[]>([]);
  const [fabPos, setFabPos] = useState<FabPos>(() =>
    typeof window !== 'undefined' ? loadFabPos() : { left: 24, top: 24 },
  );
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'bot',
      text: 'Xin chào! Em là thư ký trợ lý trang quản trị — hỏi hiệu trưởng/trưởng khoa, thống kê, tìm SV/user, biểu mẫu, hồ sơ chờ duyệt, hoặc mở trang ….',
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    adminChatbotApi
      .suggestions()
      .then((list) => setChips(Array.isArray(list) ? list : []))
      .catch(() => {
        setChips([
          'Thống kê tổng quan hệ thống',
          'Có bao nhiêu đơn đang mở?',
          'Hồ sơ đang chờ duyệt',
        ]);
      });
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    const onResize = () => setFabPos((prev) => clampPos(prev.left, prev.top));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const persistPos = useCallback((pos: FabPos) => {
    const next = clampPos(pos.left, pos.top);
    setFabPos(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const onFabPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: fabPos.left,
      originTop: fabPos.top,
      moved: false,
    };
    setDragging(true);
  };

  const onFabPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setFabPos(clampPos(drag.originLeft + dx, drag.originTop + dy));
  };

  const endFabPointer = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const wasDrag = drag.moved;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    dragRef.current = null;
    setDragging(false);
    if (wasDrag) {
      persistPos(clampPos(drag.originLeft + dx, drag.originTop + dy));
      return;
    }
    setOpen(true);
  };

  const handleAction = (action: AdminChatAction) => {
    if (action?.type !== 'navigate' || !action.path) return;
    navigate(action.path);
    setOpen(false);
  };

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const data: AdminChatAskResult = await adminChatbotApi.ask(text);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: data?.answer || 'Không nhận được phản hồi.',
          actions: data?.actions || [],
        },
      ]);
      if (Array.isArray(data?.suggestions) && data.suggestions.length) {
        setChips(data.suggestions.filter((s): s is string => typeof s === 'string'));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: 'Không gọi được trợ lý admin. Kiểm tra đăng nhập (role admin) và thử lại.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={`admin-chatbot-fab${dragging ? ' is-dragging' : ''}`}
        title="Kéo để di chuyển · Nhấn để mở trợ lý"
        aria-label="Mở chatbot admin"
        style={{ left: fabPos.left, top: fabPos.top, right: 'auto', bottom: 'auto' }}
        onPointerDown={onFabPointerDown}
        onPointerMove={onFabPointerMove}
        onPointerUp={endFabPointer}
        onPointerCancel={endFabPointer}
      >
        <MessageOutlined />
      </button>
    );
  }

  return (
    <div
      className="admin-chatbot-panel"
      role="dialog"
      aria-label="Chatbot thư ký admin"
      style={panelStyleFromFab(fabPos)}
    >
      <div className="admin-chatbot-header">
        <div>
          <h3>Thư ký trợ lý</h3>
          <div className="admin-chatbot-subtitle">Hỗ trợ tra cứu dữ liệu và thao tác trang quản trị</div>
        </div>
        <button type="button" className="admin-chatbot-close" onClick={() => setOpen(false)} aria-label="Đóng">
          ×
        </button>
      </div>

      <div className="admin-chatbot-messages" ref={listRef}>
        {messages.map((m, idx) => (
          <div key={`${m.role}-${idx}`} className={`admin-chatbot-msg ${m.role}`}>
            <div className="admin-chatbot-bubble">
              {renderAnswerText(m.text)}
              {m.actions && m.actions.length > 0 && (
                <div className="admin-chatbot-actions">
                  {m.actions.map((a, i) => (
                    <button
                      key={`${a.path}-${i}`}
                      type="button"
                      className="admin-chatbot-action-btn"
                      onClick={() => handleAction(a)}
                    >
                      {a.label || a.path}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="admin-chatbot-msg bot">
            <div className="admin-chatbot-bubble">Đang tra cứu…</div>
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="admin-chatbot-chips">
          {chips.map((c) => (
            <button key={c} type="button" className="admin-chatbot-chip" onClick={() => sendMessage(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      <form
        className="admin-chatbot-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hỏi thống kê, tìm SV, mở trang…"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          Gửi
        </button>
      </form>
    </div>
  );
}
