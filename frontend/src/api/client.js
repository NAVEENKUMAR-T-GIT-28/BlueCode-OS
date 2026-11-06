import axios from "axios";

const TOKEN_KEY = "bluecodeAuthToken";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ }
};
export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" }
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired / invalid token on a protected call -> sign out
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const isAuthCall = url.startsWith("/auth/login") || url.startsWith("/auth/register");
    if (err.response?.status === 401 && !isAuthCall) {
      clearToken();
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);

// Turn an axios error into a user-friendly message
export const getErrorMessage = (err, fallback = "Something went wrong. Please try again.") => {
  if (err.response?.data?.error) {
    const d = err.response.data.details;
    const first = d && typeof d === "object" ? Object.values(d).flat?.()[0] : null;
    return typeof first === "string" ? `${err.response.data.error}: ${first}` : err.response.data.error;
  }
  if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") {
    return "Cannot reach the server. Check your connection and try again.";
  }
  return fallback;
};

export default api;
