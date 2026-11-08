import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { loadAuth } from "@/lib/auth";

const LandingPage = lazy(() => import("./LandingPage").then((m) => ({ default: m.LandingPage })));

/** If the landing page can't load (offline, or a deploy replaced the file), send the visitor to sign-in instead of an error screen. */
class LandingBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[equidy] landing page failed to load:", error.message);
  }

  render() {
    return this.state.failed ? <Navigate to="/login" replace /> : this.props.children;
  }
}

/** Loads the landing page on demand, so signed-in users never download it. */
export function LandingRoute() {
  // /welcome sits outside the app shell, so it checks the session itself.
  useEffect(() => { void loadAuth(); }, []);
  return (
    <LandingBoundary>
      <Suspense fallback={<div className="dark min-h-full bg-bg" />}>
        <LandingPage />
      </Suspense>
    </LandingBoundary>
  );
}
