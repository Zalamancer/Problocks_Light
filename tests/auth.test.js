import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';
import { resetTestDb, seedTestSchool, testPool } from './setup.js';
import bcrypt from 'bcrypt';

describe('Auth', () => {
  let schoolId;

  beforeEach(async () => {
    await resetTestDb();
    schoolId = await seedTestSchool();
  });

  describe('POST /api/auth/teacher/login', () => {
    it('logs in teacher with correct credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
         VALUES ($1, 'teacher', 'msmith', 'Mr Smith', 'msmith@hsa.edu', $2)`,
        [schoolId, hash]
      );

      const res = await request(app)
        .post('/api/auth/teacher/login')
        .send({ email: 'msmith@hsa.edu', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('teacher');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const hash = await bcrypt.hash('password123', 10);
      await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
         VALUES ($1, 'teacher', 'msmith', 'Mr Smith', 'msmith@hsa.edu', $2)`,
        [schoolId, hash]
      );

      const res = await request(app)
        .post('/api/auth/teacher/login')
        .send({ email: 'msmith@hsa.edu', password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/student/join', () => {
    it('creates student account with class code + username + PIN', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const { rows: [teacher] } = await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
         VALUES ($1, 'teacher', 'msmith', 'Mr Smith', 'msmith@hsa.edu', $2) RETURNING id`,
        [schoolId, hash]
      );
      await testPool.query(
        `INSERT INTO classes (school_id, teacher_id, name, join_code, subject, grade_level)
         VALUES ($1, $2, 'Math 6A', 'ABC123', 'math', 6)`,
        [schoolId, teacher.id]
      );

      const res = await request(app)
        .post('/api/auth/student/join')
        .send({ joinCode: 'ABC123', username: 'johnny', displayName: 'Johnny', pin: '1234' });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.username).toBe('johnny');
    });

    it('rejects invalid join code', async () => {
      const res = await request(app)
        .post('/api/auth/student/join')
        .send({ joinCode: 'INVALID', username: 'johnny', displayName: 'Johnny', pin: '1234' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/student/login', () => {
    it('logs in student with username + PIN', async () => {
      const teacherHash = await bcrypt.hash('password123', 10);
      const { rows: [teacher] } = await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, email, password_hash)
         VALUES ($1, 'teacher', 'msmith', 'Mr Smith', 'msmith@hsa.edu', $2) RETURNING id`,
        [schoolId, teacherHash]
      );
      const { rows: [cls] } = await testPool.query(
        `INSERT INTO classes (school_id, teacher_id, name, join_code) VALUES ($1, $2, 'Math 6A', 'ABC123') RETURNING id`,
        [schoolId, teacher.id]
      );
      const pinHash = await bcrypt.hash('1234', 10);
      const { rows: [student] } = await testPool.query(
        `INSERT INTO users (school_id, role, username, display_name, pin_hash)
         VALUES ($1, 'student', 'johnny', 'Johnny', $2) RETURNING id`,
        [schoolId, pinHash]
      );
      await testPool.query(
        `INSERT INTO class_members (class_id, user_id) VALUES ($1, $2)`,
        [cls.id, student.id]
      );
      await testPool.query(
        `INSERT INTO player_profiles (user_id) VALUES ($1)`,
        [student.id]
      );

      const res = await request(app)
        .post('/api/auth/student/login')
        .send({ username: 'johnny', pin: '1234', schoolId });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('student');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session cookie', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
    });
  });
});
