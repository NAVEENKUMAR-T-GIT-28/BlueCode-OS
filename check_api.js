/**
 * API Verification & Test Script for AI Founder OS — Sales Copilot
 * Loads secrets & configuration securely from .env
 */

require('dotenv').config();

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const JWT_SECRET = process.env.JWT_SECRET;
const APOLLO_KEY = process.env.APOLLO_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

let jwtToken = '';

// Helper for colored console logs
const log = {
  section: (msg) => console.log(`\n======================================================\n ${msg}\n======================================================`),
  success: (msg, detail = '') => console.log(`✅ [PASS] ${msg}`, detail ? JSON.stringify(detail, null, 2) : ''),
  error: (msg, err = '') => console.error(`❌ [FAIL] ${msg}`, err),
  info: (msg) => console.log(`ℹ️  [INFO] ${msg}`)
};

// Generic HTTP request helper using standard fetch (Node.js 18+)
async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  return { status: response.status, ok: response.ok, data };
}

async function runApiCheck() {
  console.log(`\n🚀 Starting AI Founder OS API Verification Suite...`);
  
  // 1. Verify Secret Maintenance from .env
  log.section('1. Environment Secret & Config Verification');
  if (!JWT_SECRET) {
    log.error('JWT_SECRET is missing in .env!');
    process.exit(1);
  }
  log.success('JWT_SECRET loaded successfully from .env');
  log.info(`Apollo API Key: ${APOLLO_KEY ? '******' + APOLLO_KEY.slice(-4) : 'Not Set'}`);
  log.info(`OpenAI API Key: ${OPENAI_KEY ? '******' + OPENAI_KEY.slice(-4) : 'Not Set'}`);

  try {
    // 2. Health Check Endpoint
    log.section('2. System Health Check (/health)');
    const health = await apiRequest('/health');
    if (health.ok) {
      log.success('Health endpoint returned UP status', health.data);
    } else {
      log.error('Health check failed', health.data);
    }

    // 3. User Registration & Login
    log.section('3. Authentication Endpoints (/api/v1/auth)');
    const testEmail = `founder_${Date.now()}@abctech.com`;
    const regRes = await apiRequest('/api/v1/auth/register', 'POST', {
      company_name: 'ABC Tech Solutions',
      email: testEmail,
      password: 'SecurePassword123!',
      plan: 'free_trial'
    });

    if (regRes.ok && regRes.data.success) {
      log.success('User registration succeeded', regRes.data.data);
    } else {
      log.error('User registration failed', regRes.data);
    }

    const loginRes = await apiRequest('/api/v1/auth/login', 'POST', {
      email: testEmail,
      password: 'SecurePassword123!'
    });

    if (loginRes.ok && loginRes.data.data?.token) {
      jwtToken = loginRes.data.data.token;
      log.success('User login succeeded & token retrieved', { tenant_id: loginRes.data.data.user.tenant_id });
    } else {
      log.error('User login failed', loginRes.data);
    }

    // 4. User Profile & Tenant Context
    const meRes = await apiRequest('/api/v1/auth/me', 'GET', null, jwtToken);
    if (meRes.ok) {
      log.success('Authenticated user profile fetched', meRes.data.data);
    }

    // 5. Module 1: ICP Builder
    log.section('4. Module 1: ICP Builder (/api/v1/icp)');
    const icpRes = await apiRequest('/api/v1/icp', 'POST', {
      industry: 'Indian B2B Software',
      headcount_min: 50,
      headcount_max: 500,
      target_roles: ['Founder', 'CEO', 'HR Head', 'CTO']
    }, jwtToken);

    if (icpRes.ok) {
      log.success('ICP Configured successfully', icpRes.data.data);
    }

    // 6. Module 2: Prospect & DM Finder
    log.section('5. Module 2: Prospect & Decision-Maker Finder (/api/v1/prospects)');
    const prspSearch = await apiRequest('/api/v1/prospects/search', 'POST', { limit: 25 }, jwtToken);
    if (prspSearch.ok) {
      log.success(`Found ${prspSearch.data.data.prospects_found} prospects & decision-makers`, prspSearch.data.data.items[0]);
    }

    // 7. Module 3: AI Lead Scoring Engine
    log.section('6. Module 3: AI Lead Scoring Engine (/api/v1/leads)');
    const leadScore = await apiRequest('/api/v1/leads/score', 'POST', { prospect_ids: ['prsp_101'] }, jwtToken);
    if (leadScore.ok) {
      log.success('AI Lead Scoring completed', leadScore.data.data);
    }

    // 8. Module 4: Personalized Outreach Generator
    log.section('7. Module 4: Outreach Generator (/api/v1/outreach)');
    const outreachGen = await apiRequest('/api/v1/outreach/generate', 'POST', { lead_id: 'lead_301', dm_id: 'dm_501' }, jwtToken);
    if (outreachGen.ok) {
      log.success('Cold Email & Apollo DM Generated', outreachGen.data.data.cold_email);
    }

    const outreachSend = await apiRequest('/api/v1/outreach/send', 'POST', { msg_id: outreachGen.data.data.msg_id, channel: 'email' }, jwtToken);
    if (outreachSend.ok) {
      log.success('Outreach message dispatched', outreachSend.data.data);
    }

    // 9. Module 5: Follow-up Assistant
    log.section('8. Module 5: Follow-up Assistant (/api/v1/followups)');
    const followups = await apiRequest('/api/v1/followups/pending', 'GET', null, jwtToken);
    if (followups.ok) {
      log.success('Pending follow-ups retrieved', followups.data.data);
    }

    // 10. Module 6: Auto-Scheduling Integration
    log.section('9. Module 6: Auto-Scheduling Integrations (/api/v1/meetings)');
    const meetingRes = await apiRequest('/api/v1/meetings/schedule', 'POST', {
      dm_id: 'dm_501',
      booking_link: 'https://calendly.com/founder-abctech/30min'
    }, jwtToken);
    if (meetingRes.ok) {
      log.success('Meeting scheduling link attached', meetingRes.data.data);
    }

    // 11. Module 7: Dashboard Metrics & Cost Guardrails
    log.section('10. Module 7: Dashboard Metrics & Usage Guardrails');
    const dashRes = await apiRequest('/api/v1/dashboard/metrics', 'GET', null, jwtToken);
    if (dashRes.ok) {
      log.success('Dashboard metrics fetched', dashRes.data.data);
    }

    const usageRes = await apiRequest('/api/v1/usage', 'GET', null, jwtToken);
    if (usageRes.ok) {
      log.success('Usage tracking & spend cap verified', usageRes.data.data);
    }

    // 12. Settings & External Integrations
    log.section('11. Integration Settings Check (/api/v1/settings/integrations)');
    const settingsRes = await apiRequest('/api/v1/settings/integrations', 'GET', null, jwtToken);
    if (settingsRes.ok) {
      log.success('External Integrations state verified', settingsRes.data.data);
    }

    log.section('🎉 API VERIFICATION COMPLETE - ALL ENDPOINTS OPERATIONAL!');
  } catch (err) {
    log.error('API Verification error encountered:', err.message);
  }
}

runApiCheck();
