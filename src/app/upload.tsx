import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useState, useEffect, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Picker } from "@react-native-picker/picker";
import { useUser, useAuth } from "@clerk/expo";
import { Redirect, useRouter } from "expo-router";

const LAUNDRY_FACTS = [
  "👕 The first electric washing machine, 'The Thor', was introduced in 1908.",
  "👖 Washing jeans inside out helps preserve their color and prevents fading.",
  "☀️ The sun's UV rays act as a natural bleach and disinfectant for white clothes.",
  "🧊 Washing in cold water saves up to 90% of the energy used by modern washing machines.",
  "🍋 Lemon juice and baking soda can naturally remove tough stains without harsh chemicals."
];

export default function UploadModal() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveImage = useMutation(api.files.saveImage);
  const markAnalyzed = useMutation(api.files.markAnalyzed);
  const analyzeImage = useAction(api.analyzeImage.analyzeImage);
  const createSession = useMutation(api.sessions.createSession);

  const [image, setImage] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [docId, setDocId] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [moisture, setMoisture] = useState("");
  const [factIndex, setFactIndex] = useState(0);

  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        ])
      ).start();

      interval = setInterval(() => {
        setFactIndex((prev) => (prev + 1) % LAUNDRY_FACTS.length);
      }, 10000);
    } else {
      pulseAnim.setValue(0.3);
      setFactIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  if (!isLoaded) return <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  if (!isSignedIn) return <Redirect href="/login" />;

  const handleImageSelection = async (res: ImagePicker.ImagePickerResult) => {
    if (!res.canceled && res.assets && res.assets.length > 0) {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          res.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        setImage(manipulated.uri);
        setUploadedUrl(null);
        setDocId(null);
        setResult(null);
      } catch (error) {
        Alert.alert("Image Error", "Failed to process the selected image.");
      }
    }
  };

  const takePhoto = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Camera Access Required");
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    handleImageSelection(res);
  };

  const pickImage = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Gallery Access Required");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    handleImageSelection(res);
  };

  const uploadImage = async () => {
    if (!image) throw new Error("No image selected.");
    const uploadUrl = await generateUploadUrl();
    const uploadRes = await FileSystem.uploadAsync(uploadUrl, image, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": "image/jpeg" },
    });
    if (uploadRes.status < 200 || uploadRes.status >= 300) throw new Error(`Upload failed`);
    
    const { storageId } = JSON.parse(uploadRes.body);
    const saved: any = await saveImage({ imageId: storageId });
    const finalUrl = typeof saved === "string" ? saved : (saved.imageUrl || saved.url);
    const finalId = typeof saved === "string" ? null : (saved.id || saved._id);

    setUploadedUrl(finalUrl);
    setDocId(finalId);
    return { id: finalId, imageUrl: finalUrl };
  };

  const handleAnalyze = async () => {
    if (!image || loading) return;
    if (!moisture) return Alert.alert("Missing Selection", "Please select the Moisture Level.");
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      let activeUrl = uploadedUrl;
      let activeDocId = docId;

      if (!activeUrl) {
        const uploadResult = await uploadImage();
        activeUrl = uploadResult.imageUrl;
        activeDocId = uploadResult.id;
      }

      let currentLat = 20.2961, currentLon = 85.8245;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          currentLat = location.coords.latitude;
          currentLon = location.coords.longitude;
        }
      } catch (e) { console.warn("Location error"); }

      const res: any = await analyzeImage({
        imageUrl: activeUrl as string,
        moisture,
        garmentOverride: "auto",
        lat: currentLat, 
        lon: currentLon,
      });

      if (!res || res.error) throw new Error("Invalid AI response.");

      if (activeDocId) {
        await markAnalyzed({
          id: activeDocId,
          dryingTime: res.drying_time_minutes || 0,
          totalGarments: res.total_garments || 0,
          garmentsList: res.garments || [],
        }).catch(() => console.warn("DB update failed"));
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ ...res, imageUrl: activeUrl });
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Process Failed", err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!result) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    await createSession({
      imageUrl: result.imageUrl,
      estimatedMinutes: result.drying_time_minutes,
      garments: result.garments,
      weatherContext: result.weather,
    });

    Alert.alert("Session Started", "Timer has begun. Leave the app open to hear the chime!", [
      { 
        text: "OK", 
        onPress: () => {
          setTimeout(() => {
            Alert.alert("🧺 Laundry is Dry!", "Your clothes have finished their estimated drying time.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }, result.drying_time_minutes * 60000);
          router.back(); 
        } 
      } 
    ]);
  };

  const handleReset = () => {
    setImage(null);
    setUploadedUrl(null);
    setDocId(null);
    setResult(null);
    setMoisture("");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={takePhoto} disabled={loading}>
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.galleryButton]} onPress={pickImage} disabled={loading}>
          <Text style={styles.buttonTextGallery}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {image && <Image source={{ uri: image }} style={styles.image} />}

      {image && !loading && !result && (
        <View style={styles.card}>
          <View style={styles.pickerBlock}>
            <Text style={styles.label}>Moisture Level</Text>
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={moisture} onValueChange={(val) => { setMoisture(val); Haptics.selectionAsync(); }}>
                <Picker.Item label="Select Moisture..." value="" color="#64748b" />
                <Picker.Item label="Low" value="low" color="#000" />
                <Picker.Item label="Medium" value="medium" color="#000" />
                <Picker.Item label="High" value="high" color="#000" />
              </Picker>
            </View>
          </View>
          <TouchableOpacity style={[styles.analyze, { marginTop: 20 }]} onPress={handleAnalyze} disabled={loading}>
            <Text style={styles.analyzeText}>Analyze Load</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingHeader}>Analyzing AI Vision...</Text>
          <Animated.View style={[styles.factBox, { opacity: pulseAnim, marginTop: 16 }]}>
            <Text style={styles.factTitle}>Did you know?</Text>
            <Text style={styles.factText}>{LAUNDRY_FACTS[factIndex]}</Text>
          </Animated.View>
        </View>
      )}

      {result && !loading && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultHeader}>Analysis Results</Text>
          <View style={styles.timeBadge}>
            <Text style={styles.dryingTimeText}>⏱ Est. Drying Time: {result.drying_time_minutes} mins</Text>
          </View>
          
          <Text style={styles.resultTextBold}>Total Garments: <Text style={styles.resultText}>{result.total_garments}</Text></Text>
          
          <TouchableOpacity style={styles.startButton} onPress={handleStartSession}>
            <Text style={styles.startButtonText}>Start Session</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.resetButton, { marginTop: 12 }]} onPress={handleReset}>
            <Text style={styles.resetText}>Cancel & Start Over</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090d16" },
  contentContainer: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#090d16" },
  actionRow: { flexDirection: "row", gap: 12 },
  button: { padding: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cameraButton: { flex: 1.5, backgroundColor: "#10b981" },
  galleryButton: { flex: 1, backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  buttonTextGallery: { color: "#cbd5e1", fontWeight: "600", fontSize: 14 },
  analyze: { backgroundColor: "#3b82f6", padding: 16, borderRadius: 12, alignItems: "center" },
  analyzeText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  image: { width: "100%", height: 240, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: "#1e293b" },
  card: { backgroundColor: "#111827", padding: 16, borderRadius: 16, marginTop: 16, borderWidth: 1, borderColor: "#1f2937" },
  pickerBlock: { marginTop: 8 },
  label: { color: "#9ca3af", fontSize: 12, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  pickerWrapper: { backgroundColor: "#1f2937", borderRadius: 8, overflow: "hidden" },
  resultContainer: { marginTop: 20, padding: 20, backgroundColor: "#111827", borderRadius: 16, borderWidth: 1, borderColor: "#1f2937" },
  resultHeader: { color: "#ffffff", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  timeBadge: { backgroundColor: "rgba(16, 185, 129, 0.1)", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.2)", marginBottom: 12 },
  dryingTimeText: { color: "#34d399", fontSize: 15, fontWeight: "700" },
  resultTextBold: { color: "#e2e8f0", fontWeight: "600", fontSize: 14, marginBottom: 6 },
  resultText: { color: "#94a3b8", fontWeight: "400" },
  loadingContainer: { marginTop: 24, padding: 24, backgroundColor: "#111827", borderRadius: 16, alignItems: "center" },
  loadingHeader: { color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 16 },
  factBox: { backgroundColor: "rgba(59, 130, 246, 0.1)", padding: 16, borderRadius: 12, width: "100%", borderLeftWidth: 3, borderLeftColor: "#3b82f6" },
  factTitle: { color: "#60a5fa", fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginBottom: 6 },
  factText: { color: "#e2e8f0", fontSize: 14, lineHeight: 20 },
  startButton: { backgroundColor: "#10b981", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 20 },
  startButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  resetButton: { backgroundColor: "#1e293b", padding: 16, borderRadius: 12, alignItems: "center" },
  resetText: { color: "#ef4444", fontWeight: "600", fontSize: 15 },
}); 