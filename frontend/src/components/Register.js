import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getInviteCodeValidationError, getRegistrationValidationError } from '../services/validation';
import AuthPageLayout from './AuthPageLayout';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    inviteCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const { register } = useAuth();
  const inviteCodeRequired = process.env.REACT_APP_REGISTRATION_INVITE_REQUIRED === 'true';

  const handleChange = (event) => {
    setFormError('');
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = getRegistrationValidationError(formData.password, formData.confirmPassword)
      || getInviteCodeValidationError(formData.inviteCode, inviteCodeRequired);
    setFormError(validationError || '');
    if (validationError) return;

    setLoading(true);
    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);
    setLoading(false);

    if (!result.success) {
      setFormError(result.error || 'Unable to create your account. Please try again.');
    }
  };

  return (
    <AuthPageLayout>
      <section className="auth-card" aria-labelledby="register-title">
        <header className="auth-card-header">
          <img className="auth-card-logo" src="/cloudnest-logo.svg" alt="" aria-hidden="true" />
          <h1 className="auth-title" id="register-title">Create your account</h1>
          <p className="auth-switch">
            Already have an account?{' '}
            <Link className="auth-link" to="/login">Sign in</Link>
          </p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field-list">
            <div>
              <label className="auth-field-label" htmlFor="name">Full name</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true"><User size={18} /></span>
                <input
                  className="auth-input"
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  maxLength={72}
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? 'registration-error' : undefined}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="auth-field-label" htmlFor="confirmPassword">Confirm password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true"><Lock size={18} /></span>
                <input
                  className="auth-input"
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? 'registration-error' : undefined}
                  placeholder="Enter your password again"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {inviteCodeRequired && (
              <div>
                <label className="auth-field-label" htmlFor="inviteCode">Invitation code</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true"><Lock size={18} /></span>
                  <input
                    className="auth-input"
                    id="inviteCode"
                    name="inviteCode"
                    type="password"
                    autoComplete="one-time-code"
                    aria-invalid={Boolean(formError)}
                    aria-describedby={formError ? 'registration-error' : 'invite-code-help'}
                    placeholder="Enter the code you received"
                    value={formData.inviteCode}
                    onChange={handleChange}
                    required
                  />
                </div>
                <p className="auth-invite-help" id="invite-code-help">Use the private invitation code shared with you.</p>
              </div>
            )}

            {formError && <p className="auth-error" id="registration-error" role="alert">{formError}</p>}
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
            {!loading && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </form>
      </section>
    </AuthPageLayout>
  );
};

export default Register;
