const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./voting.db', (err) => {
  if (err) console.error('Database opening error: ', err.message);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE,
    has_voted INTEGER DEFAULT 0,
    voted_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    position TEXT,
    manifesto TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    position TEXT,
    candidate_id INTEGER
  )`);
});

// API: Student Login & Verification
app.post('/api/verify', (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'Student ID is required' });

  db.get(`SELECT * FROM users WHERE student_id = ?`, [student_id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (!user) {
      db.run(`INSERT INTO users (student_id, has_voted) VALUES (?, 0)`, [student_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ student_id, has_voted: 0 });
      });
    } else {
      res.json(user);
    }
  });
});

// API: Admin Login Authentication
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  // Set your secure admin credentials here
  if (username === 'admin' && password === 'collegeadmin123') {
    res.json({ success: true, token: 'secure_admin_token_xyz' });
  } else {
    res.status(401).json({ error: 'Invalid admin username or password!' });
  }
});

// API: Get Candidates
app.get('/api/candidates', (req, res) => {
  db.all(`SELECT * FROM candidates`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// API: Admin - Add Candidate
app.post('/api/admin/candidates', (req, res) => {
  const { name, position, manifesto } = req.body;
  if (!name || !position) return res.status(400).json({ error: 'Name and position required' });

  db.run(`INSERT INTO candidates (name, position, manifesto) VALUES (?, ?, ?)`, 
    [name, position, manifesto || 'No manifesto provided.'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, position, manifesto });
  });
});

// API: Admin - Delete Candidate
app.delete('/api/admin/candidates/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM candidates WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Candidate deleted successfully' });
  });
});

// API: Cast Vote Securely
app.post('/api/vote', (req, res) => {
  const { student_id, votes } = req.body;
  if (!student_id || !votes) return res.status(400).json({ error: 'Invalid voting data' });

  db.get(`SELECT has_voted FROM users WHERE student_id = ?`, [student_id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Student not found' });
    if (user.has_voted === 1) return res.status(400).json({ error: 'Security Alert: User has already voted!' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`INSERT INTO votes (student_id, position, candidate_id) VALUES (?, ?, ?)`);
      for (const [position, candidate_id] of Object.entries(votes)) {
        stmt.run(student_id, position, candidate_id);
      }
      stmt.finalize();

      db.run(`UPDATE users SET has_voted = 1, voted_at = CURRENT_TIMESTAMP WHERE student_id = ?`, [student_id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        db.run('COMMIT');
        res.json({ message: 'Votes cast successfully!' });
      });
    });
  });
});

// API: Get Results
app.get('/api/results', (req, res) => {
  const query = `
    SELECT c.id, c.name, c.position, c.manifesto, COUNT(v.id) as vote_count
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// API: Admin Audit Log
app.get('/api/admin/audit', (req, res) => {
  db.all(`SELECT student_id, has_voted, voted_at FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get(`SELECT COUNT(*) as total FROM users`, [], (err, totalRow) => {
      db.get(`SELECT COUNT(*) as voted FROM users WHERE has_voted = 1`, [], (err, votedRow) => {
        res.json({
          total_registered: totalRow.total,
          total_voted: votedRow.voted,
          voters: users
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});