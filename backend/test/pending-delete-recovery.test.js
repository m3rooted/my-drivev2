const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { recoverPendingFileDeletes, stageFilesForPermanentDelete } = require('../services/pendingFileDeletes');

let tempDir;
let uploadDirectory;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-delete-recovery-'));
  uploadDirectory = path.join(tempDir, 'uploads');
  await fs.mkdir(uploadDirectory, { recursive: true });
});

after(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('restores staged bytes when metadata still exists after a restart', async () => {
  const filename = 'restore-after-restart.bin';
  const sourcePath = path.join(uploadDirectory, filename);
  await fs.writeFile(sourcePath, 'restore me');
  await stageFilesForPermanentDelete([{ id: 'still-in-metadata', filename }], uploadDirectory);

  await recoverPendingFileDeletes([{ id: 'still-in-metadata', filename }], uploadDirectory);

  assert.equal(await fs.readFile(sourcePath, 'utf8'), 'restore me');
  await assert.rejects(fs.access(path.join(uploadDirectory, '.delete-staging')));
});

test('removes staged bytes when metadata committed before a restart', async () => {
  const filename = 'delete-after-restart.bin';
  const sourcePath = path.join(uploadDirectory, filename);
  await fs.writeFile(sourcePath, 'delete me');
  await stageFilesForPermanentDelete([{ id: 'removed-from-metadata', filename }], uploadDirectory);

  await recoverPendingFileDeletes([], uploadDirectory);

  await assert.rejects(fs.access(sourcePath));
  await assert.rejects(fs.access(path.join(uploadDirectory, '.delete-staging')));
});
