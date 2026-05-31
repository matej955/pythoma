import React, { useEffect, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { FALLBACK_CONTENT, image, styles, ScreenHeader, AuthInput, ProfileStat, resolveImageValue } from "./common";
function ProfileScreen({ profile, setProfile, goBack, onLogout, content = FALLBACK_CONTENT }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const images = content.images || image;
  const stats = content.settings?.profileStats || FALLBACK_CONTENT.settings.profileStats;
  const discount = content.settings?.brandDiscount || FALLBACK_CONTENT.settings.brandDiscount;
  const discountImage = resolveImageValue(discount.image || discount.imageKey, images, "supplements");

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  return (
    <>
      <ScreenHeader title="MOJ PROFIL" right={editing ? "Save" : "Edit"} onBack={goBack} onRight={() => {
        if (editing) setProfile(draft);
        setEditing((current) => !current);
      }} />
      <View style={styles.profileCard}>
        <Image source={{ uri: images.woman }} style={styles.profileImage} />
        <View style={styles.profileText}>
          {editing ? (
            <>
              <TextInput style={styles.profileInput} value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
              <TextInput style={styles.profileInput} value={draft.goal} onChangeText={(goal) => setDraft({ ...draft, goal })} />
            </>
          ) : (
            <>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileMotto}>{profile.goal}</Text>
              {!!profile.email && <Text style={styles.profileEmail}>{profile.email}</Text>}
            </>
          )}
        </View>
      </View>
      {editing && (
        <View style={styles.editGrid}>
          <AuthInput value={draft.age} onChangeText={(age) => setDraft({ ...draft, age })} placeholder="Godine" keyboardType="number-pad" />
          <AuthInput value={draft.level} onChangeText={(level) => setDraft({ ...draft, level })} placeholder="Level" />
        </View>
      )}
      <View style={styles.profileStats}>
        {stats.map((stat) => (
          <ProfileStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </View>
      <View style={styles.gazzCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.gazzTitle}>{discount.title}</Text>
          <Text style={styles.bottle}>G</Text>
        </View>
        <Text style={styles.gazzText}>{discount.text}</Text>
        <View style={styles.gazzBody}>
          <View style={styles.discountBadge}>
            <Text style={styles.discountMain}>{discount.code}</Text>
            <Text style={styles.discountSub}>{discount.subtext}</Text>
          </View>
          <Image source={{ uri: discountImage }} style={styles.supplements} />
        </View>
      </View>
      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Odjavi se</Text>
      </Pressable>
    </>
  );
}


export default ProfileScreen;
