
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./components/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ICPBuilder from "./pages/ICPBuilder";
import Prospects from "./pages/Prospects";
import ProspectResearch from "./pages/ProspectDetails";
import Leads from "./pages/Leads";
import DecisionMakers from "./pages/DecisionMakers";
import Outreach from "./pages/Outreach";
import FollowUps from "./pages/FollowUps";
import PipelineAnalytics from "./pages/PipelineAnalytics";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/icp-builder" element={<ICPBuilder />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/prospects" element={<Prospects />} />
          <Route
            path="/prospects/:id"
            element={<ProspectResearch />}
          />

          <Route path="/leads" element={<Leads />} />
          <Route path="/decision-makers" element={<DecisionMakers />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/pipeline" element={<PipelineAnalytics />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
