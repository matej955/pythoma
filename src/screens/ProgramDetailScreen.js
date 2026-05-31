import React from "react";
import { Image, ScrollView, Text } from "react-native";
import { FALLBACK_CONTENT, image, styles, ScreenHeader } from "./common";
function ProgramDetailScreen({ program, goBack, content = FALLBACK_CONTENT }) {
  const prog = program || {};
  const images = content.images || image;
  return (
    <>
      <ScreenHeader title={prog.title || "Program"} onBack={goBack} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <Image source={{ uri: prog.img || prog.image || prog.imageUrl || images.glutes }} style={{ width: "100%", height: 220, borderRadius: 12, marginBottom: 12 }} />
        <Text style={styles.potionSectionTitle}>{prog.title}</Text>
        <Text style={styles.body}>{prog.weeks || prog.meta?.weeks || prog.meta?.duration || ""}</Text>
        <Text style={styles.potionBody}>{prog.meta?.level || prog.level || ""}</Text>
        <Text style={styles.potionSectionTitle}>Opis</Text>
        <Text style={styles.potionBody}>{prog.meta?.description || prog.description || "Detalji programa nisu dostupni."}</Text>
      </ScrollView>
    </>
  );
}


export default ProgramDetailScreen;
