require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (used by Railway and live status indicator)
app.get('/api/health', async (req, res) => {
  try {
    const start = Date.now();
    const result = await db.pool.query('SELECT current_database(), current_user, version()');
    const latency = Date.now() - start;
    const clusterCountRes = await db.pool.query('SELECT COUNT(*) FROM clusters');

    res.json({
      status: 'ok',
      db: 'connected',
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
      latencyMs: latency,
      clustersCount: parseInt(clusterCountRes.rows[0].count, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      db: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Authentication endpoint (Username only authentication)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const user = await db.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    res.json({
      success: true,
      user: {
        username: user.username,
        role: user.role,
      },
      message: 'Login successful'
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error during login' });
  }
});

// Verify authentication status
app.get('/api/auth/verify', (req, res) => {
  res.json({ success: true });
});

// Get all clusters with nested schools and class records
app.get('/api/clusters', async (req, res) => {
  try {
    const clusters = await db.getAllClusters();
    res.json({ success: true, clusters });
  } catch (err) {
    console.error('Error fetching clusters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a new cluster
app.post('/api/clusters', async (req, res) => {
  try {
    const { code, district, hubName } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, error: 'Cluster code is required' });
    }
    const newCluster = await db.createCluster({
      code: code.trim().toUpperCase(),
      district: (district || 'Khairpur Mirs').trim(),
      hubName: (hubName || 'GBHS - New Hub School').trim(),
    });
    res.status(201).json({ success: true, cluster: newCluster });
  } catch (err) {
    console.error('Error creating cluster:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add a school to a cluster
app.post('/api/clusters/:code/schools', async (req, res) => {
  try {
    const { code } = req.params;
    const { name, type, cell } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'School name is required' });
    }
    const school = await db.addSchool(code, {
      name: name.trim(),
      type: (type || 'GBPS').trim().toUpperCase(),
      cell: (cell || 'C1').trim().toUpperCase(),
    });
    res.status(201).json({ success: true, school });
  } catch (err) {
    console.error('Error adding school:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update school metadata (name, type, SEMIS, contact, etc.)
app.put('/api/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.updateSchool(id, req.body);
    res.json({ success: true, message: 'School updated successfully' });
  } catch (err) {
    console.error('Error updating school:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a cell school
app.delete('/api/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteSchool(id);
    res.json({ success: true, message: 'School deleted successfully' });
  } catch (err) {
    console.error('Error deleting school:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update class enrolment records for a school
app.put('/api/schools/:id/classes', async (req, res) => {
  try {
    const { id } = req.params;
    const { classes } = req.body;
    if (!classes || typeof classes !== 'object') {
      return res.status(400).json({ success: false, error: 'Classes object is required' });
    }
    await db.updateSchoolClasses(id, classes);
    res.json({ success: true, message: 'Classes updated successfully' });
  } catch (err) {
    console.error('Error updating class records:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset all class figures for a cluster
app.post('/api/clusters/:code/reset', async (req, res) => {
  try {
    const { code } = req.params;
    await db.resetClusterClasses(code);
    res.json({ success: true, message: 'Cluster class figures reset successfully' });
  } catch (err) {
    console.error('Error resetting cluster classes:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real-time school submissions report (submitted vs pending)
app.get('/api/clusters/:code/submissions', async (req, res) => {
  try {
    const { code } = req.params;
    const report = await db.getClusterSubmissions(code);
    res.json({ success: true, report });
  } catch (err) {
    console.error('Error fetching submissions report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Convenience submission endpoint
app.get('/api/submissions', async (req, res) => {
  try {
    const code = req.query.cluster || 'KX03099';
    const report = await db.getClusterSubmissions(code);
    res.json({ success: true, report });
  } catch (err) {
    console.error('Error fetching submissions report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Fallback to index.html for single-page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server with auto-initialization
async function startServer() {
  try {
    await db.initDb();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🚀 Hub Cluster Server running on http://localhost:${PORT}`);
      console.log(`📡 Ready for Railway Deployment (0.0.0.0:${PORT})`);
      console.log(`====================================================`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nGracefully closing server & database pool...');
      server.close(async () => {
        await db.pool.end();
        console.log('Database pool closed. Exiting.');
        process.exit(0);
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// ─── Start ───────────────────────────────────────────────
// Run as a normal server when executed directly (local / Railway / Render)
// Export the app for Vercel serverless deployment
if (require.main === module) {
  startServer();
} else {
  // Vercel serverless — initialise DB once, export app
  db.initDb()
    .then(() => console.log('DB ready for serverless'))
    .catch(err => console.error('DB init error:', err));
  module.exports = app;
}
