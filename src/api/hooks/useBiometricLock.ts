import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';

import { getBiometricLockEnabled, setBiometricLockEnabled } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';

function biometricLockQueryKey() {
  return ['BIOMETRIC_LOCK'] as const;
}

async function getCapability() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
  return { available: hasHardware && isEnrolled };
}

/** Whether the device can do biometric auth, and whether the user has opted in to the lock. */
export function useBiometricLock() {
  const queryClient = useQueryClient();

  const { data: capability } = useQuery({
    queryKey: ['BIOMETRIC_CAPABILITY'],
    queryFn: getCapability,
    // Hardware doesn't change while the app is open.
    ...deviceQuery,
  });

  const { data: enabled, status } = useQuery({
    queryKey: biometricLockQueryKey(),
    queryFn: getBiometricLockEnabled,
    ...deviceQuery,
  });

  const { mutate: setEnabled } = useMutation({
    mutationFn: setBiometricLockEnabled,
    // The Switch has to move on the frame it is tapped, not when the disk agrees.
    onMutate: (enabled) => {
      const previous = queryClient.getQueryData<boolean>(biometricLockQueryKey());
      queryClient.setQueryData(biometricLockQueryKey(), enabled);
      return { previous };
    },
    onError: (_error, _enabled, context) => {
      queryClient.setQueryData(biometricLockQueryKey(), context?.previous ?? false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: biometricLockQueryKey() }),
  });

  return {
    isAvailable: capability?.available ?? false,
    isEnabled: enabled ?? false,
    isLoading: status === 'pending',
    setEnabled,
  };
}

/** Prompts Face ID / Touch ID / device passcode. Resolves true only on success. */
export async function authenticateWithBiometrics(promptMessage = 'Unlock Pathey'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use passcode',
  });
  return result.success;
}
