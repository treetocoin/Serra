import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { KeyRound } from 'lucide-react';
import { cn } from '../../utils/cn';

export function PasswordReset() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const { error } = await resetPassword(email);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="bg-green-600 p-3 rounded-full">
              <KeyRound className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reimposta la password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Inserisci il tuo indirizzo email e ti invieremo un link per reimpostare la password
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative">
              <p className="font-medium">Controlla la tua email!</p>
              <p className="text-sm mt-1">
                Abbiamo inviato un link per reimpostare la password a {email}. Clicca sul link nell'email per reimpostare la password.
              </p>
            </div>
          )}

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
              {loading ? 'Invio in corso...' : 'Invia link di reset'}
            </button>
          </div>

          <div className="text-center">
            <Link to="/login" className="text-sm font-medium text-green-600 hover:text-green-500">
              Torna al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
