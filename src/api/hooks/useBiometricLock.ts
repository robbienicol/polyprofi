import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';

import { getBiometricLockEnabled, setBiometricLockEnabled } from '@/api/client/storage';

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
  });

  const { data: enabled, status } = useQuery({
    queryKey: biometricLockQueryKey(),
    queryFn: getBiometricLockEnabled,
  });

  const { mutate: setEnabled } = useMutation({
    mutationFn: setBiometricLockEnabled,
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
