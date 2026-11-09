import { useSignUp } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';

export default function SignUpScreen() {
  const { signUp } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignUpPress = async () => {
    if (!signUp || loading) return;
    setLoading(true);
    try {
      const { error } = await signUp.password({
        emailAddress: email,
        password,
      });

      if (error) {
        Alert.alert("Sign Up Failed", error.message || "Could not create account.");
        return;
      }

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        Alert.alert("Error", sendError.message || "Could not send verification code.");
        return;
      }

      setPendingVerification(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyPress = async () => {
    if (!signUp || loading) return;
    setLoading(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({
        code,
      });

      if (error) {
        Alert.alert("Verification Failed", error.message || "Invalid code.");
        return;
      }

      if (signUp.status === 'complete') {
        await signUp.finalize({
          navigate: ({ decorateUrl }) => router.replace(decorateUrl('/') as Href),
        });
      } else {
        Alert.alert(
          "Missing Requirements", 
          "Please ensure First/Last name requirements are set to Optional in your Clerk Dashboard settings."
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>𝕃𝕒𝕦𝕟𝕕𝕣𝕪 𝔸𝕟𝕒𝕝𝕪𝕫𝕖𝕣</Text>
        <Text style={styles.subtitle}>
          {pendingVerification ? "Enter email verification code" : "Create a new account"}
        </Text>

        {!pendingVerification ? (
          <>
            <TextInput
              autoCapitalize="none"
              value={email}
              placeholder="Email address"
              placeholderTextColor="#6b7280"
              onChangeText={setEmail}
              style={styles.input}
            />

            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                placeholder="Password"
                placeholderTextColor="#6b7280"
                secureTextEntry={!showPassword}
                onChangeText={setPassword}
                style={styles.passwordInput}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)} 
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.button} onPress={onSignUpPress} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              value={code}
              placeholder="Verification Code"
              placeholderTextColor="#6b7280"
              keyboardType="number-pad"
              onChangeText={setCode}
              style={styles.input}
            />

            <TouchableOpacity style={styles.button} onPress={onVerifyPress} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Email</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#090d16' },
  card: { backgroundColor: '#111827', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937' },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', color: '#fff', padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 15 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 12, marginBottom: 16 },
  passwordInput: { flex: 1, color: '#fff', padding: 14, fontSize: 15 },
  eyeButton: { paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  eyeText: { color: '#3b82f6', fontWeight: '600', fontSize: 13 },
  button: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#9ca3af', fontSize: 13 },
  linkBold: { color: '#3b82f6', fontWeight: '600' },
});