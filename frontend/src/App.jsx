
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import StartupSetup from "./pages/StartupSetup";
import ICPBuilder from "./pages/ICPBuilder";
import ICPReview from "./pages/ICPReview";
import BookingSetup from "./pages/BookingSetup";
import Dashboard from "./pages/Dashboard";
import Prospects from "./pages/Prospects";
import ProspectIntelligence from "./pages/ProspectIntelligence";
import Leads from "./pages/Leads";
import DecisionMakers from "./pages/DecisionMakers";
import Outreach from "./pages/Outreach";
import FollowUps from "./pages/FollowUps";
import NextBestAction from "./pages/NextBestAction";
import Pipeline from "./pages/Pipeline";
import SettingsPage from "./pages/SettingsPage";
import Reports from "./pages/Reports";
import { usePrototype } from "./context/PrototypeContext";
import { getToken } from "./api/client";

const onboardingPaths = [
  "/startup-setup",
  "/icp-builder",
  "/icp-review",
  "/booking-setup"
];

// Blocks pages for signed-out users and waits for the saved workspace to load
function RequireAuth({ children }) {
  const { workspaceLoading } = usePrototype();
  if (!getToken()) return <Navigate to="/login" replace />;
  if (workspaceLoading) {
    return <div style={{ padding: 40, fontSize: 18 }}>Loading your workspace...</div>;
  }
  return children;
}

function FlowGate({ children }) {
  const {
    icp,
    icpApproved,
    bookingUrl
  } = usePrototype();

  const location = useLocation();

  const hasBookingUrl = (() => {
    try {
      return new URL(bookingUrl).protocol === "https:";
    } catch {
      return false;
    }
  })();

  // Startup details are optional for entering the ICP Builder. New accounts
  // start with their ICP profile; booking remains the final onboarding step.
  const requiredPath = !icp
    ? "/icp-builder"
    : !icpApproved
      ? "/icp-review"
      : !hasBookingUrl
        ? "/booking-setup"
        : null;

  const currentStep = onboardingPaths.indexOf(location.pathname);
  const requiredStep = onboardingPaths.indexOf(requiredPath);

  if (
    requiredPath &&
    (currentStep === -1 || currentStep > requiredStep)
  ) {
    return <Navigate to={requiredPath} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/startup-setup"
        element={<RequireAuth><FlowGate><StartupSetup /></FlowGate></RequireAuth>}
      />
      <Route
        path="/icp-builder"
        element={<RequireAuth><FlowGate><ICPBuilder /></FlowGate></RequireAuth>}
      />
      <Route
        path="/icp-review"
        element={<RequireAuth><FlowGate><ICPReview /></FlowGate></RequireAuth>}
      />
      <Route
        path="/booking-setup"
        element={<RequireAuth><FlowGate><BookingSetup /></FlowGate></RequireAuth>}
      />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/prospects" element={<Prospects />} />
        <Route path="/prospects/:id" element={<ProspectIntelligence />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/decision-makers" element={<DecisionMakers />} />
        <Route path="/outreach" element={<Outreach />} />
        <Route path="/follow-ups" element={<FollowUps />} />
        <Route path="/next-best-action" element={<NextBestAction />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
