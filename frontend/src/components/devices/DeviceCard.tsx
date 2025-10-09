import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, AlertCircle, Trash2, Cpu } from 'lucide-react';
import type { Database } from '../../lib/supabase';
import { devicesService } from '../../services/devices.service';
import { cn } from '../../utils/cn';

type Device = Database['public']['Tables']['devices']['Row'];

interface DeviceCardProps {
  device: Device;
  onDelete: () => void;
}

export function DeviceCard({ device, onDelete }: DeviceCardProps) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const status = devicesService.getConnectionStatus(device.last_seen_at);

  const handleCardClick = () => {
    navigate(`/devices/${device.id}`);
  };

  const statusConfig = {
    online: {
      icon: Wifi,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: 'Online',
    },
    offline: {
      icon: WifiOff,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      label: 'Offline',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: 'Errore',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await devicesService.deleteDevice(device.id);
    if (!error) {
      onDelete();
    } else {
      setDeleting(false);
      alert(`Errore nell'eliminazione del dispositivo: ${error.message}`);
    }
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Mai';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffSeconds = (now.getTime() - date.getTime()) / 1000;

    if (diffSeconds < 60) return 'Proprio ora';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m fa`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h fa`;
    return date.toLocaleDateString('it-IT');
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'bg-white border-2 rounded-lg p-4 transition-all hover:shadow-md cursor-pointer',
        config.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 hover:text-green-600 transition-colors">
            {device.name}
          </h3>

          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
            <div className={cn('flex items-center space-x-1', config.color)}>
              <StatusIcon className="h-4 w-4" />
              <span className="font-medium">{config.label}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Cpu className="h-4 w-4" />
              <span>Ultimo accesso: {formatLastSeen(device.last_seen_at)}</span>
            </div>
          </div>

          {device.firmware_version && (
            <div className="mt-1 text-xs text-gray-500">
              Firmware: {device.firmware_version}
            </div>
          )}

          <div className="mt-1 text-xs text-gray-400">
            Registrato: {new Date(device.registered_at).toLocaleDateString('it-IT')}
          </div>
        </div>

        <div className="ml-4" onClick={(e) => e.stopPropagation()}>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Elimina dispositivo"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  'px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700',
                  deleting && 'opacity-50 cursor-not-allowed'
                )}
              >
                {deleting ? 'Eliminazione...' : 'Conferma'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Annulla
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
