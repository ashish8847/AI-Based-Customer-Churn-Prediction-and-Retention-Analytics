import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("churn_theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());
  const [toasts, setToasts] = useState([]);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("churn_theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#12040F" : "#3A0F34");
  }, [theme]);

  const logout = useCallback(() => { setToken(null); setUser(null); setMeta(null); }, []);
  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me").then(setUser).catch(() => setToken(null)).finally(() => setBooting(false));
  }, []);
  useEffect(() => { window.addEventListener("auth:expired", logout); return () => window.removeEventListener("auth:expired", logout); }, [logout]);
  useEffect(() => { if (user && !meta) api("/meta").then(setMeta).catch(() => {}); }, [user, meta]);

  const login = async (username, password) => {
    const r = await api("/auth/login", { method: "POST", body: { username, password } });
    setToken(r.token);
    setUser(r.user);
  };
  const toast = useCallback((message, type = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")), user, login, logout, booting, toast, meta }), [theme, user, booting, toast, meta, logout]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.type === "err" ? "err" : ""}`}>{t.message}</div>)}
      </div>
    </Ctx.Provider>
  );
}
