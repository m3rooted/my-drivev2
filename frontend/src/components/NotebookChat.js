import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Check,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import { notebooksAPI } from '../services/api';

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unit)).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const NotebookChat = () => {
  const [aiConfigured, setAiConfigured] = useState(false);
  const [sources, setSources] = useState([]);
  const [notebooks, setNotebooks] = useState([]);
  const [activeNotebook, setActiveNotebook] = useState(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingNotebook, setLoadingNotebook] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loadError, setLoadError] = useState('');
  const conversationRef = useRef(null);
  const createDialogRef = useRef(null);
  const questionRef = useRef(null);
  const returnFocusRef = useRef(null);

  const openNotebook = async (id) => {
    setLoadingNotebook(true);
    try {
      const response = await notebooksAPI.getNotebook(id);
      setActiveNotebook(response.data.notebook);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not open this notebook');
    } finally {
      setLoadingNotebook(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadWorkspace = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [status, sourceResponse, notebookResponse] = await Promise.all([
          notebooksAPI.getStatus(),
          notebooksAPI.getSources(),
          notebooksAPI.getNotebooks()
        ]);
        if (!active) return;
        setAiConfigured(Boolean(status.data.aiConfigured));
        setSources(sourceResponse.data.sources || []);
        const savedNotebooks = notebookResponse.data.notebooks || [];
        setNotebooks(savedNotebooks);
        if (savedNotebooks[0]) {
          const response = await notebooksAPI.getNotebook(savedNotebooks[0].id);
          if (active) setActiveNotebook(response.data.notebook);
        }
      } catch (error) {
        if (active) setLoadError(error.response?.data?.error || 'Could not load Notebook Chat');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadWorkspace();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!conversationRef.current) return;
    if (typeof conversationRef.current.scrollTo === 'function') {
      conversationRef.current.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' });
    } else {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [activeNotebook?.messages, sending]);

  useEffect(() => {
    if (!showCreateDialog) return undefined;
    const handleDialogKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCreateDialog(false);
        return;
      }
      if (event.key !== 'Tab' || !createDialogRef.current) return;

      const focusable = Array.from(createDialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !createDialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !createDialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeyDown);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [showCreateDialog]);

  const openCreateDialog = () => {
    returnFocusRef.current = document.activeElement;
    setTitle('');
    setSelectedSourceIds([]);
    setShowCreateDialog(true);
  };

  const toggleSource = (sourceId) => {
    setSelectedSourceIds((current) => current.includes(sourceId)
      ? current.filter((id) => id !== sourceId)
      : [...current, sourceId]);
  };

  const handleCreateNotebook = async (event) => {
    event.preventDefault();
    if (!title.trim() || selectedSourceIds.length === 0) return;

    setCreating(true);
    try {
      const response = await notebooksAPI.createNotebook({ title: title.trim(), sourceIds: selectedSourceIds });
      const notebook = response.data.notebook;
      setNotebooks((current) => [notebook, ...current]);
      setActiveNotebook(notebook);
      setShowCreateDialog(false);
      toast.success('Notebook created');
      questionRef.current?.focus();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not create notebook');
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!activeNotebook || !trimmedQuestion || sending || !aiConfigured) return;

    setSending(true);
    setSendError('');
    try {
      const response = await notebooksAPI.sendMessage(activeNotebook.id, trimmedQuestion);
      const assistantMessage = response.data.message;
      const userMessage = { id: `local-${Date.now()}`, role: 'user', content: trimmedQuestion };
      setActiveNotebook((current) => current
        ? { ...current, messages: [...current.messages, userMessage, assistantMessage] }
        : current);
      setNotebooks((current) => current.map((notebook) => notebook.id === activeNotebook.id
        ? { ...notebook, updatedAt: assistantMessage.createdAt }
        : notebook));
      setQuestion('');
    } catch (error) {
      const message = error.response?.data?.error || 'Could not send your question';
      setSendError(message);
      toast.error(message);
    } finally {
      setSending(false);
      questionRef.current?.focus();
    }
  };

  const handleDeleteNotebook = async (notebook) => {
    if (!window.confirm(`Delete “${notebook.title}” and its saved conversation?`)) return;
    try {
      await notebooksAPI.deleteNotebook(notebook.id);
      const remaining = notebooks.filter((item) => item.id !== notebook.id);
      setNotebooks(remaining);
      if (activeNotebook?.id === notebook.id) {
        setActiveNotebook(null);
        if (remaining[0]) await openNotebook(remaining[0].id);
      }
      toast.success('Notebook deleted');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not delete notebook');
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="notebook-chat-title">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-archive-border dark:bg-archive-surface">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-archive-teal/10 text-archive-teal dark:bg-archive-teal/20 dark:text-archive-mint">
            <BookOpen size={21} aria-hidden="true" />
          </div>
          <div>
            <h1 id="notebook-chat-title" className="text-lg font-bold text-archive-ink dark:text-white">Notebook Chat</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Ask questions about the files you choose.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-archive-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-archive-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-archive-blue focus-visible:ring-offset-2 dark:focus-visible:ring-offset-archive-surface"
        >
          <Plus size={17} aria-hidden="true" /> New notebook
        </button>
      </header>

      {!aiConfigured && !loading && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>To ask questions, set <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/60">GEMINI_API_KEY</code> in the backend environment and restart the API.</p>
        </div>
      )}

      {loadError ? (
        <div className="rounded-3xl border border-rose-300/70 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/20" role="alert">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{loadError}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-200">Reload</button>
        </div>
      ) : (
        <div className="grid min-h-[min(72dvh,760px)] grid-cols-1 gap-4 lg:grid-cols-[minmax(235px,280px)_minmax(0,1fr)]">
          <aside className="flex max-h-[min(72dvh,760px)] min-h-48 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/90 dark:border-archive-border dark:bg-archive-surface" aria-label="Saved notebooks">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-archive-border">
              <h2 className="text-sm font-bold">Your notebooks</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{notebooks.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {loading ? (
                <p className="px-3 py-5 text-center text-sm text-slate-500" role="status">Loading notebooks…</p>
              ) : notebooks.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <MessageSquare size={22} className="mx-auto text-slate-400" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">No notebooks yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Choose a few files and start a saved conversation.</p>
                </div>
              ) : notebooks.map((notebook) => (
                <div key={notebook.id} className={`group flex items-center gap-1 rounded-2xl p-1 ${activeNotebook?.id === notebook.id ? 'bg-archive-teal/10 dark:bg-archive-teal/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}>
                  <button type="button" onClick={() => openNotebook(notebook.id)} aria-current={activeNotebook?.id === notebook.id ? 'page' : undefined} className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-archive-blue">
                    <span className="block truncate text-sm font-semibold">{notebook.title}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{notebook.sources?.length || 0} sources · {Math.floor((notebook.messages?.length || 0) / 2)} questions</span>
                  </button>
                  <button type="button" onClick={() => handleDeleteNotebook(notebook)} aria-label={`Delete ${notebook.title}`} className="rounded-lg p-2 text-slate-400 opacity-70 transition-colors hover:bg-rose-100 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:hover:bg-rose-950/40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <p className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-archive-border dark:text-slate-400">Only selected files are sent to Google Gemini when you ask a question.</p>
          </aside>

          <div className="flex min-h-[min(68dvh,720px)] min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/95 dark:border-archive-border dark:bg-archive-surface">
            {activeNotebook ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-archive-border sm:px-6">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-archive-teal dark:text-archive-mint">CURRENT NOTEBOOK</p>
                    <h2 className="mt-1 truncate text-base font-bold">{activeNotebook.title}</h2>
                  </div>
                  <div className="flex max-w-full flex-wrap gap-1.5">
                    {activeNotebook.sources.map((source) => (
                      <span key={source.id} title={source.originalName} className="inline-flex max-w-48 items-center gap-1.5 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                        <FileText size={13} className="shrink-0 text-archive-blue" aria-hidden="true" />
                        <span className="truncate">{source.originalName}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div ref={conversationRef} role="log" aria-live="polite" aria-label="Notebook conversation" className="flex-1 space-y-5 overflow-y-auto bg-gradient-to-b from-white to-slate-50/80 px-4 py-6 dark:from-archive-surface dark:to-archive-canvas/50 sm:px-7">
                  {loadingNotebook ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500" role="status"><Loader2 size={17} className="mr-2 animate-spin" /> Loading conversation…</div>
                  ) : activeNotebook.messages.length === 0 ? (
                    <div className="flex min-h-72 flex-col items-center justify-center text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-archive-teal/10 text-archive-teal dark:bg-archive-teal/20 dark:text-archive-mint"><BookOpen size={25} aria-hidden="true" /></span>
                      <h3 className="mt-4 text-base font-bold">Your sources are ready</h3>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Ask for a summary, compare ideas across files, or find a specific detail.</p>
                    </div>
                  ) : activeNotebook.messages.map((message) => (
                    <article key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {message.role === 'assistant' && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-archive-teal/10 text-archive-teal dark:bg-archive-teal/20 dark:text-archive-mint"><BookOpen size={16} aria-hidden="true" /></span>}
                      <div className={`max-w-[min(88%,720px)] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-md bg-archive-teal text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-archive-border dark:bg-archive-raised dark:text-slate-100'}`}>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </article>
                  ))}
                  {sending && (
                    <div className="flex items-center gap-3 text-sm text-slate-500" role="status"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-archive-teal/10 text-archive-teal"><Loader2 size={16} className="animate-spin" aria-hidden="true" /></span>Gemini is analyzing your sources. This can take up to 3 minutes…</div>
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white p-4 dark:border-archive-border dark:bg-archive-surface sm:px-6 sm:py-5">
                  <label htmlFor="notebook-question" className="sr-only">Ask a question about your sources</label>
                  <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2 shadow-sm transition focus-within:border-archive-blue focus-within:ring-2 focus-within:ring-archive-blue/20 dark:border-slate-700 dark:bg-slate-900/70">
                    <textarea
                      id="notebook-question"
                      ref={questionRef}
                      rows={2}
                      maxLength={4000}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder={aiConfigured ? 'Ask something about these files…' : 'Add the Gemini API key to enable chat'}
                      disabled={!aiConfigured || sending}
                      className="max-h-40 min-h-12 flex-1 resize-y border-0 bg-transparent px-2 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0 disabled:cursor-not-allowed dark:text-white"
                    />
                    <button type="submit" disabled={!aiConfigured || sending || !question.trim()} aria-label="Send question" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-archive-teal text-white transition hover:bg-archive-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-archive-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-archive-surface">
                      {sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
                    </button>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400"><ShieldCheck size={13} className="shrink-0" aria-hidden="true" />Selected file content and recent chat history go to Google Gemini. Check answers against your sources.</p>
                  {sendError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-300" role="alert">{sendError}</p>}
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-archive-teal/10 text-archive-teal dark:bg-archive-teal/20 dark:text-archive-mint"><MessageSquare size={28} aria-hidden="true" /></span>
                <h2 className="mt-5 text-xl font-bold">Start with your files</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Create a notebook from PDFs, text files, Markdown, or CSV. Your conversation will be saved here.</p>
                {!loading && sources.length === 0 && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">No supported files yet. Upload a PDF, TXT, MD, or CSV file to My Drive.</p>}
                <button type="button" onClick={openCreateDialog} disabled={sources.length === 0} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-archive-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-archive-teal/90 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17} aria-hidden="true" /> Create notebook</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreateDialog(false); }}>
          <form ref={createDialogRef} onSubmit={handleCreateNotebook} role="dialog" aria-modal="true" aria-labelledby="create-notebook-title" className="flex max-h-[min(88dvh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-archive-border dark:bg-archive-surface">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-archive-border sm:px-6">
              <div>
                <h2 id="create-notebook-title" className="text-lg font-bold">New notebook</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose the files Gemini can use for this chat.</p>
              </div>
              <button type="button" onClick={() => setShowCreateDialog(false)} aria-label="Close dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} aria-hidden="true" /></button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              <div>
                <label htmlFor="notebook-title" className="mb-1.5 block text-sm font-semibold">Notebook name</label>
                <input id="notebook-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={100} autoFocus placeholder="e.g. Product research" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm outline-none transition focus:border-archive-blue focus:ring-2 focus:ring-archive-blue/20 dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Sources <span className="font-normal text-slate-500">({selectedSourceIds.length}/6)</span></legend>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-1.5 dark:border-archive-border">
                  {sources.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">No supported files found. Upload a PDF, TXT, MD, or CSV file to My Drive.</p>
                  ) : sources.map((source) => {
                    const selected = selectedSourceIds.includes(source.id);
                    const disabled = !selected && selectedSourceIds.length >= 6;
                    return (
                      <label key={source.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors focus-within:ring-2 focus-within:ring-archive-blue/50 ${selected ? 'bg-archive-teal/10 dark:bg-archive-teal/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                        <input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggleSource(source.id)} className="sr-only" />
                        <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-archive-teal bg-archive-teal text-white' : 'border-slate-300 dark:border-slate-600'}`}>{selected && <Check size={13} />}</span>
                        <FileText size={18} className="shrink-0 text-archive-blue dark:text-archive-blue-light" aria-hidden="true" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{source.originalName}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{formatFileSize(source.size)}</span></span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400"><ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Only the sources you select are used. They are sent to Google Gemini when you ask a question.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-archive-border sm:px-6">
              <button type="button" onClick={() => setShowCreateDialog(false)} className="min-h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={creating || !title.trim() || selectedSourceIds.length === 0} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-archive-teal px-4 text-sm font-semibold text-white transition hover:bg-archive-teal/90 disabled:cursor-not-allowed disabled:opacity-50">
                {creating ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Creating…</> : <><Plus size={16} aria-hidden="true" /> Create notebook</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default NotebookChat;
