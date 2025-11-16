/**
 * Empty State Onboarding Component
 *
 * Displays friendly onboarding wizard when no sensors are configured,
 * guiding users to device management functionality.
 *
 * @feature 005-lavoriamo-alla-pagina T009
 * @see ../../../specs/005-lavoriamo-alla-pagina/research.md Section 6
 */

import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

export function EmptyStateOnboarding() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header without navigation clutter */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Dati</h1>
        </div>
      </header>

      {/* Centered onboarding content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="max-w-md text-center space-y-6">
            {/* Friendly plant emoji */}
            <div className="text-6xl">🌱</div>

            {/* Welcoming headline */}
            <h2 className="text-2xl font-bold text-gray-900">
              Benvenuto su Dati
            </h2>

            {/* Clear explanation */}
            <p className="text-gray-600">
              Per iniziare a visualizzare i dati dei tuoi sensori, devi prima
              configurare almeno un dispositivo con sensori attivi.
            </p>

            {/* Primary CTA */}
            <div className="space-y-3">
              <Link
                to="/devices"
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors shadow-sm"
              >
                <Settings className="h-5 w-5 mr-2" />
                Configura Dispositivi
              </Link>

              {/* Optional secondary help link */}
              <p className="text-sm text-gray-500">
                Hai bisogno di aiuto?{' '}
                <a
                  href="https://docs.serra.app/quick-start"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  Consulta la guida rapida
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
