export const icp = {
  description:
    "AI-powered workflow automation platform for growing B2B SaaS companies.",

  industries: [
    "B2B SaaS",
    "Enterprise Software",
    "HR Tech",
  ],

  companySize: {
    min: 50,
    max: 500,
  },

  geographies: ["India"],

  decisionMakerTitles: [
    "Founder",
    "Co-Founder",
    "VP Sales",
    "Head of Growth",
    "VP Revenue",
    "HR Head",
  ],

  exclusions: [
    "Companies below 50 employees",
    "B2C companies",
    "Non-India companies",
  ],
};
/* =========================================================
   STARTUP
========================================================= */

export const startup = {
  name: "ABC Technologies",
  founder: "Aslesha M",
  product:
    "AI-powered workflow automation platform for growing SaaS companies.",
  industry: "B2B SaaS",
  geography: "India, Singapore, UAE",
};

/* =========================================================
   DASHBOARD METRICS
========================================================= */

export const metrics = {
  prospectsFound: 25,
  hotLeads: 12,
  messagesReady: 10,
  followUps: 8,
  meetings: 3,
};

/* =========================================================
   PROSPECTS
========================================================= */

export const prospects = [
  {
    id: "acme-technologies",
    company: "Acme Technologies",
    industry: "B2B SaaS",
    location: "Bangalore",
    employees: "51–200",
    score: 96,
    status: "Hot",
    signal: "Hiring Revenue Operations",
    description:
      "Fast-growing B2B SaaS company expanding its revenue operations team.",

    decisionMaker: {
      name: "Rohan Mehta",
      title: "VP Revenue",
      email: "rohan@acmetech.example",
      linkedin: "linkedin.com/in/rohan-mehta",
    },

    whyNow:
      "Acme is actively expanding revenue operations, creating a strong timing signal.",

    whyContact:
      "The company strongly matches the ICP and has a clear sales-growth trigger.",

    nextAction: "Send personalized email",
  },

  {
    id: "nova-systems",
    company: "Nova Systems",
    industry: "Enterprise Software",
    location: "Mumbai",
    employees: "201–500",
    score: 91,
    status: "Hot",
    signal: "Series B expansion",
    description:
      "Enterprise software company scaling customer acquisition after recent funding.",

    decisionMaker: {
      name: "Priya Shah",
      title: "Head of Growth",
      email: "priya@novasystems.example",
      linkedin: "linkedin.com/in/priya-shah",
    },

    whyNow:
      "Recent funding creates pressure to scale acquisition efficiently.",

    whyContact:
      "Nova strongly matches the company-size and geography criteria.",

    nextAction: "Review outreach draft",
  },

  {
    id: "vertex-labs",
    company: "Vertex Labs",
    industry: "AI SaaS",
    location: "Chennai",
    employees: "51–200",
    score: 87,
    status: "High",
    signal: "New VP Sales",
    description:
      "AI SaaS company with a recently appointed sales leadership team.",

    decisionMaker: {
      name: "Arjun Rao",
      title: "VP Sales",
      email: "arjun@vertexlabs.example",
      linkedin: "linkedin.com/in/arjun-rao",
    },

    whyNow:
      "A new sales leader often reviews tooling and processes during the first 90 days.",

    whyContact:
      "The company matches the ICP and has a strong leadership-change trigger.",

    nextAction: "Research recent announcement",
  },

  {
    id: "bright-hire",
    company: "BrightHire",
    industry: "HR Tech",
    location: "Hyderabad",
    employees: "51–200",
    score: 82,
    status: "High",
    signal: "Customer success growth",
    description:
      "HR technology startup expanding its customer-facing operations.",

    decisionMaker: {
      name: "Neha Iyer",
      title: "Co-Founder",
      email: "neha@brighthire.example",
      linkedin: "linkedin.com/in/neha-iyer",
    },

    whyNow:
      "Expansion in customer-facing teams suggests increasing operational complexity.",

    whyContact:
      "BrightHire fits the startup profile and the founder is directly involved in growth.",

    nextAction: "Add personalized context",
  },

  {
    id: "cloudnest",
    company: "CloudNest",
    industry: "Cloud Software",
    location: "Pune",
    employees: "51–200",
    score: 68,
    status: "Medium",
    signal: "B2B sales expansion",
    description:
      "Cloud software company expanding its B2B sales motion.",

    decisionMaker: {
      name: "Karan Malhotra",
      title: "Founder",
      email: "karan@cloudnest.example",
      linkedin: "linkedin.com/in/karan-malhotra",
    },

    whyNow:
      "The company is expanding its B2B sales activity.",

    whyContact:
      "The company partially matches the ICP but has a weaker timing signal.",

    nextAction: "Monitor account",
  },

  {
    id: "pixelworks",
    company: "PixelWorks",
    industry: "Marketing Technology",
    location: "Delhi",
    employees: "11–50",
    score: 54,
    status: "Low",
    signal: "Weak ICP match",
    description:
      "Small marketing technology startup serving SMB customers.",

    decisionMaker: {
      name: "Aditya Kapoor",
      title: "Founder",
      email: "aditya@pixelworks.example",
      linkedin: "linkedin.com/in/aditya-kapoor",
    },

    whyNow:
      "No strong recent buying signal was detected.",

    whyContact:
      "Some ICP attributes match, but current timing confidence is low.",

    nextAction: "Keep in nurture",
  },
];

/* =========================================================
   FOLLOW-UPS
========================================================= */

export const followUps = [
  {
    id: 1,
    company: "Acme Technologies",
    contact: "Rohan Mehta",
    stage: "Follow-up #1",
    due: "Today",
    priority: "High",
    reason: "No reply after personalized first email.",
  },

  {
    id: 2,
    company: "Nova Systems",
    contact: "Priya Shah",
    stage: "Follow-up #2",
    due: "Today",
    priority: "High",
    reason: "Opened the email twice but has not replied.",
  },

  {
    id: 3,
    company: "Vertex Labs",
    contact: "Arjun Rao",
    stage: "Follow-up #1",
    due: "Today",
    priority: "Medium",
    reason: "New sales leader detected.",
  },

  {
    id: 4,
    company: "BrightHire",
    contact: "Neha Iyer",
    stage: "Follow-up #1",
    due: "Tomorrow",
    priority: "Medium",
    reason: "Email delivered successfully.",
  },

  {
    id: 5,
    company: "CloudNest",
    contact: "Karan Malhotra",
    stage: "Nurture",
    due: "Friday",
    priority: "Low",
    reason: "No immediate buying signal detected.",
  },
];

/* =========================================================
   DECISION MAKERS
========================================================= */

export const decisionMakers = prospects.map((prospect) => ({
  ...prospect.decisionMaker,
  company: prospect.company,
  industry: prospect.industry,
  location: prospect.location,
  score: prospect.score,
  status: prospect.status,
}));

/* =========================================================
   OUTREACH
========================================================= */

export const outreach = [
  {
    id: 1,
    company: "Acme Technologies",
    contact: "Rohan Mehta",
    role: "VP Revenue",
    score: 96,

    subject: "Scaling revenue operations at Acme",

    body: `Hi Rohan,

I noticed Acme is expanding its revenue operations team.

At this stage, growing sales teams often spend significant time coordinating prospect research, follow-ups, and account prioritization.

We're building an AI Sales Copilot that helps teams identify the right accounts, understand why now, and turn research into personalized outreach.

Would it be useful if I showed you how it works with a few Acme-like accounts?

Best,
Aslesha`,

    followUp1: "Would it be useful if I shared a quick example?",
    followUp2: "Happy to send over a short walkthrough if helpful.",

    status: "Ready for approval",
  },

  {
    id: 2,
    company: "Nova Systems",
    contact: "Priya Shah",
    role: "Head of Growth",
    score: 91,

    subject: "A thought on Nova's growth motion",

    body: `Hi Priya,

Congrats on Nova's recent growth.

As teams scale after a funding round, keeping prospect research and outreach personalized can become surprisingly time-consuming.

We're building an AI Sales Copilot that helps teams prioritize relevant accounts and generate contextual outreach around the signals behind each prospect.

Open to a quick look?

Best,
Aslesha`,

    followUp1: "Would a short 10-minute walkthrough be useful?",
    followUp2: "Happy to share a few examples relevant to Nova.",

    status: "Draft",
  },

  {
    id: 3,
    company: "Vertex Labs",
    contact: "Arjun Rao",
    role: "VP Sales",
    score: 87,

    subject: "Sales workflow at Vertex Labs",

    body: `Hi Arjun,

I noticed Vertex Labs recently added new sales leadership.

New sales teams often spend the first few months reviewing their prospecting workflow, prioritization, and outreach process.

We're building an AI Sales Copilot that automates much of that workflow.

Would you be open to a quick look?

Best,
Aslesha`,

    followUp1: "Would it make sense to send over a short example?",
    followUp2: "Happy to reconnect when the timing is better.",

    status: "Ready for approval",
  },
];

/* =========================================================
   MEETINGS
========================================================= */

export const meetings = [
  {
    id: 1,
    company: "Acme Technologies",
    contact: "Rohan Mehta",
    date: "Today",
    time: "4:30 PM",
    status: "Confirmed",
  },

  {
    id: 2,
    company: "Nova Systems",
    contact: "Priya Shah",
    date: "Tomorrow",
    time: "11:00 AM",
    status: "Confirmed",
  },

  {
    id: 3,
    company: "Vertex Labs",
    contact: "Arjun Rao",
    date: "Friday",
    time: "3:00 PM",
    status: "Pending",
  },
];

/* =========================================================
   PIPELINE / ANALYTICS
========================================================= */

export const analytics = {
  weeklyActivity: [
    {
      day: "Mon",
      researched: 8,
      contacted: 4,
    },
    {
      day: "Tue",
      researched: 12,
      contacted: 6,
    },
    {
      day: "Wed",
      researched: 10,
      contacted: 5,
    },
    {
      day: "Thu",
      researched: 15,
      contacted: 8,
    },
    {
      day: "Fri",
      researched: 5,
      contacted: 3,
    },
  ],

  funnel: [
    {
      label: "Prospects Found",
      value: 25,
      percentage: 100,
    },
    {
      label: "Hot Leads",
      value: 12,
      percentage: 48,
    },
    {
      label: "Messages Ready",
      value: 10,
      percentage: 40,
    },
    {
      label: "Follow-ups",
      value: 8,
      percentage: 32,
    },
    {
      label: "Meetings Booked",
      value: 3,
      percentage: 12,
    },
  ],
};
