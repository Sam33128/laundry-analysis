import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
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

export default function Home() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveImage = useMutation(api.files.saveImage);
  const markAnalyzed = useMutation(api.files.markAnalyzed);
  const analyzeImage = useAction(api.analyzeImage.analyzeImage);

  const [image, setImage] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [docId, setDocId] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [moisture, setMoisture] = useState("medium");
  const [sun, setSun] = useState("medium");
  const [placement, setPlacement] = useState("outdoor_sun");

  // Skeleton Animation Logic
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0.3);
    }
  }, [loading]);

  const handleImageSelection = async (res: ImagePicker.ImagePickerResult) => {
    if (!res.canceled) {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          res.assets[0].uri,
          [], 
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        setImage(manipulated.uri);
        setUploadedUrl(null);
        setDocId(null);
        setResult(null);
      } catch (error) {
        console.error("image conversion error:", error);
      }
    }
  };

  const takePhoto = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permission.granted) {
      Alert.alert("camera access", "camera access is required.");
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1, 
    });

    handleImageSelection(res);
  };

  const pickImage = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permission.granted) {
      Alert.alert("gallery access", "gallery access is required.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1, 
    });

    handleImageSelection(res);
  };

  const uploadImage = async () => {
    if (!image) throw new Error("no image selected.");
    
    const uploadUrl = await generateUploadUrl();
    
    const uploadRes = await FileSystem.uploadAsync(uploadUrl, image, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": "image/jpeg" },
    });

    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      throw new Error(`storage rejected upload. status: ${uploadRes.status}`);
    }
    
    const { storageId } = JSON.parse(uploadRes.body);
    const saved = await saveImage({ imageId: storageId });

    if (!saved) throw new Error("saveImage returned undefined.");

    let finalUrl = typeof saved === "string" ? saved : saved.imageUrl;
    let finalId = typeof saved === "string" ? null : saved.id;

    if (!finalUrl) throw new Error("could not extract image url.");

    setUploadedUrl(finalUrl);
    setDocId(finalId);

    return { id: finalId, imageUrl: finalUrl };
  };

  const handleAnalyze = async () => {
    if (!image || loading) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      let activeUrl = uploadedUrl;
      let activeDocId = docId;

      if (!activeUrl || !activeDocId) {
        const uploadResult = await uploadImage();
        activeUrl = uploadResult.imageUrl;
        activeDocId = uploadResult.id;
      }

      let currentLat = 20.2961; 
      let currentLon = 85.8245;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          currentLat = location.coords.latitude;
          currentLon = location.coords.longitude;
        }
      } catch (locErr) {
        console.warn("Error fetching location:", locErr);
      }

      const res = await analyzeImage({
        imageUrl: activeUrl,
        moisture,
        sun,
        placement,
        lat: currentLat, 
        lon: currentLon,
      });

      if (!res || res.error) {
        throw new Error(res?.message || "invalid ai response");
      }

      if (activeDocId) {
        await markAnalyzed({
          id: activeDocId,
          dryingTime: res.drying_time_minutes || 0,
          totalGarments: res.total_garments || 0,
          garmentsList: res.garments || [],
        });
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(res);
    } catch (err: any) {
      console.error("analysis error:", err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("process failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>𝕃𝕒𝕦𝕟𝕕𝕣𝕪 𝔸𝕟𝕒𝕝𝕪𝕫𝕖𝕣</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={takePhoto}>
          <Text style={styles.buttonText}>take photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.galleryButton]} onPress={pickImage}>
          <Text style={styles.buttonTextGallery}>gallery</Text>
        </TouchableOpacity>
      </View>

      {image && <Image source={{ uri: image }} style={styles.image} />}

      {image && (
        <View style={styles.card}>
          <View style={styles.pickerBlock}>
            <Text style={styles.label}>moisture</Text>
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={moisture} onValueChange={(val) => { setMoisture(val); Haptics.selectionAsync(); }}>
                <Picker.Item label="low" value="low" color="#000" />
                <Picker.Item label="medium" value="medium" color="#000" />
                <Picker.Item label="high" value="high" color="#000" />
              </Picker>
            </View>
          </View>

          <View style={styles.pickerBlock}>
            <Text style={styles.label}>sun exposure</Text>
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={sun} onValueChange={(val) => { setSun(val); Haptics.selectionAsync(); }}>
                <Picker.Item label="low" value="low" color="#000" />
                <Picker.Item label="medium" value="medium" color="#000" />
                <Picker.Item label="high" value="high" color="#000" />
              </Picker>
            </View>
          </View>

          <View style={styles.pickerBlock}>
            <Text style={styles.label}>placement</Text>
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={placement} onValueChange={(val) => { setPlacement(val); Haptics.selectionAsync(); }}>
                <Picker.Item label="indoor closed" value="indoor_closed" color="#000" />
                <Picker.Item label="indoor ventilated" value="indoor_ventilated" color="#000" />
                <Picker.Item label="outdoor shade" value="outdoor_shade" color="#000" />
                <Picker.Item label="outdoor sun" value="outdoor_sun" color="#000" />
              </Picker>
            </View>
          </View>

          <TouchableOpacity style={styles.analyze} onPress={handleAnalyze} disabled={loading}>
            <Text style={styles.analyzeText}>
              {loading ? "analyzing load..." : "analyze load"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <Animated.View style={[styles.skeletonCard, { opacity: pulseAnim }]}>
          <View style={styles.skeletonLineShort} />
          <View style={styles.skeletonLineMedium} />
          <View style={styles.skeletonLineLong} />
        </Animated.View>
      )}

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultHeader}>analysis results</Text>

          <View style={styles.timeBadge}>
            <Text style={styles.dryingTimeText}>
              ⏱ est. drying time: {result.drying_time_minutes} mins
            </Text>
          </View>
          
          <Text style={styles.resultTextBold}>
            total garments detected: <Text style={styles.resultText}>{result.total_garments}</Text>
          </Text>

          {result.garments?.map((garment: any, index: number) => (
            <View key={index} style={styles.garmentList}>
              <Text style={styles.resultText}>• {garment.type} ({garment.fabric})</Text>
            </View>
          ))}

          <View style={styles.weatherCard}>
            <Text style={styles.weatherHeader}>weather context</Text>
            <View style={styles.weatherRow}>
              <Text style={styles.weatherItem}>temp: {result.weather?.temperature}°C</Text>
              <Text style={styles.weatherItem}>humidity: {result.weather?.humidity}%</Text>
              <Text style={styles.weatherItem}>wind: {result.weather?.wind_speed} km/h</Text>
            </View>
            
            {result.weather?.humidity > 80 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ high humidity detected ({'>'}80%). consider indoor ventilated drying to prevent mildew.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090d16",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 50,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    marginBottom: 16,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraButton: {
    flex: 1.5,
    backgroundColor: "#10b981",
  },
  galleryButton: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonTextGallery: {
    color: "#cbd5e1",
    fontWeight: "600",
    fontSize: 14,
  },
  analyze: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  analyzeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  image: {
    width: "100%",
    height: 240,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  card: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  pickerBlock: {
    marginTop: 8,
  },
  label: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pickerWrapper: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    overflow: "hidden",
  },
  resultContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  resultHeader: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  timeBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    marginBottom: 12,
  },
  dryingTimeText: {
    color: "#34d399",
    fontSize: 15,
    fontWeight: "700",
  },
  resultTextBold: {
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 6,
  },
  resultText: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  garmentList: {
    marginTop: 4,
    marginLeft: 4,
  },
  weatherCard: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#030712",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  weatherHeader: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  weatherRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weatherItem: {
    color: "#9ca3af",
    fontSize: 12,
  },
  warningBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    borderLeftWidth: 3,
    borderLeftColor: "#eab308",
    borderRadius: 6,
  },
  warningText: {
    color: "#fde047",
    fontSize: 12,
    lineHeight: 18,
  },
  skeletonCard: {
    marginTop: 20,
    padding: 20,
    backgroundColor: "#111827",
    borderRadius: 16,
    height: 150,
  },
  skeletonLineShort: {
    height: 20,
    width: "40%",
    backgroundColor: "#1f2937",
    borderRadius: 4,
    marginBottom: 16,
  },
  skeletonLineMedium: {
    height: 14,
    width: "70%",
    backgroundColor: "#1f2937",
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonLineLong: {
    height: 14,
    width: "90%",
    backgroundColor: "#1f2937",
    borderRadius: 4,
  },
});