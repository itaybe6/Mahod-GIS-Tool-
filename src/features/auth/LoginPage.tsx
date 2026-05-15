import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import loginVideoUrl from '@/assets/606c9503-40e0-463d-9af6-51d30b65f69f.mp4';
import logoUrl from '../../../Logo.png?url';
import './login-page.css';

type AuthMode = 'login' | 'signup';

const COPY: Record<
  AuthMode,
  {
    title: string;
    submitLabel: string;
  }
> = {
  login: {
    title: 'ברוך הבא חזרה',
    submitLabel: 'התחבר למערכת',
  },
  signup: {
    title: 'צור חשבון חדש',
    submitLabel: 'הירשם והתחבר',
  },
};

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const showToast = useUIStore((s) => s.showToast);
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  const uiCopy = useMemo(() => COPY[mode], [mode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      showToast('Supabase לא מוגדר. בדוק VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const passwordConfirm = String(formData.get('passwordConfirm') ?? '');

    if (mode === 'signup' && password !== passwordConfirm) {
      showToast('אימות הסיסמה לא תואם לסיסמה');
      return;
    }

    setPending(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              name,
            },
          },
        });

        if (error) {
          showToast(`שגיאת הרשמה: ${error.message}`);
          return;
        }

        if (data.session) {
          setAuthenticated(true);
          showToast('נרשמת בהצלחה');
          navigate(ROUTES.DASHBOARD);
          return;
        }

        showToast('נרשמת בהצלחה. אם מופעל אימות מייל, בדוק את תיבת המייל שלך');
        setMode('login');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showToast(`שגיאת התחברות: ${error.message}`);
        return;
      }

      setAuthenticated(true);
      showToast('התחברת בהצלחה');
      navigate(ROUTES.DASHBOARD);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-shell" data-mode={mode} dir="rtl">
      <section className="auth-video-side" aria-label="וידאו רקע">
        <video className="auth-bg-video" autoPlay muted loop playsInline preload="auto">
          <source src={loginVideoUrl} type="video/mp4" />
        </video>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <div className="auth-hero-logo-wrap">
            <img src={logoUrl} alt="מהוד הנדסה" className="auth-hero-logo" />
          </div>

          <header>
            <h1 className="auth-title">{uiCopy.title}</h1>
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
                <span>שם</span>
                <input type="text" name="name" autoComplete="name" required />
              </label>
            ) : null}

            <label className="auth-field">
              <span>אימייל</span>
              <input type="email" name="email" autoComplete="email" required />
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
            ) : null}

            <div className="auth-form-row">
              <label className="auth-checkbox">
                <input type="checkbox" name="remember" defaultChecked />
                <span>זכור אותי</span>
              </label>
              <button type="button" className="auth-link-button">
                שכחתי סיסמה
              </button>
            </div>

            <button className="auth-primary-btn" type="submit" disabled={pending}>
              {pending ? 'מתחבר...' : uiCopy.submitLabel}
            </button>
          </form>

          <div className="auth-divider">או</div>

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
