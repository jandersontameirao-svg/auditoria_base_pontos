import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";

const Home = lazy(() => import("./pages/Home"));

function PageLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
        Carregando auditoria...
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function Gate() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return <Router />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Gate />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
