import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Wifi, Eye, EyeOff } from 'lucide-react';

export function SettingsPage() {
  const navigate = useNavigate();
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load saved WiFi credentials from localStorage
  useEffect(() => {
    const savedSsid = localStorage.getItem('wifi_ssid');
    const savedPassword = localStorage.getItem('wifi_password');
    if (savedSsid) setSsid(savedSsid);
    if (savedPassword) setPassword(savedPassword);
  }, []);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('wifi_ssid', ssid);
    localStorage.setItem('wifi_password', password);

    // Show confirmation
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = () => {
    localStorage.removeItem('wifi_ssid');
    localStorage.removeItem('wifi_password');
    setSsid('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Impostazioni</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* WiFi Configuration Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wifi className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">WiFi Predefinito</h2>
                <p className="text-sm text-gray-600">
                  Configurazione WiFi per provisioning automatico dispositivi
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Come funziona:</strong> Quando registri un nuovo dispositivo,
                queste credenziali WiFi verranno incluse automaticamente nel QR code.
                L'ESP si connetterà direttamente senza bisogno di configurazione manuale.
              </p>
            </div>

            {/* SSID Field */}
            <div>
              <label htmlFor="ssid" className="block text-sm font-medium text-gray-700 mb-2">
                Nome Rete WiFi (SSID)
              </label>
              <input
                id="ssid"
                type="text"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="es. MiaReteWiFi"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Il nome della tua rete WiFi (case-sensitive)
              </p>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password WiFi
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                La password verrà salvata localmente nel browser
              </p>
            </div>

            {/* Warning if credentials are set */}
            {ssid && password && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Sicurezza:</strong> Le credenziali WiFi sono salvate nel browser
                  (localStorage). Non condividere questo dispositivo con persone non autorizzate.
                </p>
              </div>
            )}

            {/* Success Message */}
            {saved && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium">
                  ✓ Impostazioni salvate con successo!
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={!ssid || !password}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Save className="h-5 w-5" />
                Salva Impostazioni
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancella
              </button>
            </div>
          </div>
        </div>

        {/* Current Configuration Display */}
        {ssid && password && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Configurazione Attuale</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">SSID:</span>
                <span className="font-mono text-gray-900">{ssid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Password:</span>
                <span className="font-mono text-gray-900">
                  {'•'.repeat(password.length)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
