const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { persistState } = require('../storage/persistence');

// Simple in-memory storage (replace with database in production)
class User {
  constructor() {
    this.users = [];
  }

  async create(userData) {
    const { email, password, name } = userData;
    const normalizedEmail = email.toLowerCase();
    
    // Check if user already exists
    const existingUser = this.users.find(user => user.email === normalizedEmail);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Recheck after hashing because concurrent requests may have passed the first check.
    if (this.users.some(user => user.email === normalizedEmail)) {
      throw new Error('User already exists');
    }
    
    const user = {
      id: uuidv4(),
      email: normalizedEmail,
      password: hashedPassword,
      name,
      createdAt: new Date(),
      rootFolderId: uuidv4() // Each user gets a root folder
    };

    this.users.push(user);
    await persistState();
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email) {
    const normalizedEmail = email.toLowerCase();
    return this.users.find(user => user.email === normalizedEmail);
  }

  async findById(id) {
    const user = this.users.find(user => user.id === id);
    if (user) {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  }

  async validatePassword(user, password) {
    return await bcrypt.compare(password, user.password);
  }
}

module.exports = new User();
