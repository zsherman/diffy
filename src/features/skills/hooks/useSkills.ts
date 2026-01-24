import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSkills,
  listRemoteSkills,
  installSkillFromUrl,
  deleteSkill,
  getSkillContent,
  getSkillRaw,
  updateSkill,
} from '../../../lib/tauri';
import type { SkillMetadata, RemoteSkill } from '../../../types/skills';

export function useSkills() {
  return useQuery<SkillMetadata[], Error>({
    queryKey: ['skills'],
    queryFn: listSkills,
  });
}

export function useRemoteSkills() {
  return useQuery<RemoteSkill[], Error>({
    queryKey: ['remote-skills'],
    queryFn: listRemoteSkills,
    staleTime: 1000 * 60 * 10, // 10 minutes - matches backend cache TTL
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useSkillContent(skillId: string | null) {
  return useQuery<string, Error>({
    queryKey: ['skill-content', skillId],
    queryFn: () => getSkillContent(skillId!),
    enabled: !!skillId,
  });
}

export function useSkillRaw(skillId: string | null) {
  return useQuery<string, Error>({
    queryKey: ['skill-raw', skillId],
    queryFn: () => getSkillRaw(skillId!),
    enabled: !!skillId,
  });
}

export function useInstallSkill() {
  const queryClient = useQueryClient();

  return useMutation<SkillMetadata, Error, string>({
    mutationFn: (url: string) => installSkillFromUrl(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (skillId: string) => deleteSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation<
    SkillMetadata,
    Error,
    { skillId: string; content: string; newId?: string }
  >({
    mutationFn: ({ skillId, content, newId }) => updateSkill(skillId, content, newId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['skill-raw'] });
      queryClient.invalidateQueries({ queryKey: ['skill-content'] });
    },
  });
}
