'use client';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { GROUP_EVENTS } from '@office-foodie/shared';
import type { GroupSnapshot, ApiError } from '@office-foodie/shared';
import { apiRequest } from './api';
export function useGroup(slug: string) {
  const client = useQueryClient();
  const key = ['group', slug];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<GroupSnapshot>(`/groups/${slug}`),
  });
  useEffect(() => {
    const socket = io(
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
      { transports: ['websocket'] },
    );
    const update = (snapshot: GroupSnapshot) => {
      if (snapshot.slug === slug)
        client.setQueryData(['group', slug], snapshot);
    };
    socket.on('connect', () => {
      socket
        .timeout(5000)
        .emit(
          'join',
          { slug },
          (error: Error | null, snapshot: GroupSnapshot | ApiError) => {
            if (!error && snapshot && 'slug' in snapshot) update(snapshot);
          },
        );
    });
    for (const event of Object.values(GROUP_EVENTS)) socket.on(event, update);
    return () => {
      socket.disconnect();
    };
  }, [client, slug]);
  return {
    group: query.data,
    error: query.error?.message ?? '',
    setGroup: (snapshot: GroupSnapshot) => client.setQueryData(key, snapshot),
    refresh: async () => {
      await query.refetch();
    },
  };
}
