import { Link } from 'react-router-dom';
import type { Device } from '../../types/device.types';
import { devicesService } from '../../services/devices.service';

interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const status = device.status || devicesService.getConnectionStatus(device.last_seen_at);

  const statusConfig = {
    online: { color: 'text-green-600', bgColor: 'bg-green-100' },
    offline: { color: 'text-red-600', bgColor: 'bg-red-100' },
    waiting: { color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    never: { color: 'text-gray-600', bgColor: 'bg-gray-100' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.never;

  return (
    <Link
      to={`/devices/${device.composite_device_id}`}
      className="block p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{device.composite_device_id}</h3>
        <div className={`flex items-center gap-1 px-2 py-1 rounded ${config.bgColor}`}>
          <span className={`text-xs font-medium ${config.color}`}>
            {status}
          </span>
        </div>
      </div>
      <p className="text-gray-700">{device.name}</p>
      {device.last_seen_at && (
        <p className="text-gray-400 text-xs mt-2">
          Last seen: {new Date(device.last_seen_at).toLocaleString()}
        </p>
      )}
    </Link>
  );
}
