import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Mail, Lock, User, Cloud, ArrowRight, FolderOpen, FileText, CalendarDays, Sun, Moon } from 'lucide-react';
import { getPasswordConfirmationError } from '../services/validation';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleChange = (e) => {
    if (e.target.name === 'password' || e.target.name === 'confirmPassword') setFormError('');
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = getPasswordConfirmationError(formData.password, formData.confirmPassword);
    setFormError(validationError || '');
    if (validationError) {
      return;
    }

    setLoading(true);
    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);
    setLoading(false);
    
    if (!result.success) {
      console.error('Registration failed:', result.error);
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
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className="absolute right-6 top-6 rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-archive-teal text-white">
            <Cloud className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Create your account
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
            {/* Full Name */}
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Nguyen Quoc Anh"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Password */}
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
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirm password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

          </div>

          {formError && <p role="alert" className="text-sm font-medium text-rose-600">{formError}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-2xl bg-archive-teal px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
            {!loading && <ArrowRight size={16} className="ml-2" />}
          </button>
        </form>

      </div>
      </main>
    </div>
  );
};

export default Register;
