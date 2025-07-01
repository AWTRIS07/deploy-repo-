"use client";

import { useState, useEffect, useCallback, useRef }
from 'react';
import { DestinationSelectorCard } from '@/components/DestinationSelectorCard';
import { NfcTagMonitorCard } from '@/components/NfcTagMonitorCard';
import { MotorPwmDisplayCard } from '@/components/MotorPwmDisplayCard';
import { DelayControlCard } from '@/components/DelayControlCard';
import { MapDisplay } from '@/components/MapDisplay';
import { TrajectoryLogCard } from '@/components/TrajectoryLogCard';
import { WaypointDelayDialog } from '@/components/WaypointDelayDialog';
import { RobotControlCard } from '@/components/RobotControlCard';
import { NFC_TAG_POSITIONS as defaultTagPositions, type TagPosition } from '@/lib/tag-positions';
import { findPath } from '@/lib/pathfinding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Moon, Sun, RefreshCw, Settings, Wifi, WifiOff, Camera } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, serverTimestamp, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { useAppContext } from '@/components/AppContext';
import { Badge } from "@/components/ui/badge";

type RobotPhase = 'stopped' | 'following_fixed_path' | 'returning_to_start' | 'going_to_destination' | 'idle_at_start' | 'at_destination' | 'pathfinding_error' | 'idle_after_fixed_path';

export interface TrajectoryWaypoint {
  tagId: number;
  delayOverrideMs?: number;
}

const START_TAG_ID = 1;
const MIN_SIMULATION_INTERVAL_MS = 200;
const MAX_SIMULATION_INTERVAL_MS = 2000;
const MAX_SPEED_KMH = 10;
const LOCAL_STORAGE_KEY_MAP_EDITOR = 'customMapData';
const LOCAL_STORAGE_KEY_SPEED = 'robotSpeedKmHr'; // Changed key for clarity
const FIRESTORE_LOGS_COLLECTION = 'robot_logs';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let firebaseApp: FirebaseApp | null = null;
let firestoreDB: Firestore | null = null;

try {
  if (firebaseConfig.projectId && firebaseConfig.apiKey) {
    firebaseApp = initializeApp(firebaseConfig);
    firestoreDB = getFirestore(firebaseApp);
  } else {
    console.warn("Firebase configuration is incomplete (projectId or apiKey missing). Firestore integration will be disabled.");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
  firebaseApp = null;
  firestoreDB = null;
}


const isValidTagPositionArrayForMain = (data: any): data is TagPosition[] => {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'number' &&
      typeof item.name === 'string' &&
      typeof item.x === 'number' &&
      item.x >= 0 && item.x <= 100 &&
      typeof item.y === 'number' &&
      item.y >= 0 && item.y <= 100 &&
      Array.isArray(item.connections) &&
      item.connections.every((c: any) => typeof c === 'number')
  );
};


const formatMillisecondsToTime = (totalMs: number): string => {
  if (totalMs < 0) totalMs = 0;
  const milliseconds = Math.floor((totalMs % 1000) / 100);
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${milliseconds}`;
};

interface FunctionRefs {
  initiateFixedPathSequence: (isAutoRestart?: boolean) => void;
  handlePathCompletion: () => Promise<void>;
  simulationTick: () => Promise<void>;
  updateMotorPwmForMovement: () => void;
  calculateAndSetNewPathForDestination: (startId: number, endId: number) => boolean;
  generateFixedPathOrder: () => number[];
}


export default function HomePage() {
  // Add AppContext integration
  const {
    robotStatus: appRobotStatus,
    currentTag: appCurrentTag,
    previousTag: appPreviousTag,
    discoveredTags: appDiscoveredTags,
    batteryLevel: appBatteryLevel,
    latestCameraFrame: appCameraFrame,
    latestPrimaryCameraFrame: appPrimaryCameraFrame,
    latestSecondaryCameraFrame: appSecondaryCameraFrame,
    cameraStatus: appCameraStatus,
    explorationSessions: appExplorationSessions,
    startExploration,
    stopRobot,
    emergencyStop,
    goToTag,
    returnHome,
    setSpeed: appSetSpeed,
    setDelay: appSetDelay,
    followPath: appFollowPath,
    isConnected: appIsConnected,
    isLoading: appIsLoading
  } = useAppContext();

  const [currentNfcTagPositions, setCurrentNfcTagPositions] = useState<TagPosition[]>(() => {
    if (typeof window !== 'undefined') {
      const storedMap = localStorage.getItem(LOCAL_STORAGE_KEY_MAP_EDITOR);
      if (storedMap) {
        try {
          const parsedMap = JSON.parse(storedMap);
          if (isValidTagPositionArrayForMain(parsedMap) && parsedMap.length > 0) {
            return parsedMap;
          } else {
            console.warn("Invalid or empty custom map data found in localStorage. Using default map.");
            localStorage.removeItem(LOCAL_STORAGE_KEY_MAP_EDITOR);
          }
        } catch (e) {
          console.error("Failed to parse custom map from localStorage. Using default map.", e);
          localStorage.removeItem(LOCAL_STORAGE_KEY_MAP_EDITOR);
        }
      }
    }
    return defaultTagPositions;
  });

  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window !== 'undefined') {
        const storedSpeed = localStorage.getItem(LOCAL_STORAGE_KEY_SPEED);
        if (storedSpeed) {
            const parsedSpeed = parseFloat(storedSpeed);
            if (!isNaN(parsedSpeed) && parsedSpeed >= 0 && parsedSpeed <= MAX_SPEED_KMH) {
                return parsedSpeed;
            }
        }
    }
    return 2.5; // Default speed in km/hr
  });
  const [globalTagVisitDelayMs, setGlobalTagVisitDelayMs] = useState<number>(500);
  const [destinationQueue, setDestinationQueue] = useState<TrajectoryWaypoint[]>([]);
  const [nfcTags, setNfcTags] = useState<Record<number, string>>({});
  const [motorPwm, setMotorPwm] = useState<number>(0);

  const currentRobotTagIdRef = useRef<number>(START_TAG_ID);
  const [displayedRobotTagId, setDisplayedRobotTagId] = useState<number>(START_TAG_ID);

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [isContinuousFixedPath, setIsContinuousFixedPath] = useState<boolean>(false);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean | null>(null);

  const [robotPhase, setRobotPhase] = useState<RobotPhase>('stopped');
  const [fixedPathTargetQueue, setFixedPathTargetQueue] = useState<number[]>([]);
  const [currentPath, setCurrentPath] = useState<number[]>([]);

  const [countdownRemainingMs, setCountdownRemainingMs] = useState<number | null>(null);
  const delayStartTimeRef = useRef<number | null>(null);
  const activeTagForDelayRef = useRef<number | null>(null);
  const countdownAnimationRef = useRef<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogWaypoint, setDialogWaypoint] = useState<Omit<TrajectoryWaypoint, 'delayOverrideMs'> | null>(null);

  const { toast } = useToast();
  const isProcessingTick = useRef(false);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const functionRefs = useRef<Partial<FunctionRefs>>({});

  // Enhanced robot status using AppContext data
  const enhancedRobotStatus = appRobotStatus || {
    status: 'unknown',
    currentTag: null,
    previousTag: null,
    isOnline: false
  };

  // Use AppContext data to enhance existing functionality
  const enhancedCurrentTag = appCurrentTag || displayedRobotTagId;
  const enhancedPreviousTag = appPreviousTag;
  const enhancedBatteryLevel = appBatteryLevel;
  const enhancedIsConnected = appIsConnected;

  useEffect(() => {
    setDisplayedRobotTagId(currentRobotTagIdRef.current);
  }, []);

  // Sync AppContext data with existing state
  useEffect(() => {
    if (appCurrentTag && appCurrentTag !== displayedRobotTagId) {
      setDisplayedRobotTagId(appCurrentTag);
      currentRobotTagIdRef.current = appCurrentTag;
    }
  }, [appCurrentTag, displayedRobotTagId]);

  // Enhanced Firebase connection status
  useEffect(() => {
    if (!firestoreDB) {
      toast({ title: "Firestore Disabled", description: "Firebase not configured. Live robot data unavailable.", variant: "default", duration: 7000 });
      setIsFirestoreConnected(false);
      return;
    }

    // Use AppContext connection status if available
    if (enhancedIsConnected !== undefined) {
      setIsFirestoreConnected(enhancedIsConnected);
      if (enhancedIsConnected) {
        toast({ title: "Firestore Connected", description: "Receiving live robot data.", variant: "default" });
      }
    } else {
      setIsFirestoreConnected(null);
    }

    const logsCollectionRef = collection(firestoreDB, FIRESTORE_LOGS_COLLECTION);
    const q = query(logsCollectionRef, orderBy("timestamp", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (isFirestoreConnected === null || !isFirestoreConnected) {
         toast({ title: "Firestore Connected", description: "Receiving live robot data.", variant: "default" });
      }
      setIsFirestoreConnected(true);

      if (!querySnapshot.empty) {
        const latestLog = querySnapshot.docs[0].data();
        const robotAtTagId = latestLog.tagId as number;
        const robotTagUid = (latestLog.uid as string) || `FIREBASE_UID_${robotAtTagId}`;
        
        const previousSimulatedTagId = currentRobotTagIdRef.current;
        currentRobotTagIdRef.current = robotAtTagId;
        setDisplayedRobotTagId(robotAtTagId);

        setNfcTags(prev => ({ ...prev, [robotAtTagId]: robotTagUid }));

        if (isSimulating && robotAtTagId !== previousSimulatedTagId && !(activeTagForDelayRef.current === robotAtTagId && countdownRemainingMs !== null)) {
          toast({
            title: "Live Update",
            description: `Robot detected at Tag ${robotAtTagId} (via Firebase). Sim adapting.`,
            variant: "default",
            duration: 4000
          });

          if (delayStartTimeRef.current && activeTagForDelayRef.current !== robotAtTagId) {
            activeTagForDelayRef.current = null;
            delayStartTimeRef.current = null;
            setCountdownRemainingMs(null);
            if (countdownAnimationRef.current) cancelAnimationFrame(countdownAnimationRef.current);
            isProcessingTick.current = false;
          }

          if (robotPhase === 'following_fixed_path' && fixedPathTargetQueue.length > 0 && robotAtTagId === fixedPathTargetQueue[0]) {
            const newQueue = fixedPathTargetQueue.slice(1);
            setFixedPathTargetQueue(newQueue);
            setCurrentPath(newQueue.length > 0 ? [newQueue[0]] : []);
          } else if ((robotPhase === 'going_to_destination' || robotPhase === 'returning_to_start') && currentPath.includes(robotAtTagId)) {
            const newPath = currentPath.slice(currentPath.indexOf(robotAtTagId) + 1);
            setCurrentPath(newPath);
          } else {
             if (robotPhase === 'following_fixed_path' && fixedPathTargetQueue.length > 0) {
              setCurrentPath([fixedPathTargetQueue[0]]);
            } else if (robotPhase === 'going_to_destination' && destinationQueue.length > 0) {
               if (!functionRefs.current.calculateAndSetNewPathForDestination?.(robotAtTagId, destinationQueue[0].tagId)) {}
            } else if (robotPhase === 'returning_to_start') {
                const startTagForPath = functionRefs.current.generateFixedPathOrder?.()?.[0] ?? START_TAG_ID;
                 if (!functionRefs.current.calculateAndSetNewPathForDestination?.(robotAtTagId, startTagForPath)) {}
            }
          }
        }
      } else {
        if (isFirestoreConnected === null) {
           toast({ title: "Firestore Connected", description: "Waiting for initial robot data...", variant: "default" });
        }
      }
    }, (error) => {
      console.error("Error listening to Firestore:", error);
      toast({ title: "Firestore Error", description: "Could not fetch live robot data. Check console.", variant: "destructive" });
      setIsFirestoreConnected(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const _generateFixedPathOrder = useCallback((): number[] => {
    if (currentNfcTagPositions.length === 0) return [];

    const allTagsMap = new Map(currentNfcTagPositions.map(tag => [tag.id, tag]));
    const primaryHardcodedSequenceIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const existingPrimarySequence = primaryHardcodedSequenceIds.filter(id => allTagsMap.has(id));
    const remainingTagIds = currentNfcTagPositions
        .map(tag => tag.id)
        .filter(id => !primaryHardcodedSequenceIds.includes(id))
        .sort((a, b) => a - b);
    let finalPathOrder = [...existingPrimarySequence, ...remainingTagIds];
    
    if (finalPathOrder.length === 0 && currentNfcTagPositions.length > 0) {
        finalPathOrder = [...currentNfcTagPositions].sort((a,b) => a.id - b.id).map(t => t.id);
    }
    
    const startTagInPath = finalPathOrder.find(id => id === START_TAG_ID);

    if (startTagInPath && finalPathOrder[0] !== START_TAG_ID) {
        const startIndex = finalPathOrder.indexOf(startTagInPath);
        const partAfterStart = finalPathOrder.slice(startIndex);
        const partBeforeStart = finalPathOrder.slice(0, startIndex);
        finalPathOrder = [...partAfterStart, ...partBeforeStart];
    }

    return finalPathOrder;
  }, [currentNfcTagPositions]);

  useEffect(() => {
    functionRefs.current.generateFixedPathOrder = _generateFixedPathOrder;
  }, [_generateFixedPathOrder]);


  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_KEY_SPEED) {
          const newSpeedValue = event.newValue;
          if (newSpeedValue) {
              const parsedSpeed = parseFloat(newSpeedValue);
              if (!isNaN(parsedSpeed) && parsedSpeed >= 0 && parsedSpeed <= MAX_SPEED_KMH) {
                  setSpeed(parsedSpeed);
                  toast({ title: "Speed Updated", description: `Robot speed set to ${parsedSpeed.toFixed(1)} km/hr from editor.` });
              }
          }
      }

      if (event.key === LOCAL_STORAGE_KEY_MAP_EDITOR) {
        const newMapData = event.newValue;
        let parsedMapToUse: TagPosition[] = defaultTagPositions;
        let updateToastTitle = "Map Reset";
        let updateToastDesc = "Custom map removed. Reverted to default.";

        if (newMapData) {
          try {
            const parsedMap = JSON.parse(newMapData);
            if (isValidTagPositionArrayForMain(parsedMap) && parsedMap.length > 0) {
              parsedMapToUse = parsedMap;
              updateToastTitle = "Map Updated";
              updateToastDesc = "Map reloaded from external changes.";
            } else {
               updateToastTitle = "Map Update Ignored";
               updateToastDesc = "Invalid map data from external change. Using default.";
            }
          } catch (e) {
             updateToastTitle = "Map Update Error";
             updateToastDesc = "Error processing external map change. Using default.";
          }
        }

        setCurrentNfcTagPositions(parsedMapToUse);
        toast({ title: updateToastTitle, description: `${updateToastDesc} Simulation may need restart.`, duration: 5000 });

        if (isSimulating) {
            setIsSimulating(false);
            setRobotPhase('stopped');
            setCurrentPath([]);
            setMotorPwm(0);
            toast({ title: "Simulation Stopped", description: "Map changed. Please restart simulation.", variant: "default" });
        }
        
        const newPathOrder = functionRefs.current.generateFixedPathOrder?.() ?? [];
        const newInitialRobotTagId = newPathOrder.length > 0 ? newPathOrder[0] : START_TAG_ID;
        currentRobotTagIdRef.current = newInitialRobotTagId;
        setDisplayedRobotTagId(newInitialRobotTagId);
        setNfcTags({ [newInitialRobotTagId]: `UID_SIM_MAP_RELOAD_${newInitialRobotTagId}` });
        
        setDestinationQueue([]);
        setFixedPathTargetQueue([]);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [toast, isSimulating]);


  useEffect(() => {
    if (!isSimulating) { 
        const pathOrder = functionRefs.current.generateFixedPathOrder?.();
        if (pathOrder && pathOrder.length > 0) {
            const newStartTag = pathOrder[0];
            currentRobotTagIdRef.current = newStartTag;
            setDisplayedRobotTagId(newStartTag);
            if (Object.keys(nfcTags).length === 0 || !nfcTags[newStartTag]?.startsWith('UID_SIM_MAP_INIT')) {
                 setNfcTags({ [newStartTag]: `UID_SIM_MAP_INIT/CHANGE_${newStartTag}` });
            }
        } else if (currentNfcTagPositions.length === 0) {
            const defaultStart = currentNfcTagPositions.find(t => t.id === START_TAG_ID)?.id ?? START_TAG_ID;
            currentRobotTagIdRef.current = defaultStart; 
            setDisplayedRobotTagId(defaultStart);
            setNfcTags({});
        }
        setCurrentPath([]);
        setFixedPathTargetQueue([]);
        if (robotPhase !== 'stopped') setRobotPhase('stopped');
        if (motorPwm !== 0) setMotorPwm(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNfcTagPositions, isSimulating]);


  useEffect(() => {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);


  const _updateMotorPwmForMovement = useCallback(() => {
    if (isSimulating && robotPhase !== 'stopped' && robotPhase !== 'at_destination' && robotPhase !== 'idle_at_start' && robotPhase !== 'pathfinding_error' && robotPhase !== 'idle_after_fixed_path') {
      if (currentPath.length > 0) {
        // Convert speed (km/hr) to a PWM percentage (0-100)
        const speedPercentage = Math.min(100, Math.max(0, (speed / MAX_SPEED_KMH) * 100));
        setMotorPwm(Math.round(speedPercentage));
      } else {
        setMotorPwm(0);
      }
    } else {
      setMotorPwm(0);
    }
  }, [isSimulating, robotPhase, speed, currentPath]);

  useEffect(() => {
    functionRefs.current.updateMotorPwmForMovement = _updateMotorPwmForMovement;
    if (functionRefs.current.updateMotorPwmForMovement) {
      functionRefs.current.updateMotorPwmForMovement();
    }
  }, [_updateMotorPwmForMovement]);


  const _calculateAndSetNewPathForDestination = useCallback((startId: number, endId: number) => {
    if (!currentNfcTagPositions.some(t => t.id === startId) || !currentNfcTagPositions.some(t => t.id === endId)) {
        toast({ title: "Path Error", description: `Start Tag ${startId} or End Tag ${endId} not found in map. Halting.`, variant: "destructive"});
        setRobotPhase('pathfinding_error');
        setCurrentPath([]);
        setIsSimulating(false);
        return false;
    }
    const path = findPath(startId, endId, currentNfcTagPositions);
    if (path) {
      setCurrentPath(path.slice(1)); 
      return true;
    } else {
      toast({ title: "Pathfinding Error", description: `Cannot find path from ${startId} to ${endId}. Halting.`, variant: "destructive" });
      setRobotPhase('pathfinding_error');
      setCurrentPath([]);
      setIsSimulating(false);
      return false;
    }
  }, [toast, currentNfcTagPositions]);

  useEffect(() => {
    functionRefs.current.calculateAndSetNewPathForDestination = _calculateAndSetNewPathForDestination;
  }, [_calculateAndSetNewPathForDestination]);


 const _initiateFixedPathSequence = useCallback((isAutoRestart = false) => {
    const fixedOrder = functionRefs.current.generateFixedPathOrder?.();
    if (!fixedOrder || fixedOrder.length === 0) {
        toast({ title: "Fixed Line Path Error", description: "No tags available in map to start fixed path.", variant: "destructive" });
        setRobotPhase('pathfinding_error');
        return;
    }

    const initialTagId = fixedOrder[0];
    currentRobotTagIdRef.current = initialTagId;
    setDisplayedRobotTagId(initialTagId);
    setNfcTags(prev => ({ ...prev, [initialTagId]: `UID_SIM_${isAutoRestart ? 'AUTORESTART_SEQ' : 'FRESH_START_SEQ'}_${initialTagId}` }));

    const targetsForQueue = fixedOrder.slice(1);
    setFixedPathTargetQueue(targetsForQueue);
    setRobotPhase('following_fixed_path');

    const pathPreview = fixedOrder.slice(0, 5).join(' → ') + (fixedOrder.length > 5 ? '...' : '');
    const loopInfo = fixedOrder.length > 1 ? ` (loops to ${fixedOrder[0]})` : ' (single tag)';
    const initialToastMessage = `Following line: ${pathPreview}${loopInfo}`;

    toast({
        title: isAutoRestart ? "Restarting Fixed Line Path" : "Fixed Line Path Initiated",
        description: initialToastMessage,
        duration: 7000
    });

    if (targetsForQueue.length > 0) {
      setCurrentPath([targetsForQueue[0]]);
    } else {
      toast({ title: "Fixed Line Path", description: "Only one tag in map. Robot remains at Tag " + initialTagId + ".", duration: 5000 });
      setRobotPhase('idle_after_fixed_path');
      setCurrentPath([]);
    }
    functionRefs.current.updateMotorPwmForMovement?.();
  }, [toast]);

  useEffect(() => {
    functionRefs.current.initiateFixedPathSequence = _initiateFixedPathSequence;
  }, [_initiateFixedPathSequence]);


  const _handlePathCompletion = useCallback(async () => {
    const currentFixedPathOrder = functionRefs.current.generateFixedPathOrder?.() ?? [];
    const effectiveStartTagId = currentFixedPathOrder.length > 0 ? currentFixedPathOrder[0] : START_TAG_ID;

    if (!currentNfcTagPositions.some(t => t.id === currentRobotTagIdRef.current)) {
        toast({ title: "Critical Error", description: "Robot is at an invalid tag or map changed. Stopping.", variant: "destructive" });
        setRobotPhase('pathfinding_error');
        setIsSimulating(false);
        setCurrentPath([]);
        return;
    }
    setNfcTags(prev => ({ ...prev, [currentRobotTagIdRef.current]: `UID_SIM_PROCESSED_${currentRobotTagIdRef.current}` }));

    if (robotPhase === 'following_fixed_path') {
        if (fixedPathTargetQueue.length > 0) {
            const nextTargetInSequence = fixedPathTargetQueue[0];
            const newQueue = fixedPathTargetQueue.slice(1);
            setFixedPathTargetQueue(newQueue);
            toast({ title: "Following Fixed Line Path", description: `Moving from Tag ${currentRobotTagIdRef.current} to Tag ${nextTargetInSequence}.`});
            setCurrentPath([nextTargetInSequence]);
        } else {
            toast({ title: "Fixed Line Path Cycle Complete", description: `Robot completed a cycle, at Tag ${currentRobotTagIdRef.current}.` });
            if (destinationQueue.length > 0) {
                toast({ title: "Starting Queued Trajectory", description: "Fixed path complete. Now starting custom trajectory."});
                setRobotPhase('going_to_destination');
                if (!functionRefs.current.calculateAndSetNewPathForDestination?.(currentRobotTagIdRef.current, destinationQueue[0].tagId)) return;
            } else if (isContinuousFixedPath && isSimulating) {
                functionRefs.current.initiateFixedPathSequence?.(true);
            } else {
                setRobotPhase('idle_after_fixed_path');
                setCurrentPath([]);
                toast({ title: "Fixed Line Path Ended", description: "Robot idle. Enable continuous mode or restart." });
            }
        }
    } else if (robotPhase === 'going_to_destination') {
        const currentTarget = destinationQueue[0];
        if (currentTarget && currentRobotTagIdRef.current === currentTarget.tagId) {
            const newQueue = destinationQueue.slice(1);
            setDestinationQueue(newQueue);

            if (newQueue.length > 0) {
                toast({ title: "Waypoint Reached", description: `Arrived at Tag ${currentTarget.tagId}. Proceeding to next: Tag ${newQueue[0].tagId}.` });
                if (!functionRefs.current.calculateAndSetNewPathForDestination?.(currentRobotTagIdRef.current, newQueue[0].tagId)) return;
            } else {
                toast({ title: "Trajectory Complete!", description: `Final destination Tag ${currentTarget.tagId} reached. Returning to start.` });
                setRobotPhase('returning_to_start');
                if (!functionRefs.current.calculateAndSetNewPathForDestination?.(currentRobotTagIdRef.current, effectiveStartTagId)) return;
            }
        } else if (destinationQueue.length > 0) { // Continue to current target
            if (!functionRefs.current.calculateAndSetNewPathForDestination?.(currentRobotTagIdRef.current, destinationQueue[0].tagId)) return;
        } else { // Queue became empty somehow
            setRobotPhase('returning_to_start');
            if (!functionRefs.current.calculateAndSetNewPathForDestination?.(currentRobotTagIdRef.current, effectiveStartTagId)) return;
        }
    } else if (robotPhase === 'returning_to_start') {
      if (currentRobotTagIdRef.current === effectiveStartTagId) {
        toast({ title: "Returned to Start", description: `Robot back at Start (Tag ${effectiveStartTagId}).` });
        setRobotPhase('idle_at_start');
        setCurrentPath([]);
      } else {
        if (!functionRefs.current.calculateAndSetNewPathForDestination?.(currentRobotTagIdRef.current, effectiveStartTagId)) return;
      }
    }
    functionRefs.current.updateMotorPwmForMovement?.();
  }, [robotPhase, toast, isContinuousFixedPath, isSimulating, currentNfcTagPositions, fixedPathTargetQueue, destinationQueue]);

  useEffect(() => {
    functionRefs.current.handlePathCompletion = _handlePathCompletion;
  }, [_handlePathCompletion]);


  const _simulationTick = useCallback(async () => {
    if (isProcessingTick.current) return;

    if (!isSimulating || robotPhase === 'stopped' || robotPhase === 'at_destination' || robotPhase === 'idle_at_start' || robotPhase === 'pathfinding_error' || robotPhase === 'idle_after_fixed_path') {
      if (motorPwm !== 0) setMotorPwm(0);
      activeTagForDelayRef.current = null;
      delayStartTimeRef.current = null;
      setCountdownRemainingMs(null);
       if (robotPhase !== 'going_to_destination' && robotPhase !== 'returning_to_start') { 
        setCurrentPath([]);
      }
      return;
    }

    isProcessingTick.current = true;
    try {
      if (currentPath.length > 0) {
        const nextTagId = currentPath[0];

        if (!currentNfcTagPositions.some(t => t.id === nextTagId)) {
            toast({ title: "Path Invalidated", description: `Next tag ${nextTagId} in path not found in current map. Stopping.`, variant: "destructive" });
            setRobotPhase('pathfinding_error');
            setIsSimulating(false);
            setMotorPwm(0);
            setCurrentPath([]);
            isProcessingTick.current = false;
            return;
        }

        currentRobotTagIdRef.current = nextTagId;
        setDisplayedRobotTagId(nextTagId);
        setNfcTags(prev => ({ ...prev, [nextTagId]: `UID_SIM_VISIT_${nextTagId}_${Date.now()}` }));
        setMotorPwm(0);

        let delayDuration = globalTagVisitDelayMs;
        if (robotPhase === 'going_to_destination') {
            const waypoint = destinationQueue.find(wp => wp.tagId === nextTagId);
            if (waypoint?.delayOverrideMs && waypoint.delayOverrideMs > 0) {
                delayDuration = waypoint.delayOverrideMs;
            }
        }
        
        if (delayDuration > 0) {
          delayStartTimeRef.current = Date.now();
          activeTagForDelayRef.current = nextTagId;
          setCountdownRemainingMs(delayDuration);
          await new Promise(resolve => setTimeout(resolve, delayDuration));
        }

        if (activeTagForDelayRef.current !== nextTagId || !isSimulating) {
           isProcessingTick.current = false;
           return;
        }
        
        activeTagForDelayRef.current = null;
        delayStartTimeRef.current = null;
        setCountdownRemainingMs(null);
        
        if (robotPhase === 'following_fixed_path') {
            setCurrentPath([]);
        } else {
            setCurrentPath(prev => prev.slice(1));
        }
        await functionRefs.current.handlePathCompletion?.();
        
      } else {
         if (robotPhase !== 'stopped' && robotPhase !== 'at_destination' && robotPhase !== 'idle_at_start' && robotPhase !== 'pathfinding_error' && robotPhase !== 'idle_after_fixed_path') {
            await functionRefs.current.handlePathCompletion?.();
         }
      }
    } catch (error) {
      console.error("Error in simulation tick:", error);
      toast({ title: "Simulation Error", description: "An error occurred in the simulation.", variant: "destructive" });
      setRobotPhase('pathfinding_error');
      setIsSimulating(false);
      setMotorPwm(0);
      setCurrentPath([]);
    } finally {
      if (activeTagForDelayRef.current === null || !delayStartTimeRef.current) {
          isProcessingTick.current = false;
      }
    }
  }, [isSimulating, robotPhase, currentPath, globalTagVisitDelayMs, toast, motorPwm, currentNfcTagPositions, destinationQueue]);

  useEffect(() => {
    functionRefs.current.simulationTick = _simulationTick;
  }, [_simulationTick]);

  useEffect(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    if (isSimulating && robotPhase !== 'stopped' && robotPhase !== 'at_destination' && robotPhase !== 'idle_at_start' && robotPhase !== 'pathfinding_error' && robotPhase !== 'idle_after_fixed_path') {
      functionRefs.current.updateMotorPwmForMovement?.();

      let effectiveDelay = globalTagVisitDelayMs;
      if (robotPhase === 'going_to_destination' && destinationQueue.length > 0) {
        const waypoint = destinationQueue.find(wp => wp.tagId === currentRobotTagIdRef.current);
        if (waypoint?.delayOverrideMs && waypoint.delayOverrideMs > 0) {
          effectiveDelay = waypoint.delayOverrideMs;
        }
      }
      
      const speedPercentage = Math.max(0.01, speed / MAX_SPEED_KMH); // Ensure it's not zero
      const dynamicInterval = MAX_SIMULATION_INTERVAL_MS - (speedPercentage * (MAX_SIMULATION_INTERVAL_MS - MIN_SIMULATION_INTERVAL_MS));

      if (!isProcessingTick.current && currentPath.length > 0 ) {
         functionRefs.current.simulationTick?.();
      }

      simulationIntervalRef.current = setInterval(() => {
        if (!isProcessingTick.current && !(delayStartTimeRef.current && activeTagForDelayRef.current === currentRobotTagIdRef.current) ) {
            functionRefs.current.simulationTick?.();
        }
      }, dynamicInterval + effectiveDelay); 
    } else {
       functionRefs.current.updateMotorPwmForMovement?.(); 
    }
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      if (!isSimulating || robotPhase === 'stopped' || robotPhase === 'at_destination' || robotPhase === 'idle_at_start' || robotPhase === 'pathfinding_error' || robotPhase === 'idle_after_fixed_path'){
        activeTagForDelayRef.current = null;
        delayStartTimeRef.current = null;
        setCountdownRemainingMs(null);
        if (countdownAnimationRef.current) {
          cancelAnimationFrame(countdownAnimationRef.current);
          countdownAnimationRef.current = null;
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSimulating, robotPhase, speed, globalTagVisitDelayMs, currentPath.length, destinationQueue]); 


 useEffect(() => {
    const updateCountdown = () => {
      if (delayStartTimeRef.current && activeTagForDelayRef.current === currentRobotTagIdRef.current && isSimulating && robotPhase !== 'stopped' && robotPhase !== 'at_destination' && robotPhase !== 'idle_at_start' && robotPhase !== 'pathfinding_error' && robotPhase !== 'idle_after_fixed_path' && countdownRemainingMs !== null) {
        let currentDelay = globalTagVisitDelayMs;
        if(robotPhase === 'going_to_destination'){
            const waypoint = destinationQueue.find(wp => wp.tagId === activeTagForDelayRef.current);
            if(waypoint?.delayOverrideMs){
                currentDelay = waypoint.delayOverrideMs;
            }
        }
        const elapsed = Date.now() - delayStartTimeRef.current;
        const remaining = currentDelay - elapsed;
        setCountdownRemainingMs(remaining > 0 ? remaining : 0);
        if (remaining > 0) {
          countdownAnimationRef.current = requestAnimationFrame(updateCountdown);
        } else {
          setCountdownRemainingMs(null); 
        }
      } else {
        if(countdownRemainingMs !== null) setCountdownRemainingMs(null);
      }
    };

    if (delayStartTimeRef.current && activeTagForDelayRef.current === currentRobotTagIdRef.current && countdownRemainingMs !== null && countdownRemainingMs > 0) {
      countdownAnimationRef.current = requestAnimationFrame(updateCountdown);
    } else {
        if (countdownRemainingMs !== null) setCountdownRemainingMs(null); 
    }

    return () => {
      if (countdownAnimationRef.current) {
        cancelAnimationFrame(countdownAnimationRef.current);
        countdownAnimationRef.current = null;
      }
    };
  }, [globalTagVisitDelayMs, isSimulating, robotPhase, countdownRemainingMs, destinationQueue]); 

const toggleSimulation = () => {
    setIsSimulating(prevIsSimulating => {
      const newIsSimulating = !prevIsSimulating;

      if (newIsSimulating) {
        if (robotPhase === 'stopped' || robotPhase === 'pathfinding_error' || robotPhase === 'idle_at_start' || robotPhase === 'at_destination' || robotPhase === 'idle_after_fixed_path') {
          const fixedPathOrder = functionRefs.current.generateFixedPathOrder?.();
          if (!fixedPathOrder || fixedPathOrder.length === 0) {
            toast({ title: "Cannot Start", description: `No tags defined in current map. Configure map in editor.`, variant: "destructive" });
            return false;
          }
          if (destinationQueue.length > 0) {
            toast({ title: "Starting Fixed Path First", description: `Trajectory is queued and will begin after the fixed path cycle is complete.` });
          }
          functionRefs.current.initiateFixedPathSequence?.(false);
        }
      } else {
        const currentPhaseBeforeStop = robotPhase;
        setRobotPhase('stopped');
        setMotorPwm(0);
        toast({ title: "Simulation Paused", description: `Robot paused during ${currentPhaseBeforeStop.replace(/_/g, ' ')}.` });
        activeTagForDelayRef.current = null;
        delayStartTimeRef.current = null;
        setCountdownRemainingMs(null);
        if (countdownAnimationRef.current) {
          cancelAnimationFrame(countdownAnimationRef.current);
          countdownAnimationRef.current = null;
        }
        isProcessingTick.current = false;
      }
      return newIsSimulating;
    });
  };

  const handleRestartFixedPath = () => {
    const fixedPathOrder = functionRefs.current.generateFixedPathOrder?.();
     if (!fixedPathOrder || fixedPathOrder.length === 0) {
        toast({ title: "Cannot Restart", description: `No tags defined in current map. Configure map in editor.`, variant: "destructive" });
        return;
    }
    
    // Always clear custom trajectory when explicitly restarting fixed path
    if (destinationQueue.length > 0) {
        setDestinationQueue([]);
        toast({ title: "Fixed Line Path Restarted", description: "Queued trajectory has been cleared.", variant: "default"});
    }
    
    setIsSimulating(true);
    functionRefs.current.initiateFixedPathSequence?.(false);
  };


  const handleDelayChange = useCallback((newDelay: number) => {
    setGlobalTagVisitDelayMs(Math.max(0, newDelay));
  }, []);

  const handleAddWaypoint = useCallback((waypoint: TrajectoryWaypoint) => {
    if (!currentNfcTagPositions.some(t => t.id === waypoint.tagId)) {
        toast({ title: "Invalid Waypoint", description: `Tag ${waypoint.tagId} does not exist in the current map.`, variant: "destructive"});
        return;
    }
    
    const isFirstWaypointAdded = destinationQueue.length === 0;
    setDestinationQueue(prev => [...prev, waypoint]);
    
    const delayInfo = waypoint.delayOverrideMs ? `with a custom delay of ${waypoint.delayOverrideMs}ms.` : `with the default delay.`;
    const baseToastDesc = `Added Tag ${waypoint.tagId} to trajectory ${delayInfo}`;

    if (isSimulating && (robotPhase === 'following_fixed_path' || robotPhase === 'idle_at_start' || robotPhase === 'idle_after_fixed_path' || robotPhase === 'stopped') && isFirstWaypointAdded) {
        toast({ title: "Trajectory Updated", description: `${baseToastDesc} It will run after the current fixed path cycle.` });
    } else {
        toast({ title: "Trajectory Updated", description: baseToastDesc });
    }
  }, [currentNfcTagPositions, toast, isSimulating, robotPhase, destinationQueue.length]);

  const handleSetSingleDestination = useCallback((waypoint: TrajectoryWaypoint) => {
    if (!currentNfcTagPositions.some(t => t.id === waypoint.tagId)) {
        toast({ title: "Invalid Destination", description: `Tag ${waypoint.tagId} does not exist in the current map.`, variant: "destructive"});
        return;
    }
    
    setDestinationQueue([waypoint]);

    if (isSimulating) {
        toast({ 
            title: "Route Override", 
            description: `Finding shortest path from current position (Tag ${currentRobotTagIdRef.current}) to destination: Tag ${waypoint.tagId}.`
        });
        setRobotPhase('going_to_destination');
        functionRefs.current.calculateAndSetNewPathForDestination?.(currentRobotTagIdRef.current, waypoint.tagId);
        functionRefs.current.updateMotorPwmForMovement?.();
    } else {
      const baseToastDesc = `New destination set to Tag ${waypoint.tagId}.`;
      toast({ title: "Destination Set", description: `${baseToastDesc} It will run after the initial fixed path cycle when simulation starts.` });
    }
  }, [currentNfcTagPositions, toast, isSimulating]);

  const handleClearTrajectory = useCallback(() => {
    if (destinationQueue.length === 0) return;
    setDestinationQueue([]);
    toast({ title: "Trajectory Cleared" });
    if (isSimulating && robotPhase === 'going_to_destination') {
        setRobotPhase('returning_to_start');
        toast({ title: "Returning to Start", description: "Custom trajectory was cleared." });
        const startTagId = functionRefs.current.generateFixedPathOrder?.()?.[0] ?? START_TAG_ID;
        functionRefs.current.calculateAndSetNewPathForDestination?.(currentRobotTagIdRef.current, startTagId);
        functionRefs.current.updateMotorPwmForMovement?.();
    }
  }, [destinationQueue.length, isSimulating, robotPhase, toast]);
  
  const routeStartTagDisplay = functionRefs.current.generateFixedPathOrder?.()?.[0] ?? displayedRobotTagId ?? START_TAG_ID;
  
  let firestoreStatusText = "Connecting...";
  if (isFirestoreConnected === true) {
    firestoreStatusText = "Connected";
  } else if (isFirestoreConnected === false) {
    firestoreStatusText = "Disconnected";
  }

  const immediateTargetId = robotPhase === 'going_to_destination' && destinationQueue.length > 0 ? destinationQueue[0].tagId : null;

  // Enhanced control functions using AppContext
  const handleAppContextStartExploration = async () => {
    try {
      await startExploration();
      toast({ 
        title: "Exploration Started", 
        description: "Robot is now exploring the track and discovering NFC tags.",
        variant: "default"
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to start exploration.", 
        variant: "destructive" 
      });
    }
  };

  const handleAppContextStop = async () => {
    try {
      await stopRobot();
      toast({ 
        title: "Robot Stopped", 
        description: "Robot has been stopped.",
        variant: "default"
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to stop robot.", 
        variant: "destructive" 
      });
    }
  };

  const handleAppContextEmergencyStop = async () => {
    try {
      await emergencyStop();
      toast({ 
        title: "Emergency Stop", 
        description: "Robot has been emergency stopped.",
        variant: "destructive"
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to emergency stop robot.", 
        variant: "destructive" 
      });
    }
  };

  const handleAppContextReturnHome = async () => {
    try {
      await returnHome();
      toast({ 
        title: "Returning Home", 
        description: "Robot is returning to docking station.",
        variant: "default"
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to return home.", 
        variant: "destructive" 
      });
    }
  };

  const handleAppContextGoToTag = async (tagId: number) => {
    try {
      await goToTag(tagId);
      toast({ 
        title: "Navigation Started", 
        description: `Robot navigating to tag ${tagId}.` 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to start navigation.", 
        variant: "destructive" 
      });
    }
  };

  const handleAppContextSpeedChange = async (newSpeed: number) => {
    try {
      // Convert km/hr to robot's expected format (0-10 range)
      const robotSpeed = Math.max(0, Math.min(10, newSpeed));
      await appSetSpeed(robotSpeed);
      setSpeed(robotSpeed);
      toast({ 
        title: "Speed Updated", 
        description: `Robot speed set to ${robotSpeed.toFixed(1)} km/hr.` 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to update speed.", 
        variant: "destructive" 
      });
    }
  };

  const handleAppContextDelayChange = async (newDelay: number) => {
    try {
      // Convert milliseconds to seconds for AppContext
      const delaySeconds = newDelay / 1000;
      await appSetDelay(delaySeconds);
      setGlobalTagVisitDelayMs(newDelay);
      toast({ 
        title: "Delay Updated", 
        description: `Robot delay set to ${newDelay}ms.` 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to update delay.", 
        variant: "destructive" 
      });
    }
  };

  const handleAppContextFollowPath = async (waypoints: number[]) => {
    try {
      await appFollowPath(waypoints);
      toast({ 
        title: "Path Following Started", 
        description: `Robot following path with ${waypoints.length} waypoints.` 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to start path following.", 
        variant: "destructive" 
      });
    }
  };

  // Enhanced status display using AppContext data
  const displayRobotStatus = enhancedRobotStatus.status || 'unknown';
  const displayCurrentTag = enhancedCurrentTag || displayedRobotTagId;
  const displayPreviousTag = enhancedPreviousTag;
  const displayBatteryLevel = enhancedBatteryLevel;
  const displayIsConnected = enhancedIsConnected !== undefined ? enhancedIsConnected : isFirestoreConnected;

  return (
    <>
    <WaypointDelayDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        waypoint={dialogWaypoint}
        onConfirm={(delayMs) => {
            if (dialogWaypoint) {
                handleAddWaypoint({ tagId: dialogWaypoint.tagId, delayOverrideMs: delayMs > 0 ? delayMs : undefined });
            }
        }}
        allTags={currentNfcTagPositions}
    />
    <div className="flex flex-col min-h-screen">
      <header className="bg-card border-b border-border p-4 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary font-headline">LineFollowerPi Control</h1>
          <div className="flex items-center space-x-2 md:space-x-4">
            {isFirestoreConnected !== null && (
                <div className="flex items-center space-x-1" title={isFirestoreConnected ? "Firebase Connected" : (isFirestoreConnected === false ? "Firebase Connection Failed/Disabled" : "Firebase Connecting...")}>
                    {isFirestoreConnected === true && <Wifi className="h-5 w-5 text-green-500" />}
                    {isFirestoreConnected === false && <WifiOff className="h-5 w-5 text-red-500" />}
                    {isFirestoreConnected === null && <WifiOff className="h-5 w-5 text-yellow-500 animate-pulse" />}
                    <span className="text-xs text-muted-foreground hidden sm:inline">{firestoreStatusText}</span>
                </div>
            )}
             <Button variant="outline" size="icon" asChild title="Edit Map">
                <Link href="/map-editor"><Settings className="h-5 w-5" /></Link>
            </Button>
            <div className="flex items-center space-x-2">
                <Switch
                    id="continuous-fixed-path-toggle"
                    checked={isContinuousFixedPath}
                    onCheckedChange={(checked) => {
                        setIsContinuousFixedPath(checked);
                        if (checked && isSimulating && robotPhase === 'idle_after_fixed_path' && destinationQueue.length === 0) {
                           functionRefs.current.initiateFixedPathSequence?.(true);
                        }
                    }}
                    aria-label="Toggle continuous fixed path mode"
                />
                <Label htmlFor="continuous-fixed-path-toggle" className="text-sm hidden md:block">Continuous Path</Label>
            </div>
            <Button variant="outline" size="icon" onClick={toggleDarkMode} aria-label="Toggle dark mode">
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestartFixedPath}
              title="Restart Fixed Path Sequence (clears any custom trajectory)"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> <span className="hidden md:inline">Restart Path</span>
            </Button>
            <Button
              variant={(isSimulating && robotPhase !== 'stopped') ? "destructive" : "default"}
              size="sm"
              onClick={toggleSimulation}
              title={isSimulating && robotPhase !== 'stopped' ? "Pause Simulation" : "Start/Resume Simulation"}
            >
              {isSimulating && robotPhase !== 'stopped' ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              <span className="hidden md:inline">
                {isSimulating && robotPhase !== 'stopped' ? "Pause Sim" : ( (robotPhase === 'stopped' && !isSimulating && currentPath.length === 0 && fixedPathTargetQueue.length === 0 && destinationQueue.length === 0) || robotPhase === 'pathfinding_error' || robotPhase === 'idle_after_fixed_path' || robotPhase === 'at_destination' || robotPhase === 'idle_at_start' ? "Start Sim" : "Resume Sim")}
              </span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <RobotControlCard 
              robotId="line_follower_robot_001"
              currentStatus={robotPhase}
              isConnected={displayIsConnected === true}
            />
            <DelayControlCard 
              initialDelay={globalTagVisitDelayMs} 
              onDelayChange={handleDelayChange}
            />
            <DestinationSelectorCard
              onSetSingleDestination={handleSetSingleDestination}
              allTagPositions={currentNfcTagPositions}
              currentRobotTagId={displayCurrentTag}
            />
            <TrajectoryLogCard
              destinationQueue={destinationQueue}
              onClear={handleClearTrajectory}
              allTags={currentNfcTagPositions}
              currentTargetId={immediateTargetId}
              globalDelayMs={globalTagVisitDelayMs}
            />
            <NfcTagMonitorCard 
              detectedNfcTags={nfcTags} 
              currentRobotTagId={displayCurrentTag}
            />
            <MotorPwmDisplayCard 
              motorPwm={motorPwm}
            />
            {/* Battery & Camera Feed Card */}
            <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">Robot Battery & Camera</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {/* Battery Level */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Battery Level</span>
                            <span className="text-sm font-mono">
                                {displayBatteryLevel?.toFixed(1) || 'Unknown'}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                                className={`h-2.5 rounded-full transition-all duration-300 ${
                                    displayBatteryLevel 
                                        ? displayBatteryLevel > 50 
                                            ? 'bg-green-500' 
                                            : displayBatteryLevel > 20 
                                                ? 'bg-yellow-500' 
                                                : 'bg-red-500'
                                        : 'bg-gray-400'
                                }`}
                                style={{ width: `${displayBatteryLevel || 0}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                    </div>

                    {/* Camera Feed Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Camera className="h-5 w-5" />
                          Camera Feeds
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Primary Camera */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Primary</span>
                              <Badge variant={appCameraStatus?.primary_available ? "default" : "secondary"} className="text-xs">
                                {appCameraStatus?.primary_available ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                              {appPrimaryCameraFrame ? (
                                <img 
                                  src={appPrimaryCameraFrame.imageUrl} 
                                  alt="Primary camera feed"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${appPrimaryCameraFrame ? 'hidden' : ''}`}>
                                <p className="text-muted-foreground text-sm">No primary feed</p>
                              </div>
                            </div>
                          </div>

                          {/* Secondary Camera */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Secondary</span>
                              <Badge variant={appCameraStatus?.secondary_available ? "default" : "secondary"} className="text-xs">
                                {appCameraStatus?.secondary_available ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                              {appSecondaryCameraFrame ? (
                                <img 
                                  src={appSecondaryCameraFrame.imageUrl} 
                                  alt="Secondary camera feed"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${appSecondaryCameraFrame ? 'hidden' : ''}`}>
                                <p className="text-muted-foreground text-sm">No secondary feed</p>
                              </div>
                            </div>
                          </div>

                          {/* Camera Status */}
                          {appCameraStatus && (
                            <div className="text-xs text-muted-foreground pt-2 border-t">
                              <p>Resolution: {appCameraStatus.frame_width}x{appCameraStatus.frame_height}</p>
                              <p>FPS: {appCameraStatus.fps}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Connection Status */}
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            {displayIsConnected ? (
                                <Wifi className="h-3 w-3 text-green-500" />
                            ) : (
                                <WifiOff className="h-3 w-3 text-red-500" />
                            )}
                            <span>Robot Connection: {displayIsConnected ? 'Connected' : 'Disconnected'}</span>
                        </div>
                        {appIsLoading && (
                            <div className="flex items-center gap-1">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                <span>Loading...</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            {/* Enhanced AppContext Integration Card */}
            <Card>
                <CardHeader><CardTitle className="text-base">Enhanced Robot Control</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {/* AppContext Status Display */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium">AppContext Status:</p>
                        <div className="text-xs space-y-1">
                            <p>Status: <span className="font-mono">{displayRobotStatus}</span></p>
                            <p>Current Tag: <span className="font-mono">{displayCurrentTag}</span></p>
                            <p>Previous Tag: <span className="font-mono">{displayPreviousTag || 'None'}</span></p>
                            <p>Battery: <span className="font-mono">{displayBatteryLevel?.toFixed(1) || 'Unknown'}%</span></p>
                            <p>Discovered Tags: <span className="font-mono">{appDiscoveredTags.length}</span></p>
                        </div>
                    </div>
                    
                    {/* Enhanced Control Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button 
                            size="sm" 
                            onClick={handleAppContextStartExploration}
                            disabled={!displayIsConnected}
                            className="text-xs"
                        >
                            Start Exploration
                        </Button>
                        <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={handleAppContextStop}
                            disabled={!displayIsConnected}
                            className="text-xs"
                        >
                            Stop
                        </Button>
                        <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={handleAppContextEmergencyStop}
                            disabled={!displayIsConnected}
                            className="text-xs"
                        >
                            Emergency Stop
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleAppContextReturnHome}
                            disabled={!displayIsConnected}
                            className="text-xs"
                        >
                            Return Home
                        </Button>
                    </div>

                    {/* Enhanced Speed Control */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span>Enhanced Speed: {(speed / MAX_SPEED_KMH).toFixed(2)}</span>
                            <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleAppContextSpeedChange(speed / MAX_SPEED_KMH)}
                                disabled={!displayIsConnected}
                                className="h-6 px-2 text-xs"
                            >
                                Sync
                            </Button>
                        </div>
                    </div>

                    {/* Enhanced Delay Control */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span>Enhanced Delay: {globalTagVisitDelayMs}ms</span>
                            <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleAppContextDelayChange(globalTagVisitDelayMs)}
                                disabled={!displayIsConnected}
                                className="h-6 px-2 text-xs"
                            >
                                Sync
                            </Button>
                        </div>
                    </div>

                    {/* AppContext Connection Status */}
                    <div className="flex items-center gap-2 text-xs">
                        {displayIsConnected ? (
                            <Wifi className="h-3 w-3 text-green-500" />
                        ) : (
                            <WifiOff className="h-3 w-3 text-red-500" />
                        )}
                        <span>AppContext: {displayIsConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="text-base">Current Phase</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-sm capitalize mb-1">{robotPhase.replace(/_/g, ' ')}</p>
                    {/* Enhanced status display */}
                    {displayRobotStatus && displayRobotStatus !== 'unknown' && (
                      <p className="text-xs text-muted-foreground mb-1">
                        App Status: {displayRobotStatus}
                      </p>
                    )}
                    {countdownRemainingMs !== null && countdownRemainingMs > 0 && activeTagForDelayRef.current !== null && (
                        <div className="text-xs text-accent-foreground mt-2 p-2 bg-accent/20 rounded-md">
                            <p>Waiting at Tag {activeTagForDelayRef.current}:</p>
                            <p className="font-mono text-lg">{formatMillisecondsToTime(countdownRemainingMs)}</p>
                        </div>
                    )}
                     {robotPhase === 'following_fixed_path' && fixedPathTargetQueue.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">Next in fixed path: Tag {fixedPathTargetQueue[0]}</p>
                    )}
                    {(robotPhase === 'going_to_destination' || robotPhase === 'returning_to_start') && currentPath.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">Next via path: Tag {currentPath[0]}</p>
                    )}
                </CardContent>
            </Card>
          </div>

          <div className="flex-grow h-[65vh] min-h-[500px]">
            <MapDisplay
              detectedNfcTags={nfcTags}
              destinationQueue={destinationQueue}
              currentRobotTagId={displayCurrentTag}
              routeSourceTagId={routeStartTagDisplay}
              currentPath={currentPath} 
              allTags={currentNfcTagPositions}
              onAddWaypoint={handleAddWaypoint}
              onAddWaypointWithDelay={(tagId) => {
                  setDialogWaypoint({ tagId });
                  setDialogOpen(true);
              }}
              onSetSingleDestination={handleSetSingleDestination}
            />
          </div>
        </div>
      </main>
      <footer className="bg-card border-t border-border p-4 text-center text-sm text-muted-foreground">
        LineFollowerPi Control System © {new Date().getFullYear()}
      </footer>
    </div>
    </>
  );
}
