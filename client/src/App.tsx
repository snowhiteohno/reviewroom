import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Flower2 } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth";
import Studio from "./Studio";
import AuthPage from "./AuthPage";
function ProtectedStudio() {
  const { user } = useAuth(),
    location = useLocation();
  return user ? (
    <Studio user={user} />
  ) : (
    <Navigate
      to="/login"
      state={{ from: location.pathname + location.search }}
      replace
    />
  );
}
function AppRoutes() {
  const { loading, error, reload } = useAuth();
  if (loading)
    return (
      <main className="loading auth-loading">
        <Flower2 size={35} strokeWidth={1.2} />
        <p>Opening your studio</p>
      </main>
    );
  if (error)
    return (
      <main className="empty">
        <h1>Your studio needs a moment</h1>
        <p>{error}</p>
        <button className="button primary" onClick={reload}>
          Try again
        </button>
      </main>
    );
  return (
    <Routes>
      <Route path="/" element={<ProtectedStudio />} />
      <Route path="/login" element={<AuthPage key="login" />} />
      <Route path="/register" element={<AuthPage key="register" register />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
