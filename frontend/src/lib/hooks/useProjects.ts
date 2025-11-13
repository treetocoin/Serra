import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '../../services/projects.service';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getProjects(),
    staleTime: 30000, // 30 seconds
  });
};

export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsService.getProject(projectId),
    staleTime: 30000,
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { name: string; description?: string }) =>
      projectsService.createProject(params.name, params.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      updates: { name?: string; description?: string; status?: 'active' | 'archived' };
    }) => projectsService.updateProject(params.projectId, params.updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectsService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
