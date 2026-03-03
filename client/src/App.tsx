import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import RankingPage from "./pages/RankingPage";
import PerformancePage from "./pages/PerformancePage";
import VslDetailPage from "./pages/VslDetailPage";
import SyncPage from "./pages/SyncPage";
import SettingsPage from "./pages/SettingsPage";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/ranking" component={RankingPage} />
        <Route path="/performance" component={PerformancePage} />
        <Route path="/vsl/:id" component={VslDetailPage} />
        <Route path="/vsl" component={VslDetailPage} />
        <Route path="/sync" component={SyncPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
