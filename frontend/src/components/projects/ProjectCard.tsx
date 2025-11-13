import { Link } from 'react-router-dom';
import type { Project } from '../../types/project.types';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.project_id}`}
      className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg transition"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold text-gray-900">{project.project_id}</h3>
        <span className={`px-2 py-1 text-xs font-medium rounded ${
          project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {project.status}
        </span>
      </div>
      <p className="text-gray-700 font-medium mb-2">{project.name}</p>
      {project.description && (
        <p className="text-gray-500 text-sm">{project.description}</p>
      )}
      <p className="text-gray-400 text-xs mt-4">
        Created {new Date(project.created_at).toLocaleDateString()}
      </p>
    </Link>
  );
}
