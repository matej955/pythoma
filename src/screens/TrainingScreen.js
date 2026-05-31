import React, { useMemo } from "react";
import { Image, Text, View } from "react-native";
import { FALLBACK_CONTENT, allPrograms, styles, ScreenHeader, Tabs } from "./common";
function TrainingScreen({ tab, setTab, goBack, openMenu, content = FALLBACK_CONTENT }) {
  const programList = content.programs || allPrograms;
  const tabs = content.settings?.trainingTabs || FALLBACK_CONTENT.settings.trainingTabs;
  const programs = useMemo(() => {
    if (tab === "Svi programi") return programList;
    return programList.filter((program) => program.category === tab);
  }, [tab, programList]);

  return (
    <>
      <ScreenHeader title="TRENINZI" right="Sliders" onBack={goBack} onRight={openMenu} />
      <Tabs tabs={tabs} active={tab} setActive={setTab} />
      <View style={styles.trainingList}>
        {programs.map((program) => (
          <View key={program.title} style={styles.trainingCard}>
            <Image source={{ uri: program.img }} style={styles.trainingImage} />
            <View style={styles.trainingInfo}>
              <Text style={styles.trainingTitle}>{program.title}</Text>
              <Text style={styles.trainingText}>{program.weeks}</Text>
              <Text style={styles.trainingText}>{program.level}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
        ))}
      </View>
    </>
  );
}


export default TrainingScreen;
