const { v4: uuidv4 } = require('uuid');
const { persistState } = require('../storage/persistence');

const MAX_SAVED_MESSAGES = 100;

class Notebook {
  constructor() {
    this.notebooks = [];
  }

  async createNotebook({ userId, title, sources }) {
    const notebook = {
      id: uuidv4(),
      userId,
      title,
      sources,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.notebooks.push(notebook);
    await persistState();
    return notebook;
  }

  async getNotebooksByUserId(userId) {
    return this.notebooks
      .filter((notebook) => notebook.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async getNotebookById(id, userId) {
    return this.notebooks.find((notebook) => notebook.id === id && notebook.userId === userId) || null;
  }

  async addConversationTurn(id, userId, question, answer) {
    const notebook = await this.getNotebookById(id, userId);
    if (!notebook) return null;

    const timestamp = new Date();
    const userMessage = { id: uuidv4(), role: 'user', content: question, createdAt: timestamp };
    const assistantMessage = { id: uuidv4(), role: 'assistant', content: answer, createdAt: timestamp };
    notebook.messages.push(userMessage, assistantMessage);
    notebook.messages = notebook.messages.slice(-MAX_SAVED_MESSAGES);
    notebook.updatedAt = timestamp;
    await persistState();
    return { notebook, userMessage, assistantMessage };
  }

  async deleteNotebook(id, userId) {
    const index = this.notebooks.findIndex((notebook) => notebook.id === id && notebook.userId === userId);
    if (index === -1) return false;

    this.notebooks.splice(index, 1);
    await persistState();
    return true;
  }
}

module.exports = new Notebook();
