import React from "react";
import { Text, View } from "react-native";
import { FALLBACK_CONTENT, styles, TopChrome, Quick, Task, LeafLine } from "./common";

function HomeScreen({ go, openMenu, profile, content = FALLBACK_CONTENT }) {
  const settings = content.settings || FALLBACK_CONTENT.settings;
  const quickActions = settings.quickActions || FALLBACK_CONTENT.settings.quickActions;
  const todayTasks = settings.todayTasks || FALLBACK_CONTENT.settings.todayTasks;

  return (
    <>
      <TopChrome title={`Dobrodosla, ${profile.name || "ratnice"}!`} subtitle="Danas je novi dan za tvoj rast." openMenu={openMenu} />
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <Quick key={`${action.screen}-${action.label}`} icon={action.icon} label={action.label} onPress={() => go(action.screen)} />
        ))}
      </View>
      <View style={styles.focusCard}>
        <View>
          <Text style={styles.tiny}>DNEVNI FOKUS</Text>
          <Text style={styles.focusText}>{settings.dailyFocus}</Text>
        </View>
        <View style={styles.leafMark}>
          <LeafLine />
        </View>
      </View>
      <Text style={styles.sectionLabel}>DANAS TE CEKA</Text>
      {todayTasks.map((task) => (
        <Task key={task.title} title={task.title} subtitle={task.subtitle} icon={task.icon} />
      ))}
      <View style={styles.progressCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.tiny}>PROGRESS TRACKER</Text>
          <LeafLine small />
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.body}>Tjedan 4</Text>
          <Text style={styles.body}>62%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>
      </View>
    </>
  );
}

export default HomeScreen;
