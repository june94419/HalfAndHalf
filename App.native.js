import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen         from './src/screens/HomeScreen';
import CreateRoomScreen   from './src/screens/CreateRoomScreen';
import JoinRoomScreen     from './src/screens/JoinRoomScreen';
import RoomLobbyScreen    from './src/screens/RoomLobbyScreen';
import RoomGameScreen     from './src/screens/RoomGameScreen';
import DebateScreen       from './src/screens/DebateScreen';
import RevoteScreen       from './src/screens/RevoteScreen';
import RevoteResultScreen from './src/screens/RevoteResultScreen';
import RoomResultScreen   from './src/screens/RoomResultScreen';
import SoloGameScreen     from './src/screens/SoloGameScreen';
import SoloResultScreen   from './src/screens/SoloResultScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Home"         component={HomeScreen} />
        <Stack.Screen name="CreateRoom"   component={CreateRoomScreen} />
        <Stack.Screen name="JoinRoom"     component={JoinRoomScreen} />
        <Stack.Screen name="Lobby"        component={RoomLobbyScreen} />
        <Stack.Screen name="Game"         component={RoomGameScreen} />
        <Stack.Screen name="Debate"       component={DebateScreen} />
        <Stack.Screen name="Revote"       component={RevoteScreen} />
        <Stack.Screen name="RevoteResult" component={RevoteResultScreen} />
        <Stack.Screen name="Result"       component={RoomResultScreen} />
        <Stack.Screen name="SoloGame"     component={SoloGameScreen} />
        <Stack.Screen name="SoloResult"   component={SoloResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
