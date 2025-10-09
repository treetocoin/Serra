import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { UserPlus } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password strength
    if (password.length < 8) {
      setError('La password deve essere lunga almeno 8 caratteri');
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, fullName);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Redirect to dashboard on successful registration
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="bg-green-600 p-3 rounded-full">
              <UserPlus className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Crea il tuo account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Oppure{' '}
            <Link to="/login" className="font-medium text-green-600 hover:text-green-500">
              accedi a un account esistente
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-2">
            <div>
              <label htmlFor="full-name" className="sr-only">
                Nome completo
              </label>
              <input
                id="full-name"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={cn(
                  'appearance-none relative block w-full px-3 py-2 border border-gray-300',
                  'placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500',
                  'focus:border-green-500 focus:z-10 sm:text-sm'
                )}
                placeholder="Nome completo (opzionale)"
              />
            </div>
            <div>
              <label htmlFor="email-address" className="sr-only">
                Indirizzo email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  'appearance-none relative block w-full px-3 py-2 border border-gray-300',
                  'placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500',
                  'focus:border-green-500 focus:z-10 sm:text-sm'
                )}
                placeholder="Indirizzo email"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  'appearance-none relative block w-full px-3 py-2 border border-gray-300',
                  'placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500',
                  'focus:border-green-500 focus:z-10 sm:text-sm'
                )}
                placeholder="Password (min. 8 caratteri)"
              />
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p>Requisiti password:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Almeno 8 caratteri</li>
            </ul>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'group relative w-full flex justify-center py-2 px-4 border border-transparent',
                'text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {loading ? 'Creazione account...' : 'Crea account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
