import React from 'react';
import { ActuatorManager } from '../components/actuators/ActuatorManager';

export const ActuatorsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestione Attuatori</h1>
          <p className="mt-2 text-gray-600">
            Visualizza e personalizza i nomi degli attuatori rilevati automaticamente dai tuoi dispositivi ESP32
          </p>
        </div>

        <ActuatorManager />
      </div>
    </div>
  );
};
