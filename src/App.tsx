import { createBrowserRouter, createMemoryRouter, RouterProvider } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ChatPage } from "@/pages/ChatPage";
import { PortfolioPage } from "@/pages/PortfolioPage";
import { StatisticsPage } from "@/pages/StatisticsPage";
import { MarketsPage } from "@/pages/MarketsPage";
import { SymbolPage } from "@/pages/SymbolPage";
import { WatchlistPage } from "@/pages/WatchlistPage";
import { ResearchPage } from "@/pages/ResearchPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { LoginPage } from "@/pages/LoginPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { TermsPage } from "@/pages/TermsPage";
import { LandingRoute } from "@/pages/LandingRoute";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { TitleManager } from "@/components/TitleManager";

const pages = [
  { path: "/welcome", handle: { title: "Welcome" }, element: <LandingRoute /> },
  { path: "/login", handle: { title: "Sign in" }, element: <LoginPage /> },
  { path: "/privacy", handle: { title: "Privacy" }, element: <PrivacyPage /> },
  { path: "/terms", handle: { title: "Terms" }, element: <TermsPage /> },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ChatPage /> },
      { path: "c/:id", element: <ChatPage /> },
      { path: "portfolio", handle: { title: "Portfolio" }, element: <PortfolioPage /> },
      { path: "statistics", handle: { title: "Statistics" }, element: <StatisticsPage /> },
      { path: "markets", handle: { title: "Markets" }, element: <MarketsPage /> },
      { path: "symbol/:symbol", handle: { title: "Symbol" }, element: <SymbolPage /> },
      { path: "watchlist", handle: { title: "Watchlist" }, element: <WatchlistPage /> },
      { path: "research", handle: { title: "Financial Research" }, element: <ResearchPage /> },
      { path: "settings", handle: { title: "Settings" }, element: <SettingsPage /> },
      { path: "profile", handle: { title: "Profile" }, element: <ProfilePage /> },
      { path: "*", handle: { title: "Page not found" }, element: <NotFoundPage /> },
    ],
  },
];

const routes = [{ element: <TitleManager />, children: pages }];

// The single-file build is embedded in sandboxed frames that do not own the URL, so it routes in memory.
const router = import.meta.env.MODE === "single" ? createMemoryRouter(routes, { initialEntries: ["/login"] }) : createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
