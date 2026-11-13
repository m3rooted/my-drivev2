import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Mail, Lock, Cloud, ArrowRight, Sun, Moon, FolderOpen, FileText, CalendarDays } from 'lucide-react';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme(); // <-- LẤY HOOK THEME

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(formData);
    setLoading(false);
    
    if (!result.success) {
      console.error('Login failed:', result.error);
    }
  };

  return (
    <div className="min-h-screen bg-archive-fog dark:bg-slate-950 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(30rem,0.9fr)]">
      <section className="hidden min-h-screen flex-col justify-between bg-archive-ink p-12 text-white lg:flex">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-archive-teal"><Cloud size={22} /></span><span className="text-xl font-bold">Drive</span></div>
        <div className="max-w-lg">
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">A calmer place for your files.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">Keep documents, folders and plans together, then find the right thing when you need it.</p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {[{ label: 'Folders', Icon: FolderOpen }, { label: 'Documents', Icon: FileText }, { label: 'Plans', Icon: CalendarDays }].map(({ label, Icon }) => (
              <div key={label} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <Icon size={18} className="text-teal-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-medium text-slate-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">Your work, in its place.</p>
      </section>

      <main className="relative flex min-h-screen items-center justify-center px-4 py-14 sm:px-8">
      
      {/* Nút đổi Sáng/Tối ngay góc trên bên phải màn hình Đăng Nhập */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className="absolute top-6 right-6 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all"
      >
        {theme === 'dark' ? (
          <Sun size={20} className="text-amber-400 transform rotate-90 scale-110" />
        ) : (
          <Moon size={20} className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] transform -rotate-12 scale-110" />
        )}
      </button>

      <div className="w-full max-w-md space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        
        {/* Header Logo */}
        <div className="text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30 text-white">
            <Cloud className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back to Drive
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create account
            </Link>
          </p>
        </div>

        {/* Form */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-archive-teal px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in to workspace'}
            {!loading && <ArrowRight size={16} className="ml-2" />}
          </button>
        </form>

      </div>
      </main>
    </div>
  );
};

export default Login;
