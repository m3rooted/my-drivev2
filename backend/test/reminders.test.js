process.env.JWT_SECRET = 'test-only-secret-with-enough-entropy';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const User = require('../models/User');
const FileModel = require('../models/File');
const NoteModel = require('../models/Note');
const notesRouter = require('../routes/notes');
const { initializePersistence } = require('../storage/persistence');

const models = { User, FileModel, NoteModel };
let tempDir;
let storePath;
let originalMailUser;
let originalMailPassword;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-reminders-'));
  storePath = path.join(tempDir, 'drive-store.json');
  originalMailUser = process.env.MAIL_USER;
  originalMailPassword = process.env.MAIL_APP_PASSWORD;
  process.env.MAIL_USER = 'reminders@example.test';
  process.env.MAIL_APP_PASSWORD = 'test-only-password';
  await initializePersistence(models, { filePath: storePath });
  const user = await User.create({ email: 'reminder-owner@example.test', name: 'Reminder owner', password: 'a sufficiently long password' });
  await NoteModel.createNote({
    userId: user.id,
    title: 'Future reminder',
    content: '',
    category: 'schedule',
    startAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    endAt: null,
    reminderMinutesBefore: 10
  });
});

after(async () => {
  notesRouter.clearReminderTimers();
  if (originalMailUser === undefined) delete process.env.MAIL_USER;
  else process.env.MAIL_USER = originalMailUser;
  if (originalMailPassword === undefined) delete process.env.MAIL_APP_PASSWORD;
  else process.env.MAIL_APP_PASSWORD = originalMailPassword;
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('reschedules persisted reminders after loading the store on restart', async () => {
  notesRouter.clearReminderTimers();
  await initializePersistence(models, { filePath: storePath });

  const scheduled = await notesRouter.initializeReminders();

  assert.equal(scheduled, 1);
  assert.equal(notesRouter.getScheduledReminderCount(), 1);
});
