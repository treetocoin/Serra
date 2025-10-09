import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { LogIn } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="bg-green-600 p-3 rounded-full">
              <LogIn className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accedi al tuo account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Oppure{' '}
            <Link to="/register" className="font-medium text-green-600 hover:text-green-500">
              crea un nuovo account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
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
                  'appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300',
                  'placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-green-500',
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  'appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300',
                  'placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-green-500',
                  'focus:border-green-500 focus:z-10 sm:text-sm'
                )}
                placeholder="Password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/reset-password"
                className="font-medium text-green-600 hover:text-green-500"
              >
                Password dimenticata?
              </Link>
            </div>
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
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
