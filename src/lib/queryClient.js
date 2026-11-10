import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      // Mobile connections drop often; refetch when they come back.
      refetchOnReconnect: true,
    },
  },
});
