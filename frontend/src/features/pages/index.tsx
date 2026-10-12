import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Button, LoadingState, PageHeader } from "../../components/shared";
import type { PageContext } from "../page-types";

const DashboardPage = lazy(() =>
  import("../dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const IcpPage = lazy(() =>
  import("../icps/IcpPage").then((module) => ({
    default: module.IcpPage,
  })),
);
const ProspectsPage = lazy(() =>
  import("../prospects/ProspectsPage").then((module) => ({
    default: module.ProspectsPage,
  })),
);
const OutreachPage = lazy(() =>
  import("../outreach/OutreachPage").then((module) => ({
    default: module.OutreachPage,
  })),
);
const NextActionsPage = lazy(() =>
  import("../next-actions/NextActionsPage").then((module) => ({
    default: module.NextActionsPage,
  })),
);
const ActivityPage = lazy(() =>
  import("../activity/ActivityPage").then((module) => ({
    default: module.ActivityPage,
  })),
);
const UsagePage = lazy(() =>
  import("../usage/UsagePage").then((module) => ({
    default: module.UsagePage,
  })),
);
const SettingsPage = lazy(() =>
  import("../settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

function NotFoundPage({ navigate }: PageContext) {
  return (
    <div className="page-stack">
      <PageHeader
        title="Page not found"
        description="This route is not part of the BlueCode OS MVP preview."
      />
      <section className="card panel">
        <Button onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      </section>
    </div>
  );
}

export function renderRoute(context: PageContext) {
  const { path } = context;
  let page: ReactNode;

  if (path === "/" || path === "/dashboard") {
    page = <DashboardPage {...context} />;
  } else if (
    path === "/icps" ||
    path === "/icps/new" ||
    /^\/icps\/[^/]+$/.test(path)
  ) {
    page = <IcpPage key={path} {...context} />;
  } else if (
    path === "/prospects" ||
    path === "/prospects/discover" ||
    /^\/prospects\/[^/]+$/.test(path)
  ) {
    page = <ProspectsPage key={path} {...context} />;
  } else if (
    path === "/outreach" ||
    /^\/outreach\/[^/]+$/.test(path) ||
    path === "/outreach/messages" ||
    /^\/outreach\/messages\/[^/]+$/.test(path)
  ) {
    page = <OutreachPage key={path} {...context} />;
  } else if (path === "/next-actions") {
    page = <NextActionsPage {...context} />;
  } else if (path === "/activity") {
    page = <ActivityPage {...context} />;
  } else if (path === "/usage") {
    page = <UsagePage {...context} />;
  } else if (path === "/settings") {
    page = <SettingsPage {...context} />;
  } else {
    page = <NotFoundPage {...context} />;
  }

  return (
    <Suspense
      fallback={
        <div className="page-stack" aria-live="polite" aria-busy="true">
          <LoadingState label="Loading page…" />
        </div>
      }
    >
      {page}
    </Suspense>
  );
}
