import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from '@tanstack/react-query';

import { apiBaseUrl } from '@/lib/api-base-url';

export function useDeleteAccount() {
  const { getToken } = useAuth();

  const { mutateAsync: deleteAccount, isPending: isDeleting } = useMutation({
    mutationFn: async (): Promise<void> => {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl()}/api/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!response.ok) throw new Error(`Failed to delete account (${response.status})`);
    },
  });

  return { deleteAccount, isDeleting };
}
