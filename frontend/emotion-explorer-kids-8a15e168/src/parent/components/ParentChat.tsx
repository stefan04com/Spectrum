import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Child } from '@parent/types';
import { Send, MessageCircle, X, Loader2, History as HistoryIcon } from 'lucide-react';
import { cn } from '@parent/lib/utils';
import { useToast } from '@parent/hooks/use-toast';
import { buildBackendUrl } from '@parent/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  messageId?: number;
  createdAt?: string;
}

interface ParentChatProps {
  child: Child;
  isOpen: boolean;
  onClose: () => void;
  parentId: number;
}

const HISTORY_LIMIT = 8;
type ChatMode = 'child' | 'general';

const buildHistoryPairs = (log: Message[]) =>
  log.reduce<Array<{ prompt: Message; response: Message }>>((acc, msg, index, arr) => {
    if (msg.role === 'user') {
      const next = arr[index + 1];
      if (next && next.role === 'assistant') {
        acc.push({ prompt: msg, response: next });
      }
    }
    return acc;
  }, []);

export function ParentChat({ child, isOpen, onClose, parentId }: ParentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [generalMessages, setGeneralMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChildHistoryLoading, setIsChildHistoryLoading] = useState(false);
  const [childSessionId, setChildSessionId] = useState<number | null>(null);
  const [childHistoryMessages, setChildHistoryMessages] = useState<Message[]>([]);
  const [isChildHistoryOpen, setIsChildHistoryOpen] = useState(false);
  const [childPreviewIndex, setChildPreviewIndex] = useState<number | null>(null);
  const [isGeneralHistoryLoading, setIsGeneralHistoryLoading] = useState(false);
  const [generalSessionId, setGeneralSessionId] = useState<number | null>(null);
  const [generalHistoryMessages, setGeneralHistoryMessages] = useState<Message[]>([]);
  const [isGeneralHistoryOpen, setIsGeneralHistoryOpen] = useState(false);
  const [generalPreviewIndex, setGeneralPreviewIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<ChatMode>('child');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Safety check - don't render if no child
  if (!child) {
    return null;
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, generalMessages, childPreviewIndex, generalPreviewIndex, mode]);

  useEffect(() => {
    // Reset chat when child changes
    setMessages([]);
    setGeneralMessages([]);
    setChildSessionId(null);
    setChildHistoryMessages([]);
    setIsChildHistoryOpen(false);
    setChildPreviewIndex(null);
    setGeneralSessionId(null);
    setGeneralHistoryMessages([]);
    setIsGeneralHistoryOpen(false);
    setGeneralPreviewIndex(null);
  }, [child.id]);

  const fetchChildHistory = useCallback(async (overrideSessionId?: number) => {
    try {
      setIsChildHistoryLoading(true);
      const params = new URLSearchParams({ limit: String(Math.max(HISTORY_LIMIT, 20)) });
      const sessionToUse = overrideSessionId ?? childSessionId;
      if (sessionToUse) {
        params.set('session_id', String(sessionToUse));
      }
      const apiUrl = buildBackendUrl(`/parent/chat/${child.id}/history?${params.toString()}`);
      const response = await fetch(apiUrl, { method: 'GET', mode: 'cors' });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Unable to load history.');
      }
      const data = await response.json();
      if (typeof data.session_id === 'number') {
        setChildSessionId(data.session_id);
      }
      if (Array.isArray(data.messages)) {
        const normalized = data.messages.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
          messageId: msg.messageId ?? msg.message_id,
          createdAt: msg.createdAt ?? msg.created_at,
        }));
        setChildHistoryMessages(normalized);
        setMessages(normalized);
        setChildPreviewIndex(null);
      }
    } catch (error) {
      console.error('History fetch error:', error);
      toast({
        title: 'History unavailable',
        description: error instanceof Error ? error.message : 'Could not load the previous conversation.',
        variant: 'destructive',
      });
    } finally {
      setIsChildHistoryLoading(false);
    }
  }, [child.id, childSessionId, toast]);

  const fetchGeneralHistory = useCallback(async (overrideSessionId?: number) => {
    if (!parentId) {
      return;
    }
    try {
      setIsGeneralHistoryLoading(true);
      const params = new URLSearchParams({
        limit: String(Math.max(HISTORY_LIMIT, 20)),
        parent_id: String(parentId),
      });
      const sessionToUse = overrideSessionId ?? generalSessionId;
      if (sessionToUse) {
        params.set('session_id', String(sessionToUse));
      }
      const apiUrl = buildBackendUrl(`/parent/chat/general/history?${params.toString()}`);
      const response = await fetch(apiUrl, { method: 'GET', mode: 'cors' });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Unable to load history.');
      }
      const data = await response.json();
      if (typeof data.session_id === 'number') {
        setGeneralSessionId(data.session_id);
      }
      if (Array.isArray(data.messages)) {
        const normalized = data.messages.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
          messageId: msg.messageId ?? msg.message_id,
          createdAt: msg.createdAt ?? msg.created_at,
        }));
        setGeneralHistoryMessages(normalized);
        setGeneralMessages(normalized);
        setGeneralPreviewIndex(null);
      }
    } catch (error) {
      console.error('General history fetch error:', error);
      toast({
        title: 'History unavailable',
        description: error instanceof Error ? error.message : 'Could not load the previous conversation.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneralHistoryLoading(false);
    }
  }, [generalSessionId, parentId, toast]);

  const formatGeneralAnswer = (answer: string) =>
    answer?.trim() || 'I could not find relevant info, but you can ask ChatGPT directly.';

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'child') {
      fetchChildHistory();
    } else {
      fetchGeneralHistory();
    }
  }, [isOpen, mode, fetchChildHistory, fetchGeneralHistory]);

  const sendChildMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim(), createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const apiUrl = buildBackendUrl(`/parent/chat/${child.id}`);
    const payload: Record<string, unknown> = {
      question: userMessage.content,
      history_limit: HISTORY_LIMIT,
    };
    if (childSessionId) {
      payload.session_id = childSessionId;
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Communication error');
      }

      const answer = json.answer || 'I was not able to produce a reply.';
      const updatedSessionId = typeof json.session_id === 'number' ? json.session_id : childSessionId;
      if (typeof updatedSessionId === 'number') {
        setChildSessionId(updatedSessionId);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: answer, createdAt: new Date().toISOString() }]);
      fetchChildHistory(updatedSessionId ?? undefined);
    } catch (error) {
      console.error('Chat error:', error);
      const description =
        error instanceof TypeError
          ? 'Could not reach the server. Check your connection and VITE_BACKEND_URL (avoid http on an https page).'
          : error instanceof Error
            ? error.message
            : 'We could not process the message.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendGeneralMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (!parentId) {
      toast({
        title: 'Missing parent information',
        description: 'Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    const userMessage: Message = { role: 'user', content: input.trim(), createdAt: new Date().toISOString() };
    setGeneralMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const apiUrl = buildBackendUrl('/parent/chat/general');
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({
          question: userMessage.content,
          parent_id: parentId,
          history_limit: HISTORY_LIMIT,
          ...(generalSessionId ? { session_id: generalSessionId } : {}),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Communication error');
      }

      const answer = formatGeneralAnswer(json.answer);
      const updatedSessionId = typeof json.session_id === 'number' ? json.session_id : generalSessionId;
      if (typeof updatedSessionId === 'number') {
        setGeneralSessionId(updatedSessionId);
      }
      setGeneralMessages(prev => [
        ...prev,
        { role: 'assistant', content: answer, createdAt: new Date().toISOString() },
      ]);
      fetchGeneralHistory(updatedSessionId ?? undefined);
    } catch (error) {
      console.error('General chat error:', error);
      const description = error instanceof Error ? error.message : 'I could not process the message.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
      setGeneralMessages(prev => [
        ...prev,
        { role: 'assistant', content: description, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = () => {
    if (mode === 'general') {
      void sendGeneralMessage();
    } else {
      void sendChildMessage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const childHistoryPairs = useMemo(() => buildHistoryPairs(childHistoryMessages), [childHistoryMessages]);
  const generalHistoryPairs = useMemo(() => buildHistoryPairs(generalHistoryMessages), [generalHistoryMessages]);

  useEffect(() => {
    if (childHistoryPairs.length > 0) {
      setIsChildHistoryOpen(true);
    }
    if (childPreviewIndex !== null && childPreviewIndex >= childHistoryPairs.length) {
      setChildPreviewIndex(null);
    }
  }, [childHistoryPairs.length, childPreviewIndex]);

  useEffect(() => {
    if (generalHistoryPairs.length > 0) {
      setIsGeneralHistoryOpen(true);
    }
    if (generalPreviewIndex !== null && generalPreviewIndex >= generalHistoryPairs.length) {
      setGeneralPreviewIndex(null);
    }
  }, [generalHistoryPairs.length, generalPreviewIndex]);

  const handleHistoryPreview = (index: number) => {
    if (mode === 'child') {
      setChildPreviewIndex(index);
      setIsChildHistoryOpen(true);
    } else {
      setGeneralPreviewIndex(index);
      setIsGeneralHistoryOpen(true);
    }
  };

  const handleExitPreview = () => {
    if (mode === 'child') {
      setChildPreviewIndex(null);
    } else {
      setGeneralPreviewIndex(null);
    }
  };

  const handleHistoryToggle = () => {
    const historyCount = mode === 'child' ? childHistoryPairs.length : generalHistoryPairs.length;
    const historyLoading = mode === 'child' ? isChildHistoryLoading : isGeneralHistoryLoading;

    if (!historyCount && !historyLoading) {
      toast({
        title: 'No history yet',
        description: 'Send a question to save the first conversation.',
      });
      return;
    }

    if (mode === 'child') {
      setIsChildHistoryOpen(prev => !prev);
    } else {
      setIsGeneralHistoryOpen(prev => !prev);
    }
  };

  const handleModeChange = (nextMode: ChatMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
  };

  const isChildMode = mode === 'child';

  useEffect(() => {
    if (isChildMode) {
      setIsGeneralHistoryOpen(false);
      setGeneralPreviewIndex(null);
    } else {
      setIsChildHistoryOpen(false);
      setChildPreviewIndex(null);
    }
  }, [isChildMode]);

  const activeHistoryPairs = isChildMode ? childHistoryPairs : generalHistoryPairs;
  const isHistoryOpen = isChildMode ? isChildHistoryOpen : isGeneralHistoryOpen;
  const isHistoryLoading = isChildMode ? isChildHistoryLoading : isGeneralHistoryLoading;
  const hasHistoryPairs = activeHistoryPairs.length > 0;
  const previewIndex = isChildMode ? childPreviewIndex : generalPreviewIndex;
  const previewPair = previewIndex !== null ? activeHistoryPairs[previewIndex] : null;
  const isPreviewingHistory = Boolean(previewPair);
  const previewMessages = previewPair
    ? [previewPair.prompt, previewPair.response].filter((msg): msg is Message => Boolean(msg))
    : null;
  const activeMessages = previewMessages ?? (isChildMode ? messages : generalMessages);
  const showHistorySidebar = isHistoryOpen && hasHistoryPairs;
  const inputPlaceholder = isChildMode
    ? `Ask about ${child.name}...`
    : 'Ex: How can I help them feel less stressed?';
  const modeButtons: Array<{ value: ChatMode; label: string; helper: string }> = [
    {
      value: 'child',
      label: 'Personal Assistent',
      helper: `Uses ${child.name}'s data`,
    },
    {
      value: 'general',
      label: 'Bookmaster',
      helper: 'Uses the RAG library + ChatGPT',
    },
  ];

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)]",
        "glass-card rounded-2xl flex flex-col z-50 shadow-hover",
        "transition-all duration-300 transform",
        showHistorySidebar ? "w-[620px]" : "w-96",
        isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
      )}
    >
      <div className="flex h-full">
        <div className="flex flex-1 flex-col">
          {isPreviewingHistory && (
            <div className="px-4 py-2 text-xs bg-amber-50 text-amber-700 border-b border-amber-200 flex items-center justify-between gap-3">
              <span>
                You are viewing saved conversation #{(previewIndex ?? 0) + 1}. The full response is shown below.
              </span>
              <button
                onClick={handleExitPreview}
                className="text-amber-800 underline underline-offset-2 text-[11px]"
              >
                Back to conversation
              </button>
            </div>
          )}
          {/* Header */}
          <div className="p-4 border-b border-border flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">SpectrumAI Assistant</h3>
                  <p className="text-xs text-muted-foreground">
                    {isChildMode ? `Ask about ${child.name}` : 'Ask anything about parenting and autism'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleHistoryToggle}
                  className={cn(
                    "px-3 py-1 text-xs rounded-lg border flex items-center gap-1",
                    isHistoryOpen ? "bg-muted" : "hover:bg-muted"
                  )}
                  disabled={isHistoryLoading && !hasHistoryPairs}
                >
                  <HistoryIcon className="w-4 h-4" />
                  <span>{activeHistoryPairs.length || (isHistoryLoading ? '...' : '0')}</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {modeButtons.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleModeChange(option.value)}
                  className={cn(
                    "flex-1 min-w-[140px] px-3 py-2 rounded-xl border text-left transition",
                    mode === option.value ? "border-primary bg-primary/10" : "hover:bg-muted"
                  )}
                >
                  <p className="text-xs font-semibold text-foreground">{option.label}</p>
                  <p className="text-[10px] text-muted-foreground">{option.helper}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeMessages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {isChildMode ? (
                  <>
                    <p className="text-sm">Ask me about {child.name}!</p>
                    <p className="text-xs mt-2">For example: "How did they feel today?" or "What activities did they do?"</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm">Ask anything about autism care.</p>
                    <p className="text-xs mt-2">For example: "How do I encourage sharing?"</p>
                  </>
                )}
              </div>
            )}
            {activeMessages.map((msg, idx) => (
              <div
                key={msg.messageId ?? idx}
                className={cn(
                  "max-w-[85%] p-3 rounded-2xl animate-slide-up",
                  msg.role === 'user'
                    ? "ml-auto bg-primary text-primary-foreground rounded-br-md"
                    : "mr-auto bg-muted text-foreground rounded-bl-md"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            {isLoading && !isPreviewingHistory && activeMessages[activeMessages.length - 1]?.role === 'user' && (
              <div className="mr-auto bg-muted text-foreground p-3 rounded-2xl rounded-bl-md">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                className="flex-1 px-4 py-2 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading || isPreviewingHistory}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || isPreviewingHistory}
                className={cn(
                  "p-2 rounded-xl gradient-primary text-primary-foreground",
                  "transition-opacity disabled:opacity-50"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {showHistorySidebar && (
          <aside className="w-64 border-l border-border bg-muted/30 rounded-r-2xl hidden md:flex flex-col">
            <div className="p-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">History</p>
              <p className="text-xs text-muted-foreground">Latest conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeHistoryPairs.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border bg-background shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Question</p>
                  <p className="text-sm font-medium line-clamp-2">{item.prompt.content}</p>
                  {item.response && (
                    <div className="mt-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Answer</p>
                      <p className="text-xs text-muted-foreground line-clamp-3">{item.response.content}</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleHistoryPreview(idx)}
                    className="mt-3 text-[11px] text-primary underline underline-offset-2"
                  >
                    View full response
                  </button>
                </div>
              ))}
              {isHistoryLoading && (
                <div className="text-xs text-muted-foreground">Loading history...</div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
