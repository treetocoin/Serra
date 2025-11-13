import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useDeleteProject } from '../lib/hooks/useProjects';
import { useProjectDevices } from '../lib/hooks/useProjectDevices';
import { projectsService } from '../services/projects.service';
import { DeviceCard } from '../components/devices/DeviceCard';
import { RegisterDeviceModal } from '../components/devices/RegisterDeviceModal';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(projectId!);
  const { data: devices, isLoading: devicesLoading } = useProjectDevices(projectId!);
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const handleDeleteProject = async () => {
    if (!project) return;

    const isLastProject = await projectsService.hasOnlyOneProject();

    const message = isLastProject
      ? 'This is your last project. Deleting it will remove all devices. Continue?'
      : `Are you sure you want to delete ${project.name} and all its devices? This action cannot be undone.`;

    if (window.confirm(message)) {
      deleteProject(project.project_id, {
        onSuccess: () => {
          console.log('Project deleted successfully');
          navigate('/projects');
        },
        onError: (error: Error) => {
          alert(`Failed to delete project: ${error.message}`);
        },
      });
    }
  };

  if (projectLoading || devicesLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!project) {
    return <div className="container mx-auto px-4 py-8">Project not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{project.project_id} - {project.name}</h1>
        {project.description && (
          <p className="text-gray-600 mt-2">{project.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Devices</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Device
          </button>
          <button
            onClick={handleDeleteProject}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {isDeleting ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </div>

      {devices && devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">No devices registered yet</p>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="text-blue-600 hover:underline"
          >
            Register your first device
          </button>
        </div>
      )}

      <RegisterDeviceModal
        projectId={projectId!}
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
    </div>
  );
}
