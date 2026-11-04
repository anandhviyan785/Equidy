import { createBrowserRouter, createMemoryRouter, Navigate, RouterProvider } from "react-router-dom";
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

const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/terms", element: <TermsPage /> },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ChatPage /> },
      { path: "c/:id", element: <ChatPage /> },
      { path: "portfolio", element: <PortfolioPage /> },
      { path: "statistics", element: <StatisticsPage /> },
      { path: "markets", element: <MarketsPage /> },
      { path: "symbol/:symbol", element: <SymbolPage /> },
      { path: "watchlist", element: <WatchlistPage /> },
      { path: "research", element: <ResearchPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

// The single-file build is embedded in sandboxed frames that do not own the URL, so it routes in memory.
const router = import.meta.env.MODE === "single" ? createMemoryRouter(routes, { initialEntries: ["/login"] }) : createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
