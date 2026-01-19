import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { UserMenu } from "@/components/user-menu";
import { Footer } from "@/components/footer";
const logoImage = "/attached_assets/audivia_horizonta_1766267902382.png";
import Home from "@/pages/home";
import AudiobookDetail from "@/pages/audiobook-detail";
import ChapterPlayer from "@/pages/chapter-player";
import Explore from "@/pages/explore";
import Library from "@/pages/library";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import EmergencyReset from "@/pages/emergency-reset";
import Setup from "@/pages/setup";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminUsers from "@/pages/admin-users";
import AdminAudiobooks from "@/pages/admin-audiobooks";
import AdminChapters from "@/pages/admin-chapters";
import AdminEmailConfig from "@/pages/admin-email-config";
import AdminPayPalConfig from "@/pages/admin-paypal-config";
import AdminGitHub from "@/pages/admin-github";
import AdminSalesDashboard from "@/pages/admin-sales-dashboard";
import AdminSubscriptions from "@/pages/admin-subscriptions";
import AdminImport from "@/pages/admin-import";
import AdminCustomers from "@/pages/admin-customers";
import AdminDiscountCodes from "@/pages/admin-discount-codes";
import AdminExternalServices from "@/pages/admin-external-services";
import Profile from "@/pages/profile";
import UserGuide from "@/pages/user-guide";
import MyPlaylists from "@/pages/my-playlists";
import PlaylistDetail from "@/pages/playlist-detail";
import Subscriptions from "@/pages/subscriptions";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Mobile from "@/pages/mobile";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/login" || location === "/register" || location === "/forgot-password" || location.startsWith("/reset-password") || location.startsWith("/verify-email") || location === "/emergency-reset";
  const isMobilePage = location === "/mobile";
  const isSetupPage = location === "/setup";

  if (isMobilePage) {
    return <Mobile />;
  }

  if (isSetupPage) {
    return <Setup />;
  }

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-background">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className="flex-1">
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/verify-email" component={VerifyEmail} />
            <Route path="/emergency-reset" component={EmergencyReset} />
          </Switch>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-primary/20 z-50 shrink-0" style={{ backgroundColor: "#7C3AED" }}>
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-white hover:text-white/80" data-testid="button-sidebar-toggle" />
          <Link href="/">
            <img 
              src={logoImage} 
              alt="Audivia Logo" 
              className="h-10 w-auto cursor-pointer brightness-0 invert"
              data-testid="img-header-logo"
            />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="text-white hover:text-white/80 [&_svg]:text-white" />
          <UserMenu className="text-white" />
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden relative">
        <AppSidebar />
        <main className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/audiobook/:id" component={AudiobookDetail} />
              <Route path="/chapter/:id" component={ChapterPlayer} />
              <Route path="/explore" component={Explore} />
              <Route path="/library" component={Library} />
              <Route path="/subscriptions" component={Subscriptions} />
              <Route path="/cart">
                <ProtectedRoute>
                  <Cart />
                </ProtectedRoute>
              </Route>
              <Route path="/checkout">
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              </Route>
              <Route path="/my-playlists">
                <ProtectedRoute>
                  <MyPlaylists />
                </ProtectedRoute>
              </Route>
              <Route path="/playlists/:id" component={PlaylistDetail} />
              <Route path="/settings" component={Settings} />
              <Route path="/user-guide" component={UserGuide} />
              <Route path="/profile">
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              </Route>
              <Route path="/admin">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminDashboard />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/sales">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminSalesDashboard />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/users">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminUsers />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/audiobooks">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminAudiobooks />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/chapters">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminChapters />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/email-config">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminEmailConfig />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/paypal-config">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminPayPalConfig />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/github">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminGitHub />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/subscriptions">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminSubscriptions />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/import">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminImport />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/customers">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminCustomers />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/discount-codes">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminDiscountCodes />
                </ProtectedRoute>
              </Route>
              <Route path="/admin/external-services">
                <ProtectedRoute requireRole="ADMIN">
                  <AdminExternalServices />
                </ProtectedRoute>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}

function App() {
  const [location] = useLocation();
  const isMobilePage = location === "/mobile";
  const isSetupPage = location === "/setup";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  // Mobile and Setup pages render without sidebar
  const needsSidebar = !isMobilePage && !isSetupPage;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AuthProvider>
            {needsSidebar ? (
              <SidebarProvider style={style as React.CSSProperties}>
                <Router />
              </SidebarProvider>
            ) : (
              <Router />
            )}
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
