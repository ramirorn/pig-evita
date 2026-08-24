// ===========================================
// Login Page
// ===========================================
import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { destinoPostLogin } from '@/lib/adminRoutes';
import { loginSchema } from '@/schemas';
import type { AxiosError } from 'axios';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If checking authentication state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-400 border-t-accent-500 rounded-full animate-spin" />
          <p className="text-sm text-celeste-100 font-medium">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  const intentada = (location.state as { from?: { pathname: string } })?.from?.pathname;

  // Con sesión abierta, cada rol va a la primera pantalla que puede ver: mandar
  // a todos al dashboard dejaba a un ARBITRO —que no lo puede ver— en un
  // "Acceso Denegado" apenas se logueaba (R08).
  if (user) {
    return <Navigate to={destinoPostLogin(user.role, intentada)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // La validación la hace `loginSchema`, el mismo esquema que endureció T15
    // para que coincida con el `LoginDto` del backend (`@MinLength(8)`). Acá se
    // chequeaba a mano que los campos no estuvieran vacíos y nada más: una
    // contraseña de 6 caracteres pasaba el formulario y volvía como un 400
    // genérico ("Error al conectar con el servidor"), que no le dice al usuario
    // qué corregir (R31).
    const validacion = loginSchema.safeParse({ email, password });
    if (!validacion.success) {
      // El primer problema alcanza: el formulario muestra un solo mensaje.
      setError(validacion.error.issues[0]?.message ?? 'Revisá tu email y tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Se manda lo que salió del schema, no el estado crudo: el email va
      // trimmeado y de paso queda una sola fuente de verdad sobre el payload.
      const usuario = await login(validacion.data);
      // Se respeta la ruta que quería abrir, salvo que su rol no la pueda ver.
      navigate(destinoPostLogin(usuario.role, intentada), { replace: true });
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      if (axiosError.response?.status === 401) {
        setError('Email o contraseña incorrectos.');
      } else if (axiosError.response?.status === 403) {
        setError('Tu cuenta está desactivada. Contactá al administrador.');
      } else if (axiosError.response?.status === 429) {
        setError('Demasiados intentos. Esperá unos minutos e intentá de nuevo.');
      } else {
        setError('Error al conectar con el servidor. Intentá más tarde.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-800 via-primary-900 to-primary-950 px-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-celeste-400/15 rounded-full blur-2xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 animate-scale-in border border-primary-100/50">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <img
                src="/logo-sinfondo.png"
                alt="Juegos Evita Formoseños"
                className="h-20 w-auto object-contain drop-shadow-md"
              />
            </div>
            <h1 className="text-2xl font-extrabold text-primary-800 tracking-tight">
              Juegos Evita Formoseños
            </h1>
            <p className="text-xs text-accent-600 font-bold uppercase tracking-widest mt-0.5">
              Portal Administrativo Oficial
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-3 rounded-lg bg-destructive-50 border border-red-200 animate-fade-in" role="alert">
              <AlertCircle className="w-5 h-5 text-destructive-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive-600">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-semibold text-primary-700 mb-1.5"
              >
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@deportes.formosa.gob.ar"
                className="w-full px-4 py-2.5 rounded-lg border border-primary-200 bg-surface text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-semibold text-primary-700 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-12 rounded-lg border border-primary-200 bg-surface text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-primary-400 mt-6">
            Secretaría de Deportes — Provincia de Formosa
          </p>
        </div>
      </div>
    </div>
  );
}
