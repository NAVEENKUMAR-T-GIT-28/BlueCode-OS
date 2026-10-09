require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// In-Memory Mock Store for Demo / Testing
const db = {
  startups: {},
  users: {},
  icps: {},
  prospects: {},
  leads: {},
  outreach: {},
  usage: {}
};

// ----------------------------------------------------
// Middleware: JWT Authentication & Tenant Isolation
// ----------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Access token is missing or invalid' }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid or expired token' }
    });
  }
}

// ----------------------------------------------------
// Health Check Endpoint
// ----------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ----------------------------------------------------
// Auth Endpoints
// ----------------------------------------------------
app.post('/api/v1/auth/register', (req, res) => {
  const { company_name, email, password, plan } = req.body;

  if (!email || !password || !company_name) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'company_name, email, and password are required' }
    });
  }

  const tenant_id = 'tenant_' + Math.random().toString(36).substring(2, 9);
  const user_id = 'usr_' + Math.random().toString(36).substring(2, 9);

  db.startups[tenant_id] = { company_name, plan: plan || 'free_trial', status: 'active' };
  db.users[email] = { user_id, tenant_id, password, role: 'admin' };
  db.usage[tenant_id] = { api_spend_inr: 0, spend_cap_inr: 1000.00 };

  const token = jwt.sign({ user_id, email, tenant_id, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });

  res.status(201).json({
    success: true,
    data: { tenant_id, user_id, token },
    message: 'Startup account registered successfully'
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users[email];

  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' }
    });
  }

  const token = jwt.sign(
    { user_id: user.user_id, email: user.email, tenant_id: user.tenant_id, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        user_id: user.user_id,
        email,
        tenant_id: user.tenant_id,
        role: user.role
      }
    }
  });
});

app.get('/api/v1/auth/me', authenticateToken, (req, res) => {
  const startup = db.startups[req.user.tenant_id] || { company_name: 'ABC Tech', plan: 'free_trial', status: 'active' };
  res.json({
    success: true,
    data: {
      user_id: req.user.user_id,
      email: req.user.email,
      tenant_id: req.user.tenant_id,
      company_name: startup.company_name,
      plan: startup.plan,
      status: startup.status
    }
  });
});

// ----------------------------------------------------
// ICP Builder Endpoints
// ----------------------------------------------------
app.post('/api/v1/icp', authenticateToken, (req, res) => {
  const tenant_id = req.user.tenant_id;
  const icp_id = 'icp_' + Math.random().toString(36).substring(2, 8);

  db.icps[tenant_id] = {
    icp_id,
    criteria: req.body,
    updated_at: new Date().toISOString()
  };

  res.json({
    success: true,
    data: { icp_id, tenant_id, criteria: req.body, updated_at: db.icps[tenant_id].updated_at }
  });
});

app.get('/api/v1/icp', authenticateToken, (req, res) => {
  const tenant_id = req.user.tenant_id;
  const icp = db.icps[tenant_id] || {
    icp_id: 'icp_default',
    criteria: {
      industry: 'Indian B2B Software',
      headcount_min: 50,
      headcount_max: 500,
      target_roles: ['Founder', 'CEO', 'HR Head']
    }
  };

  res.json({ success: true, data: icp });
});

// ----------------------------------------------------
// Prospect & DM Finder Endpoints
// ----------------------------------------------------
app.post('/api/v1/prospects/search', authenticateToken, (req, res) => {
  const tenant_id = req.user.tenant_id;
  const prospectsList = [
    {
      prospect_id: 'prsp_101',
      company_name: 'Nexus Software Solutions',
      industry: 'B2B SaaS',
      headcount: 120,
      geography: 'Bengaluru, India',
      decision_makers: [
        {
          dm_id: 'dm_501',
          full_name: 'Rohan Sharma',
          title: 'HR Head',
          email: 'rohan@nexussoft.com',
          linkedin_url: 'https://linkedin.com/in/rohansharma'
        }
      ]
    },
    {
      prospect_id: 'prsp_102',
      company_name: 'Apex Analytics',
      industry: 'FinTech',
      headcount: 250,
      geography: 'Mumbai, India',
      decision_makers: [
        {
          dm_id: 'dm_502',
          full_name: 'Priya Patel',
          title: 'CEO & Founder',
          email: 'priya@apexanalytics.io',
          linkedin_url: 'https://linkedin.com/in/priyapatel'
        }
      ]
    }
  ];

  db.prospects[tenant_id] = prospectsList;

  res.json({
    success: true,
    data: {
      prospects_found: prospectsList.length,
      items: prospectsList
    }
  });
});

app.get('/api/v1/prospects', authenticateToken, (req, res) => {
  const tenant_id = req.user.tenant_id;
  const items = db.prospects[tenant_id] || [];
  res.json({ success: true, data: { total: items.length, prospects: items } });
});

// ----------------------------------------------------
// AI Lead Scoring Engine Endpoints
// ----------------------------------------------------
app.post('/api/v1/leads/score', authenticateToken, (req, res) => {
  const tenant_id = req.user.tenant_id;
  const scoredLeads = [
    {
      lead_id: 'lead_301',
      prospect_id: 'prsp_101',
      company_name: 'Nexus Software Solutions',
      score: 92,
      category: 'Hot',
      rationale: 'Perfect ICP fit: 120 headcount B2B SaaS in Bengaluru with active HR hiring drive.'
    },
    {
      lead_id: 'lead_302',
      prospect_id: 'prsp_102',
      company_name: 'Apex Analytics',
      score: 84,
      category: 'High',
      rationale: 'Strong match: 250 headcount FinTech in Mumbai, founder-led team.'
    }
  ];

  db.leads[tenant_id] = scoredLeads;

  res.json({ success: true, data: scoredLeads });
});

app.get('/api/v1/leads', authenticateToken, (req, res) => {
  const tenant_id = req.user.tenant_id;
  const category = req.query.category;
  let items = db.leads[tenant_id] || [];

  if (category) {
    items = items.filter(l => l.category.toLowerCase() === category.toLowerCase());
  }

  res.json({ success: true, data: { count: items.length, leads: items } });
});

// ----------------------------------------------------
// Personalized Outreach Generator Endpoints
// ----------------------------------------------------
app.post('/api/v1/outreach/generate', authenticateToken, (req, res) => {
  const { lead_id, dm_id } = req.body;
  const msg_id = 'msg_' + Math.random().toString(36).substring(2, 8);

  const outreachData = {
    msg_id,
    lead_id: lead_id || 'lead_301',
    dm_id: dm_id || 'dm_501',
    cold_email: {
      subject: 'Automating HR & Sales workflows at Nexus Software',
      body: 'Hi Rohan,\n\nI noticed Nexus Software is rapidly scaling its B2B SaaS team in Bengaluru. AI Founder OS can automate customer discovery directly for your ICP.\n\nBest,\nFounder'
    },
    apollo_dm: {
      message: 'Hi Rohan, loved your recent post on scaling engineering teams in Bengaluru!'
    },
    follow_up_1: 'Hi Rohan, wanted to quickly bump this to see if Tuesday works for a 15-min chat?',
    follow_up_2: 'Hi Rohan, final follow-up before I clear your thread. Let me know if you are open to exploring this.'
  };

  db.outreach[msg_id] = outreachData;

  res.json({ success: true, data: outreachData });
});

app.post('/api/v1/outreach/send', authenticateToken, (req, res) => {
  const { msg_id, channel } = req.body;
  res.json({
    success: true,
    data: {
      msg_id: msg_id || 'msg_801',
      channel: channel || 'email',
      status: 'DISPATCHED',
      dispatched_at: new Date().toISOString()
    }
  });
});

// ----------------------------------------------------
// Follow-up Assistant Endpoints
// ----------------------------------------------------
app.get('/api/v1/followups/pending', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      pending_count: 18,
      followups: [
        {
          prospect_id: 'prsp_101',
          dm_name: 'Rohan Sharma',
          last_contacted_days_ago: 3,
          recommended_action: 'Send Follow-up #1 (Bump)'
        }
      ]
    }
  });
});

// ----------------------------------------------------
// Auto-Scheduling & Meetings Endpoints
// ----------------------------------------------------
app.post('/api/v1/meetings/schedule', authenticateToken, (req, res) => {
  const { dm_id, booking_link, reply_text } = req.body;
  res.json({
    success: true,
    data: {
      dm_id: dm_id || 'dm_501',
      intent_detected: 'POSITIVE',
      meeting_status: 'INVITE_SENT',
      calendar_link_appended: booking_link || 'https://calendly.com/founder-abctech/30min'
    }
  });
});

// ----------------------------------------------------
// Dashboard & Usage Guardrails Endpoints
// ----------------------------------------------------
app.get('/api/v1/dashboard/metrics', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      prospects_found: 25,
      hot_leads: 12,
      messages_ready: 10,
      followups_pending: 8,
      meetings_booked: 3
    }
  });
});

app.get('/api/v1/usage', authenticateToken, (req, res) => {
  const tenant_id = req.user.tenant_id;
  const usage = db.usage[tenant_id] || { api_spend_inr: 240.50, spend_cap_inr: 1000.00 };

  res.json({
    success: true,
    data: {
      tenant_id,
      api_spend_inr: usage.api_spend_inr,
      spend_cap_inr: usage.spend_cap_inr,
      remaining_spend_inr: usage.spend_cap_inr - usage.api_spend_inr
    }
  });
});

// ----------------------------------------------------
// Settings & Integrations
// ----------------------------------------------------
app.get('/api/v1/settings/integrations', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      apollo_connected: Boolean(process.env.APOLLO_API_KEY),
      openai_connected: Boolean(process.env.OPENAI_API_KEY),
      stripe_connected: Boolean(process.env.STRIPE_SECRET_KEY),
      sendgrid_connected: Boolean(process.env.SENDGRID_API_KEY)
    }
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[AI Founder OS API] Server running on http://localhost:${PORT}`);
  console.log(`[AI Founder OS API] Environment: ${process.env.NODE_ENV}`);
});
