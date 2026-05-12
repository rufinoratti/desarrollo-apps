import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="registro/paso1" />
      <Stack.Screen name="registro/paso2" />
      <Stack.Screen name="registro/paso3" />
      <Stack.Screen name="registro/paso4-pago" />
    </Stack>
  );
}
