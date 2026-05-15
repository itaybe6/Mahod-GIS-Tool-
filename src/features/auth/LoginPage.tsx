import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import loginVideoUrl from '@/assets/606c9503-40e0-463d-9af6-51d30b65f69f.mp4';
import logoUrl from '../../../Logo.png?url';
import './login-page.css';

type AuthMode = 'login' | 'signup';

const COPY: Record<
  AuthMode,
  {
    title: string;
    subtitlePrefix: string;
    subtitleLinkLabel: string;
    submitLabel: string;
  }
> = {
  login: {
    title: 'ברוך הבא חזרה',
    subtitlePrefix: 'עדיין אין לך חשבון?',
    subtitleLinkLabel: 'צור חשבון חדש',
    submitLabel: 'התחבר למערכת',
  },
  signup: {
    title: 'צור חשבון חדש',
    subtitlePrefix: 'כבר רשום?',
    subtitleLinkLabel: 'התחבר עכשיו',
    submitLabel: 'הירשם והתחבר',
  },
};

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  const uiCopy = useMemo(() => COPY[mode], [mode]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPending(true);
    window.setTimeout(() => {
      setPending(false);
      navigate(ROUTES.DASHBOARD);
    }, 800);
  }

  return (
    <div className="auth-shell" data-mode={mode} dir="rtl">
      <section className="auth-video-side" aria-label="וידאו רקע">
        <video className="auth-bg-video" autoPlay muted loop playsInline preload="auto">
          <source src={loginVideoUrl} type="video/mp4" />
        </video>
      </section>

      <section className="auth-form-side">
        <div className="auth-top-strip">
          <div className="auth-brand">
            <img src={logoUrl} alt="מהוד הנדסה" className="auth-logo" />
            <div className="auth-brand-text">
              <span className="auth-brand-name">מהוד הנדסה</span>
              <span className="auth-brand-tag">מקבוצת מילגם</span>
            </div>
          </div>
          <span className="auth-secure">חיבור מאובטח</span>
        </div>

        <div className="auth-card">
          <header>
            <h1 className="auth-title">{uiCopy.title}</h1>
            <p className="auth-subtitle">
              {uiCopy.subtitlePrefix}{' '}
              <button
                type="button"
                className="auth-link-button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              >
                {uiCopy.subtitleLinkLabel}
              </button>
            </p>
          </header>

          <div className="auth-tabs" role="tablist" aria-label="מצב התחברות">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              התחברות
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => setMode('signup')}
            >
              הרשמה
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' ? (
              <label className="auth-field">
                <span>שם מלא</span>
                <input type="text" name="fullName" autoComplete="name" required />
              </label>
            ) : null}

            <label className="auth-field">
              <span>אימייל או טלפון</span>
              <input type="text" name="emailOrPhone" autoComplete="email" required />
            </label>

            <label className="auth-field">
              <span>סיסמה</span>
              <div className="auth-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="auth-pass-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPassword ? 'הסתר' : 'הצג'}
                </button>
              </div>
            </label>

            {mode === 'signup' ? (
              <label className="auth-field">
                <span>אימות סיסמה</span>
                <input type="password" name="passwordConfirm" autoComplete="new-password" required />
              </label>
            ) : (
              <div className="auth-form-row">
                <label className="auth-checkbox">
                  <input type="checkbox" name="remember" defaultChecked />
                  <span>זכור אותי</span>
                </label>
                <button type="button" className="auth-link-button">
                  שכחתי סיסמה
                </button>
              </div>
            )}

            <button className="auth-primary-btn" type="submit" disabled={pending}>
              {pending ? 'מתחבר...' : uiCopy.submitLabel}
            </button>
          </form>

          <div className="auth-divider">או</div>

          <button type="button" className="auth-secondary-btn" onClick={() => navigate(ROUTES.DASHBOARD)}>
            כניסה כאורח - צפייה בלבד
          </button>

          <p className="auth-legal">
            בהמשך אתה מסכים ל-<a href="#">תנאי השימוש</a> ול-<a href="#">מדיניות הפרטיות</a>.
          </p>
        </div>

        <footer className="auth-footer">
          <span>© 2026 מהוד הנדסה</span>
          <Link to={ROUTES.DASHBOARD}>מעבר למערכת</Link>
        </footer>
      </section>
    </div>
  );
}
