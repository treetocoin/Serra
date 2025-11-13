import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/hooks/useAuth';
import { DeviceList } from '../components/devices/DeviceList';
import { AddDeviceModal } from '../components/devices/AddDeviceModal';
import { Home, LogOut, Plus } from 'lucide-react';

export function DevicesPage() {
  const { user, signOut } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDeviceRegistered = () => {
    // Force DeviceList to refetch by changing key
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <Link
                to="/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-colors"
              >
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-2xl font-bold text-gray-900">Dispositivi</h1>
              <button
                onClick={() => setShowAddModal(true)}
                className="ml-auto flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Aggiungi Dispositivo</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Esci</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DeviceList key={refreshKey} />
      </main>

      {/* Add Device Modal */}
      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleDeviceRegistered}
        />
      )}
    </div>
  );
}
