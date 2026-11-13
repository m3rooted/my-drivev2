const express = require('express');
const auth = require('../middleware/auth');
const NoteModel = require('../models/Note');
const UserModel = require('../models/User');
const { sendScheduleReminderEmail, isEmailConfigured } = require('../services/mailer');
const { scheduleAt } = require('../services/scheduleTimeout');
const createStreamTicketStore = require('../services/streamTickets');
const { isRecord, normalizeDisplayName, parseDateTime } = require('../utils/validation');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const subscribers = new Map();
const reminderTimeouts = new Map();
const streamTickets = createStreamTicketStore();
const defaultReminderMinutesBefore = Number(process.env.REMINDER_MINUTES_BEFORE || 10);
const MAX_REMINDER_MINUTES = Math.floor(2147483647 / 60000);
const MAX_NOTE_CONTENT_LENGTH = 20000;

const normalizeNoteContent = (value) => {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > MAX_NOTE_CONTENT_LENGTH) return null;
  return value.trim();
};

const parseReminderMinutes = (value) => {
  if (value === undefined) return defaultReminderMinutesBefore;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;

  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > MAX_REMINDER_MINUTES) return null;
  return Math.floor(minutes);
};

const getReminderLeadMinutes = (note) => {
  const value = Number(note.reminderMinutesBefore);
  if (!Number.isFinite(value) || value < 0) {
    return defaultReminderMinutesBefore;
  }
  return Math.floor(value);
};

const sendSseEvent = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const broadcastNotes = async (userId) => {
  const userSubscribers = subscribers.get(userId);
  if (!userSubscribers || userSubscribers.size === 0) {
    return;
  }

  const notes = await NoteModel.getNotesByUserId(userId);
  const payload = { notes, serverTime: new Date().toISOString() };

  for (const res of userSubscribers) {
    sendSseEvent(res, 'notes:update', payload);
  }
};

const clearReminder = (noteId) => {
  const cancelReminder = reminderTimeouts.get(noteId);
  if (cancelReminder) {
    cancelReminder();
    reminderTimeouts.delete(noteId);
  }
};

const scheduleReminder = async (note, userEmail) => {
  clearReminder(note.id);

  const noteCategory = note.category || 'schedule';
  if (noteCategory !== 'schedule' || note.done || note.reminderSent) {
    return false;
  }

  if (!userEmail || !isEmailConfigured()) {
    return false;
  }

  const dueAt = note.endAt || note.startAt;
  const dueTimestamp = new Date(dueAt).getTime();
  if (Number.isNaN(dueTimestamp)) {
    return false;
  }

  const reminderMinutesBefore = getReminderLeadMinutes(note);
  const reminderTimestamp = dueTimestamp - (reminderMinutesBefore * 60 * 1000);
  const triggerReminder = async () => {
    reminderTimeouts.delete(note.id);

    const latestNote = await NoteModel.getNoteById(note.id, note.userId);
    if (!latestNote) {
      return;
    }

    const latestCategory = latestNote.category || 'schedule';
    if (latestNote.done || latestCategory !== 'schedule' || latestNote.reminderSent) {
      return;
    }

    const latestDueAt = latestNote.endAt || latestNote.startAt;
    const latestReminderMinutes = getReminderLeadMinutes(latestNote);

    const result = await sendScheduleReminderEmail(
      userEmail,
      latestNote,
      latestReminderMinutes,
      latestDueAt
    );
    if (!result.sent) {
      return;
    }

    await NoteModel.updateNote(latestNote.id, latestNote.userId, { reminderSent: true });
    await broadcastNotes(latestNote.userId);
  };

  if (dueTimestamp <= Date.now()) return false;

  const cancelReminder = scheduleAt(
    () => triggerReminder().catch((error) => console.error('Failed to run schedule reminder:', error.message)),
    reminderTimestamp
  );
  reminderTimeouts.set(note.id, cancelReminder);
  return true;
};

const initializeReminders = async () => {
  let scheduled = 0;
  for (const note of NoteModel.notes) {
    const user = await UserModel.findById(note.userId);
    if (user && await scheduleReminder(note, user.email)) scheduled += 1;
  }
  return scheduled;
};

const clearReminderTimers = () => {
  for (const noteId of reminderTimeouts.keys()) clearReminder(noteId);
};

router.post('/stream-token', auth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(streamTickets.issue(req.user.id));
});

router.get('/stream', asyncHandler(async (req, res) => {
  const userId = streamTickets.consume(req.query.ticket);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired stream ticket' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!subscribers.has(userId)) {
    subscribers.set(userId, new Set());
  }
  subscribers.get(userId).add(res);

  sendSseEvent(res, 'connected', { message: 'Notes stream connected' });
  await broadcastNotes(userId);

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const userSubscribers = subscribers.get(userId);
    if (userSubscribers) {
      userSubscribers.delete(res);
      if (userSubscribers.size === 0) {
        subscribers.delete(userId);
      }
    }
  });
}));

router.get('/', auth, async (req, res) => {
  try {
    const notes = await NoteModel.getNotesByUserId(req.user.id);
    res.json({ notes, serverTime: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const title = normalizeDisplayName(body.title, 200);
    const content = normalizeNoteContent(body.content);
    const category = body.category === undefined ? 'schedule' : body.category;
    const startAt = parseDateTime(body.startAt);
    const endAt = parseDateTime(body.endAt);
    const reminderMinutesBefore = parseReminderMinutes(body.reminderMinutesBefore);

    if (!title || content === null || !['note', 'schedule'].includes(category)) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!startAt.valid || !endAt.valid || reminderMinutesBefore === null) {
      return res.status(400).json({ error: 'Enter valid dates and reminder settings' });
    }

    if (category === 'schedule' && !startAt.value) {
      return res.status(400).json({ error: 'Start time is required for schedule items' });
    }

    if (endAt.value && !startAt.value) {
      return res.status(400).json({ error: 'An end time requires a start time' });
    }

    if (startAt.value && endAt.value && new Date(endAt.value) <= new Date(startAt.value)) {
      return res.status(400).json({ error: 'End time must be later than start time' });
    }

    const effectiveStartAt = startAt.value || new Date().toISOString();

    const note = await NoteModel.createNote({
      userId: req.user.id,
      title,
      content,
      category,
      startAt: effectiveStartAt,
      endAt: endAt.value,
      reminderMinutesBefore
    });

    await scheduleReminder(note, req.user.email);

    await broadcastNotes(req.user.id);
    res.status(201).json({ message: 'Note created successfully', note });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const body = isRecord(req.body) ? req.body : null;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    const { title, content, startAt, endAt, done, category, reminderMinutesBefore } = body;
    const normalizedTitle = title === undefined ? undefined : normalizeDisplayName(title, 200);
    const normalizedContent = content === undefined ? undefined : normalizeNoteContent(content);
    if ((title !== undefined && !normalizedTitle) || (content !== undefined && normalizedContent === null)) {
      return res.status(400).json({ error: 'Enter a valid title and content' });
    }

    if (category !== undefined && !['note', 'schedule'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (done !== undefined && typeof done !== 'boolean') {
      return res.status(400).json({ error: 'Done must be a boolean' });
    }

    const normalizedCategory = category;
    const parsedStartAt = startAt === undefined ? null : parseDateTime(startAt);
    const parsedEndAt = endAt === undefined ? null : parseDateTime(endAt);
    const normalizedReminder = parseReminderMinutes(reminderMinutesBefore);
    if ((parsedStartAt && !parsedStartAt.valid) || (parsedEndAt && !parsedEndAt.valid) || normalizedReminder === null) {
      return res.status(400).json({ error: 'Enter valid dates and reminder settings' });
    }

    const existingNote = await NoteModel.getNoteById(req.params.id, req.user.id);
    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const nextCategory = normalizedCategory || existingNote.category || 'schedule';
    const nextStartAt = parsedStartAt ? parsedStartAt.value : existingNote.startAt;
    const nextEndAt = parsedEndAt ? parsedEndAt.value : existingNote.endAt;

    if (nextCategory === 'schedule' && !nextStartAt) {
      return res.status(400).json({ error: 'Start time is required for schedule items' });
    }

    if (nextEndAt && !nextStartAt) {
      return res.status(400).json({ error: 'An end time requires a start time' });
    }

    if (nextStartAt && nextEndAt && new Date(nextEndAt) <= new Date(nextStartAt)) {
      return res.status(400).json({ error: 'End time must be later than start time' });
    }

    const shouldResetReminder =
      startAt !== undefined ||
      endAt !== undefined ||
      reminderMinutesBefore !== undefined ||
      normalizedCategory !== undefined ||
      done === false;

    const note = await NoteModel.updateNote(req.params.id, req.user.id, {
      ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
      ...(normalizedContent !== undefined ? { content: normalizedContent } : {}),
      ...(parsedStartAt ? { startAt: parsedStartAt.value } : {}),
      ...(parsedEndAt ? { endAt: parsedEndAt.value } : {}),
      ...(done !== undefined ? { done } : {}),
      ...(normalizedCategory !== undefined ? { category: normalizedCategory } : {}),
      ...(reminderMinutesBefore !== undefined ? { reminderMinutesBefore: normalizedReminder } : {}),
      ...(shouldResetReminder ? { reminderSent: false } : {})
    });

    await scheduleReminder(note, req.user.email);

    await broadcastNotes(req.user.id);
    res.json({ message: 'Note updated successfully', note });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await NoteModel.deleteNote(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Note not found' });
    }

    clearReminder(req.params.id);
    await broadcastNotes(req.user.id);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

router.initializeReminders = initializeReminders;
router.clearReminderTimers = clearReminderTimers;
router.getScheduledReminderCount = () => reminderTimeouts.size;

module.exports = router;
