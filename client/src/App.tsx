import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { ArrowLeft, Home as HomeIcon } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import JobDetail from "./pages/JobDetail";
import SubmitOpportunity from "./pages/SubmitOpportunity";
import ContactUs from "./pages/ContactUs";
import Announcements from "./pages/Announcements";
import CompanyProfile from "./pages/CompanyProfile";
import CvServices from "./pages/CvServices";
import MoreJobs from "./pages/MoreJobs";
import RemoteJobs from "./pages/RemoteJobs";
import AboutUs from "./pages/AboutUs";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/jobs/:id" component={JobDetail} />
    <Route path="/submit" component={SubmitOpportunity} />
    <Route path="/contact" component={ContactUs} />
    <Route path="/announcements" component={Announcements} />
    <Route path="/companies/:id" component={CompanyProfile} />
    <Route path="/cv-services" component={CvServices} />
    <Route path="/more-jobs" component={MoreJobs} />
    <Route path="/remote-jobs" component={RemoteJobs} />
    <Route path="/about-us" component={AboutUs} />
    <Route path="/admin/login" component={AdminLogin} />
    <Route path="/admin" component={AdminDashboard} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function FloatingHomeButton() {
  const [location] = useLocation();
  if (location === "/") return null;

  return <a className="floating-home-button" href="/" aria-label="Return to the homepage" title="Back to home">
    <span className="floating-home-icon"><HomeIcon size={17} strokeWidth={2.2} aria-hidden="true" /></span>
    <span className="floating-home-label">Home</span>
    <ArrowLeft className="floating-home-arrow" size={13} aria-hidden="true" />
  </a>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /><FloatingHomeButton /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
