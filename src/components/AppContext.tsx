"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit, where } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Types
interface RobotStatus {
  robotId: string;
  status: string;
  currentTag: number | null;
  previousTag: number | null;
  discoveredTagsCount: number;
  explorationSessionId: string | null;
  dockingTagId: number | null;
  speed: number;
  delay: number;
  lastUpdate: any;
  isOnline: boolean;
  errorMessage?: string;
}

interface RobotCommand {
  robotId: string;
  command: string;
  parameters?: any;
  timestamp: any;
  status: 'pending' | 'executed' | 'failed';
  timestampExecuted?: any;
  errorMessage?: string;
}

interface NFCTag {
  robotId: string;
  tagId: number;
  uid: string;
  timestamp: any;
  status: string;
  location: any;
}

interface BatteryData {
  robotId: string;
  batteryPercentage: number;
  voltage?: number;
  current?: number;
  timestamp: any;
  status: string;
}

interface CameraFrame {
  robotId: string;
  frameId: string;
  cameraType: string;  // "primary" or "secondary"
  imageUrl: string;
  timestamp: any;
  status: string;
  size: number;
}

interface CombinedCameraData {
  robotId: string;
  timestamp: any;
  status: string;
  frames: {
    primary?: string;
    secondary?: string;
  };
  primary_available: boolean;
  secondary_available: boolean;
}

interface CameraStatus {
  robotId: string;
  timestamp: any;
  status: string;
  primary_available: boolean;
  secondary_available: boolean;
  is_capturing: boolean;
  primary_frame_available: boolean;
  secondary_frame_available: boolean;
  frame_width: number;
  frame_height: number;
  fps: number;
}

interface ExplorationSession {
  robotId: string;
  sessionId: string;
  discoveredTags: any[];
  pathData: any[];
  startTime: any;
  status: string;
  tagCount: number;
}

interface AppContextType {
  // Robot state
  robotStatus: RobotStatus | null;
  currentTag: number | null;
  previousTag: number | null;
  discoveredTags: NFCTag[];
  batteryLevel: number | null;
  latestCameraFrame: CameraFrame | null;
  latestPrimaryCameraFrame: CameraFrame | null;
  latestSecondaryCameraFrame: CameraFrame | null;
  combinedCameraData: CombinedCameraData | null;
  cameraStatus: CameraStatus | null;
  explorationSessions: ExplorationSession[];
  
  // Control functions
  sendCommand: (command: string, parameters?: any) => Promise<void>;
  startExploration: () => Promise<void>;
  stopRobot: () => Promise<void>;
  emergencyStop: () => Promise<void>;
  goToTag: (tagId: number) => Promise<void>;
  returnHome: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setDelay: (delay: number) => Promise<void>;
  followPath: (waypoints: number[]) => Promise<void>;
  
  // Utility functions
  isConnected: boolean;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
  const [currentTag, setCurrentTag] = useState<number | null>(null);
  const [previousTag, setPreviousTag] = useState<number | null>(null);
  const [discoveredTags, setDiscoveredTags] = useState<NFCTag[]>([]);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [latestCameraFrame, setLatestCameraFrame] = useState<CameraFrame | null>(null);
  const [latestPrimaryCameraFrame, setLatestPrimaryCameraFrame] = useState<CameraFrame | null>(null);
  const [latestSecondaryCameraFrame, setLatestSecondaryCameraFrame] = useState<CameraFrame | null>(null);
  const [combinedCameraData, setCombinedCameraData] = useState<CombinedCameraData | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);
  const [explorationSessions, setExplorationSessions] = useState<ExplorationSession[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const robotId = "line_follower_robot_001";

  // Send command to robot
  const sendCommand = async (command: string, parameters?: any) => {
    try {
      const commandData: RobotCommand = {
        robotId,
        command,
        parameters,
        timestamp: serverTimestamp(),
        status: 'pending'
      };

      await addDoc(collection(db, 'robot_commands'), commandData);
      console.log(`📡 Command sent: ${command}`, parameters);
    } catch (error) {
      console.error('❌ Failed to send command:', error);
      throw error;
    }
  };

  // Robot control functions
  const startExploration = () => sendCommand('start_exploration');
  const stopRobot = () => sendCommand('stop');
  const emergencyStop = () => sendCommand('emergency_stop');
  const goToTag = (tagId: number) => sendCommand('go_to_tag', { tag_id: tagId });
  const returnHome = () => sendCommand('return_home');
  const setSpeed = (speed: number) => sendCommand('set_speed', { speed });
  const setDelay = (delay: number) => sendCommand('set_delay', { delay });
  const followPath = (waypoints: number[]) => sendCommand('follow_path', { waypoints });

  // Set up Firebase listeners
  useEffect(() => {
    setIsLoading(true);

    // Listen to robot status
    const statusQuery = query(
      collection(db, 'robot_status'),
      orderBy('lastUpdate', 'desc'),
      limit(1)
    );

    const statusUnsubscribe = onSnapshot(statusQuery, (snapshot) => {
      if (!snapshot.empty) {
        const statusData = snapshot.docs[0].data() as RobotStatus;
        setRobotStatus(statusData);
        setCurrentTag(statusData.currentTag);
        setPreviousTag(statusData.previousTag);
        setIsConnected(statusData.isOnline);
      }
    });

    // Listen to battery data
    const batteryQuery = query(
      collection(db, 'robot_battery'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const batteryUnsubscribe = onSnapshot(batteryQuery, (snapshot) => {
      if (!snapshot.empty) {
        const batteryData = snapshot.docs[0].data() as BatteryData;
        setBatteryLevel(batteryData.batteryPercentage);
      }
    });

    // Listen to primary camera frames
    const primaryCameraQuery = query(
      collection(db, 'robot_camera'),
      where('cameraType', '==', 'primary'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const primaryCameraUnsubscribe = onSnapshot(primaryCameraQuery, (snapshot) => {
      if (!snapshot.empty) {
        const cameraData = snapshot.docs[0].data() as CameraFrame;
        setLatestPrimaryCameraFrame(cameraData);
        setLatestCameraFrame(cameraData); // Keep for backward compatibility
      }
    });

    // Listen to secondary camera frames
    const secondaryCameraQuery = query(
      collection(db, 'robot_camera'),
      where('cameraType', '==', 'secondary'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const secondaryCameraUnsubscribe = onSnapshot(secondaryCameraQuery, (snapshot) => {
      if (!snapshot.empty) {
        const cameraData = snapshot.docs[0].data() as CameraFrame;
        setLatestSecondaryCameraFrame(cameraData);
      }
    });

    // Listen to combined camera data
    const combinedCameraQuery = query(
      collection(db, 'robot_camera_combined'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const combinedCameraUnsubscribe = onSnapshot(combinedCameraQuery, (snapshot) => {
      if (!snapshot.empty) {
        const combinedData = snapshot.docs[0].data() as CombinedCameraData;
        setCombinedCameraData(combinedData);
      }
    });

    // Listen to camera status
    const cameraStatusQuery = query(
      collection(db, 'robot_camera_status'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const cameraStatusUnsubscribe = onSnapshot(cameraStatusQuery, (snapshot) => {
      if (!snapshot.empty) {
        const statusData = snapshot.docs[0].data() as CameraStatus;
        setCameraStatus(statusData);
      }
    });

    // Listen to NFC tags
    const nfcQuery = query(
      collection(db, 'nfc_tags'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const nfcUnsubscribe = onSnapshot(nfcQuery, (snapshot) => {
      const tags = snapshot.docs.map(doc => doc.data() as NFCTag);
      setDiscoveredTags(tags);
    });

    // Listen to exploration sessions
    const explorationQuery = query(
      collection(db, 'exploration_sessions'),
      orderBy('startTime', 'desc'),
      limit(10)
    );

    const explorationUnsubscribe = onSnapshot(explorationQuery, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data() as ExplorationSession);
      setExplorationSessions(sessions);
    });

    setIsLoading(false);

    // Cleanup listeners
    return () => {
      statusUnsubscribe();
      batteryUnsubscribe();
      primaryCameraUnsubscribe();
      secondaryCameraUnsubscribe();
      combinedCameraUnsubscribe();
      cameraStatusUnsubscribe();
      nfcUnsubscribe();
      explorationUnsubscribe();
    };
  }, []);

  // Prevent context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  const contextValue: AppContextType = {
    robotStatus,
    currentTag,
    previousTag,
    discoveredTags,
    batteryLevel,
    latestCameraFrame,
    latestPrimaryCameraFrame,
    latestSecondaryCameraFrame,
    combinedCameraData,
    cameraStatus,
    explorationSessions,
    sendCommand,
    startExploration,
    stopRobot,
    emergencyStop,
    goToTag,
    returnHome,
    setSpeed,
    setDelay,
    followPath,
    isConnected,
    isLoading
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}
