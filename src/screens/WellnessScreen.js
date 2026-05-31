import React, { useEffect, useState } from "react";
import { ImageBackground, Text, View } from "react-native";
import { FALLBACK_CONTENT, potions, styles, ScreenHeader, Tabs } from "./common";
function WellnessScreen({ goBack, content = FALLBACK_CONTENT }) {
  const contentPotions = content.potions || potions;
  const dailyBoard = content.settings?.dailyBoard || FALLBACK_CONTENT.settings.dailyBoard;
  const [dailyTab, setDailyTab] = useState(dailyBoard.tabs[0]);
  const [drinkTab, setDrinkTab] = useState(contentPotions[0]?.title);
  const selectedPotion = contentPotions.find((potion) => potion.title === drinkTab) || contentPotions[0] || {};

  useEffect(() => {
    if (!dailyBoard.tabs.includes(dailyTab)) setDailyTab(dailyBoard.tabs[0]);
    if (!contentPotions.some((potion) => potion.title === drinkTab)) setDrinkTab(contentPotions[0]?.title);
  }, [dailyBoard.tabs, contentPotions, dailyTab, drinkTab]);

  return (
    <>
      <ScreenHeader title="DAILY BOARD" right="Leaf" onBack={goBack} />
      <Tabs tabs={dailyBoard.tabs} active={dailyTab} setActive={setDailyTab} />
      <View style={styles.dailyCard}>
        <Text style={styles.sun}>{dailyTab === "Jutro" ? "SUN" : "MOON"}</Text>
        <Text style={styles.dailyTitle}>{dailyTab.toUpperCase()}</Text>
        {dailyBoard.messages.map((line) => (
          <Text key={line} style={styles.dailyText}>{line}</Text>
        ))}
      </View>
      <ScreenHeader title="CAROBNI NAPITCI" right="Leaf" compact onBack={goBack} />
      <Tabs tabs={contentPotions.map((potion) => potion.title)} active={drinkTab} setActive={setDrinkTab} />
      <View style={styles.potionCard}>
        <ImageBackground source={{ uri: selectedPotion.image }} style={styles.potionHero} imageStyle={styles.potionHeroImage}>
          <View style={styles.potionHeroShade} />
          <Text style={styles.potionCategory}>{selectedPotion.tab}</Text>
          <Text style={styles.potionHeroTitle}>{selectedPotion.title}</Text>
        </ImageBackground>
        <Text style={styles.potionTiming}>{selectedPotion.timing}</Text>
        <PotionSection title="Sastojci" items={selectedPotion.ingredients} />
        <Text style={styles.potionSectionTitle}>Priprema</Text>
        <Text style={styles.potionBody}>{selectedPotion.preparation}</Text>
        <Text style={styles.potionSectionTitle}>Benefiti</Text>
        <Text style={styles.potionBody}>{selectedPotion.benefits}</Text>
      </View>
    </>
  );
}

function PotionSection({ title, items }) {
  return (
    <View>
      <Text style={styles.potionSectionTitle}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.potionBullet}>
          - {item}
        </Text>
      ))}
    </View>
  );
}


export default WellnessScreen;
