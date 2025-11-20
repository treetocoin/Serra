import { Layout } from '../components/common/Layout';
import { CycleSettings } from '../components/CycleSettings';

export function SettingsPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestisci le impostazioni del tuo ciclo di coltivazione
          </p>
        </div>

        <CycleSettings />
      </div>
    </Layout>
  );
}
