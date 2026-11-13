import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthPageLayout from './AuthPageLayout';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const { login } = useAuth();

  const handleChange = (event) => {
    setFormError('');
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setLoading(true);

    const result = await login(formData);
    setLoading(false);

    if (!result.success) {
      setFormError(result.error || 'Unable to sign in. Check your email and password.');
    }
  };

  return (
    <AuthPageLayout>
      <section className="auth-card" aria-labelledby="login-title">
        <header className="auth-card-header">
          <img className="auth-card-logo" src="/cloudnest-logo.svg" alt="" aria-hidden="true" />
          <h1 className="auth-title" id="login-title">Welcome back</h1>
          <p className="auth-switch">
            Sign in to CloudNest or{' '}
            <Link className="auth-link" to="/register">create an account</Link>
          </p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field-list">
            <div>
              <label className="auth-field-label" htmlFor="email">Email address</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true"><Mail size={18} /></span>
                <input
                  className="auth-input"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="auth-field-label" htmlFor="password">Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true"><Lock size={18} /></span>
                <input
                  className="auth-input"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {formError && <p className="auth-error" id="login-error" role="alert">{formError}</p>}
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in to workspace'}
            {!loading && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </form>
      </section>
    </AuthPageLayout>
  );
};

export default Login;
