import { supabase } from '../lib/supabase';
import type { Project } from '../types/project.types';

export const projectsService = {
  async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getProject(projectId: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) throw error;
    return data;
  },

  async createProject(
    name: string,
    description?: string
  ): Promise<{ project_id: string; id: string; created_at: string }> {
    const { data, error } = await supabase.rpc('create_project', {
      p_name: name,
      p_description: description || null
    });

    if (error) {
      if (error.message.includes('already exists')) {
        throw new Error(`Project name "${name}" is already taken. Please choose a different name.`);
      }
      throw error;
    }

    return data[0];
  },

  async updateProject(
    projectId: string,
    updates: { name?: string; description?: string; status?: 'active' | 'archived' }
  ): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) {
      if (error.message.includes('already exists')) {
        throw new Error(`Project name "${updates.name}" is already taken.`);
      }
      throw error;
    }

    return data;
  },

  async deleteProject(projectId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('delete_project', {
      p_project_id: projectId
    });

    if (error) throw error;
    return data;
  },

  async hasOnlyOneProject(): Promise<boolean> {
    const projects = await this.getProjects();
    return projects.length === 1;
  }
};
