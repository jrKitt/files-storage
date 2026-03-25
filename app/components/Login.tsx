"use client";

import { useState, useEffect } from "react";

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [userLoginMode, setUserLoginMode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(true);

  useEffect(() => {
    checkIfPasswordExists();
  }, []);

  const checkIfPasswordExists = async () => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-password" }),
      });

      const data = await response.json();
      setIsSettingPassword(!data.hasPassword);
      setUserLoginMode(Boolean(data.userLoginMode));
    } catch (err) {
      console.error("Error checking password:", err);
    } finally {
      setCheckingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const action = isSettingPassword ? "set-password" : "login";
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid password");
      }

      if (data.token) {
        localStorage.setItem("auth_token", data.token);
        onLoginSuccess(data.token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  if (checkingPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <h1 className="text-3xl font-semibold text-blue-100 mb-2 text-center">jrKitt WS Version 1.0</h1>
          <p className="text-slate-400">
            {isSettingPassword ? "Create a password to access the system" : "Enter your password to access the system"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {userLoginMode && (
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-300">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Please enter your password"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password === "" || (userLoginMode && username.trim() === "")}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? "Processing..." : isSettingPassword ? "Create Password" : "Login"}
            </button>
          </form>

          
        </div>
      </div>
    </div>
  );
}
