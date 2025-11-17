import React from 'react'; 
import {SafeAreaView, StyleSheet, Text, View} from 'react-native'; 
 
function App(): React.JSX.Element { 
  return ( 
    <SafeAreaView style={styles.container}> 
      <View style={styles.content}> 
        <Text style={styles.title}>Zeigarnik Habit Garden</Text> 
        <Text style={styles.subtitle}>習慣化アプリ - セットアップ完了！</Text> 
      </View> 
    </SafeAreaView> 
  ); 
} 
 
const styles = StyleSheet.create({ 
  container: {flex: 1, backgroundColor: '#f5f5f5'}, 
  content: {flex: 1, justifyContent: 'center', alignItems: 'center'}, 
  title: {fontSize: 24, fontWeight: 'bold', marginBottom: 10}, 
  subtitle: {fontSize: 16, color: '#666'}, 
}); 
 
export default App; 
