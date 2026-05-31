import React, { useState } from "react";
import { Alert, ImageBackground, Pressable, SafeAreaView, StatusBar, Text, TextInput, View } from "react-native";
import { firebaseConfigStatus, hasFirebaseConfig, loginWithEmail, registerWithEmail } from "../../firebaseConfig";
import { FALLBACK_CONTENT, image, colors, styles, profileNameFromUser, BrandLogo, PillButton, GoogleButton, AuthInput } from "./common";
function AuthScreen({ mode, setMode, onGuest, onAuth, onGoogle, request, content = FALLBACK_CONTENT }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isForm = mode === "login" || mode === "register";
  const images = content.images || image;

  async function submit() {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password.");
      return;
    }
    if (!hasFirebaseConfig) {
      onAuth({ type: "demo", name: profileNameFromUser({ email, fallback: name }), email });
      return;
    }
    try {
      const credential =
        mode === "register" ? await registerWithEmail({ email, password, name }) : await loginWithEmail(email, password);
      onAuth({
        type: "firebase",
        uid: credential.user.uid,
        name: profileNameFromUser({ displayName: credential.user.displayName, email: credential.user.email, fallback: name }),
        email: credential.user.email,
      });
    } catch (error) {
      Alert.alert(
        "Firebase auth",
        `${error.message}\n\nLoaded project: ${firebaseConfigStatus.projectId}\nAPI key starts: ${firebaseConfigStatus.apiKeyPrefix}`,
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeDark}>
      <StatusBar barStyle="light-content" backgroundColor={colors.forest} />
      <ImageBackground source={{ uri: images.login }} style={styles.login} imageStyle={styles.loginImage}>
        <View style={styles.loginVeil} />
        <BrandLogo light large />
        {!isForm ? (
          <>
            <View style={styles.loginCopy}>
              <Text style={styles.loginPhrase}>Tvoj prostor.</Text>
              <Text style={styles.loginPhrase}>Tvoja snaga.</Text>
              <Text style={styles.loginPhrase}>Tvoja zajednica.</Text>
            </View>
            <View style={styles.loginButtons}>
              <PillButton label="PRIJAVI SE" onPress={() => setMode("login")} dark />
              <PillButton label="REGISTRIRAJ SE" onPress={() => setMode("register")} />
              <GoogleButton onPress={onGoogle} disabled={!request && hasFirebaseConfig} />
              <Pressable onPress={onGuest}>
                <Text style={styles.guest}>Nastavi kao gost</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.authPanel}>
            <Text style={styles.authTitle}>{mode === "register" ? "Kreiraj profil" : "Prijava"}</Text>
            {mode === "register" && (
              <AuthInput value={name} onChangeText={setName} placeholder="Ime profila" />
            )}
            <AuthInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
            <AuthInput value={password} onChangeText={setPassword} placeholder="Lozinka" secureTextEntry />
            <PillButton label={mode === "register" ? "REGISTRIRAJ SE" : "PRIJAVI SE"} onPress={submit} dark />
            <GoogleButton onPress={onGoogle} disabled={!request && hasFirebaseConfig} />
            <Pressable onPress={() => setMode("welcome")}>
              <Text style={styles.formBack}>Nazad</Text>
            </Pressable>
          </View>
        )}
      </ImageBackground>
    </SafeAreaView>
  );
}


export default AuthScreen;
