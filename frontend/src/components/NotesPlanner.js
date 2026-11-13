import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, Clock3, Plus, StickyNote, Trash2, Sparkles, Bell } from 'lucide-react';
import { getNotesStreamUrl, notesAPI } from '../services/api';
import { connectTicketedStream } from '../services/ticketedStream';

const toIsoDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatDateTime = (value) => {
  if (!value) return 'No time';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCountdown = (target, nowMs) => {
  const targetMs = new Date(target).getTime();
  if (Number.isNaN(targetMs)) return 'Invalid time';

  const diff = targetMs - nowMs;
  if (diff <= 0) return 'Started';

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
};

const NotesPlanner = () => {
  const [items, setItems] = useState([]);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [scheduleSort, setScheduleSort] = useState('soon');
  const [noteForm, setNoteForm] = useState({ title: '', content: '' });
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    content: '',
    startAt: '',
    endAt: '',
    reminderMinutesBefore: 10
  });

  const syncedNowMs = useMemo(() => nowMs + serverOffsetMs, [nowMs, serverOffsetMs]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const response = await notesAPI.getNotes();
      setItems(response.data.notes || []);
      if (response.data.serverTime) {
        setServerOffsetMs(new Date(response.data.serverTime).getTime() - Date.now());
      }
    } catch (error) {
      toast.error('Failed to load notes and schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    return connectTicketedStream({
      getTicket: async () => (await notesAPI.createStreamTicket()).data.token,
      createSource: (ticket) => new EventSource(getNotesStreamUrl(ticket)),
      onConnected: () => setStreamConnected(true),
      onMessage: (event) => {
          try {
            const payload = JSON.parse(event.data);
            setItems(payload.notes || []);
            if (payload.serverTime) {
              setServerOffsetMs(new Date(payload.serverTime).getTime() - Date.now());
            }
          } catch {
            toast.error('Realtime data error');
          }
      },
      onStatusChange: setStreamConnected
    });
  }, []);

  const noteItems = useMemo(
    () => items.filter((item) => item.category === 'note'),
    [items]
  );

  const scheduleItems = useMemo(() => {
    const filtered = items.filter((item) => item.category === 'schedule');
    const sorted = [...filtered].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    return scheduleSort === 'late' ? sorted.reverse() : sorted;
  }, [items, scheduleSort]);

  const handleCreateNote = async (event) => {
    event.preventDefault();
    if (!noteForm.title.trim()) {
      toast.error('Please enter a note title');
      return;
    }

    setSavingNote(true);
    try {
      await notesAPI.createNote({
        title: noteForm.title,
        content: noteForm.content,
        category: 'note'
      });
      setNoteForm({ title: '', content: '' });
      toast.success('Note added successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleCreateSchedule = async (event) => {
    event.preventDefault();
    if (!scheduleForm.title.trim()) {
      toast.error('Please enter a schedule title');
      return;
    }

    if (!scheduleForm.startAt) {
      toast.error('Please select a start time');
      return;
    }

    const payload = {
      title: scheduleForm.title,
      content: scheduleForm.content,
      category: 'schedule',
      startAt: toIsoDateTime(scheduleForm.startAt),
      endAt: toIsoDateTime(scheduleForm.endAt),
      reminderMinutesBefore: Number(scheduleForm.reminderMinutesBefore)
    };

    setSavingSchedule(true);
    try {
      await notesAPI.createNote(payload);
      setScheduleForm({ title: '', content: '', startAt: '', endAt: '', reminderMinutesBefore: 10 });
      toast.success('Schedule added successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await notesAPI.deleteNote(id);
      toast.success('Deleted successfully');
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tiêu đề phần Notes & Planner */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Notes & Schedule Planner</h2>
            <p className="text-xs text-slate-400">Capture quick thoughts and manage time-bound tasks seamlessly.</p>
          </div>
        </div>
        <div className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
          {streamConnected ? '🟢 Realtime synced' : '🟡 Connecting...'}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* --- CỘT 1: NOTES (GHI CHÚ) --- */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <StickyNote className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Quick Notes</h3>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3.5">
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all placeholder:text-slate-400"
                placeholder="Note title..."
                value={noteForm.title}
                onChange={(e) => setNoteForm((prev) => ({ ...prev, title: e.target.value }))}
              />
              <textarea
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all placeholder:text-slate-400 resize-none"
                rows={4}
                placeholder="Write down your thoughts..."
                value={noteForm.content}
                onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
              />
              <button
                type="submit"
                disabled={savingNote}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-semibold shadow-md shadow-amber-500/20 disabled:opacity-60 transition-all"
              >
                <Plus size={16} />
                {savingNote ? 'Adding...' : 'Add Note'}
              </button>
            </form>

            <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-4">Loading notes...</p>
              ) : noteItems.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No notes recorded yet.</p>
              ) : (
                noteItems.map((item) => (
                  <div key={item.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 transition-all hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{item.title}</p>
                        {item.content && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{item.content}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* --- CỘT 2: SCHEDULE (LỊCH TRÌNH & NHẮC NHỞ) --- */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Schedule & Planner</h3>
              </div>
              <select
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
                value={scheduleSort}
                onChange={(e) => setScheduleSort(e.target.value)}
              >
                <option value="soon">Soonest first</option>
                <option value="late">Latest first</option>
              </select>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-3.5">
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all placeholder:text-slate-400"
                placeholder="Task title..."
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm((prev) => ({ ...prev, title: e.target.value }))}
              />
              <textarea
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 resize-none"
                rows={2}
                placeholder="Description (optional)..."
                value={scheduleForm.content}
                onChange={(e) => setScheduleForm((prev) => ({ ...prev, content: e.target.value }))}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={scheduleForm.startAt}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, startAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={scheduleForm.endAt}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, endAt: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Bell size={14} className="text-slate-400 shrink-0" />
                <input
                  type="number"
                  min="0"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400"
                  placeholder="Email reminder minutes before due time"
                  value={scheduleForm.reminderMinutesBefore}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, reminderMinutesBefore: e.target.value }))}
                />
              </div>

              <button
                type="submit"
                disabled={savingSchedule}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-60 transition-all"
              >
                <Plus size={16} />
                {savingSchedule ? 'Adding...' : 'Add Event & Schedule'}
              </button>
            </form>

            <div className="mt-6 space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-4">Loading schedule...</p>
              ) : scheduleItems.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No scheduled events yet.</p>
              ) : (
                scheduleItems.map((item) => (
                  <div key={item.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4 transition-all hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{item.title}</p>
                        </div>
                        {item.content && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{item.content}</p>}
                        
                        <div className="mt-2.5 space-y-1 text-[11px] text-slate-400">
                          <p>📅 Start: {formatDateTime(item.startAt)}</p>
                          {item.endAt && <p>🏁 End: {formatDateTime(item.endAt)}</p>}
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5 flex items-center gap-1">
                            ⏳ Remaining: {formatCountdown(item.endAt || item.startAt, syncedNowMs)}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NotesPlanner;
