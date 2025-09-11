// src/components/AdminRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // <- fix path if needed

export default function AdminRoute({ children }) {
  const { user, token, loading, isAuthenticated, hydrated } = useAuth();
  const location = useLocation();

  // wait for hydration so we don't redirect prematurely
  if (typeof hydrated === "boolean" ? !hydrated : loading) return null; // or a spinner

  // not logged in -> go to login and return here afterwards
  if (!(user || isAuthenticated)) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(
          location.pathname + location.search
        )}`}
        replace
      />
    );
  }

  // accept common admin shapes
  const isAdmin =
    user?.role?.toString?.().toLowerCase() === "admin" ||
    user?.isAdmin === true ||
    (Array.isArray(user?.roles) &&
      user.roles.some((r) => {
        const v =
          typeof r === "string"
            ? r
            : r?.name ?? r?.role ?? r?.id ?? r?.title ?? "";
        return v?.toString?.().toLowerCase() === "admin";
      }));

  if (!isAdmin) return <Navigate to="/" replace />; // or a 403 page

  return children;
}
