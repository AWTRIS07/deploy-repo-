"use client";

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Play, 
  Pause, 
  Square, 
  AlertTriangle, 
  Home, 
  Navigation, 
  Send,
  Wifi,
  WifiOff,
  Bot,
  Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface RobotControlCardProps {
  robotId?: string;
  currentStatus?: string;
  isConnected?: boolean;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let firebaseApp: any = null;
let firestoreDB: any = null;

try {
  if (firebaseConfig.projectId && firebaseConfig.apiKey) {
    firebaseApp = initializeApp(firebaseConfig);
    firestoreDB = getFirestore(firebaseApp);
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

export function RobotControlCard({ 
  robotId = "line_follower_robot_001", 
  currentStatus = "unknown",
  isConnected = false 
}: RobotControlCardProps) {
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>("");
  const { toast } = useToast();

  const sendCommand = useCallback(async (command: string, additionalData: any = {}) => {
    if (!firestoreDB) {
      toast({ 
        title: "Firebase Error", 
        description: "Firebase not configured. Cannot send commands.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSendingCommand(true);
    setLastCommand(command);

    try {
      const commandData = {
        robotId: robotId,
        command: command,
        timestamp: serverTimestamp(),
        status: 'pending',
        ...additionalData
      };

      await addDoc(collection(firestoreDB, 'robot_commands'), commandData);
      
      toast({ 
        title: "Command Sent", 
        description: `Successfully sent ${command} command to robot.`,
        variant: "default"
      });

      console.log(`📡 Sent command: ${command}`, commandData);
    } catch (error) {
      console.error("Failed to send command:", error);
      toast({ 
        title: "Command Failed", 
        description: `Failed to send ${command} command. Please try again.`, 
        variant: "destructive" 
      });
    } finally {
      setIsSendingCommand(false);
    }
  }, [robotId, toast]);

  const sendTrajectoryCommand = useCallback(async (waypoints: any[]) => {
    if (!firestoreDB) {
      toast({ 
        title: "Firebase Error", 
        description: "Firebase not configured. Cannot send trajectory.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSendingCommand(true);
    setLastCommand("SET_TRAJECTORY");

    try {
      const trajectoryData = {
        robotId: robotId,
        waypoints: waypoints,
        timestamp: serverTimestamp(),
        status: 'pending'
      };

      await addDoc(collection(firestoreDB, 'robot_trajectories'), trajectoryData);
      
      toast({ 
        title: "Trajectory Sent", 
        description: `Successfully sent trajectory with ${waypoints.length} waypoints to robot.`,
        variant: "default"
      });

      console.log(`🗺️ Sent trajectory:`, trajectoryData);
    } catch (error) {
      console.error("Failed to send trajectory:", error);
      toast({ 
        title: "Trajectory Failed", 
        description: "Failed to send trajectory. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSendingCommand(false);
    }
  }, [robotId, toast]);

  const sendSpeedSettings = useCallback(async (speed: number, baseSpeed: number, turnGain: number) => {
    if (!firestoreDB) {
      toast({ 
        title: "Firebase Error", 
        description: "Firebase not configured. Cannot send speed settings.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSendingCommand(true);
    setLastCommand("SET_SPEED");

    try {
      const speedData = {
        robotId: robotId,
        speed: speed,
        base_speed: baseSpeed,
        turn_gain: turnGain,
        timestamp: serverTimestamp(),
        status: 'pending'
      };

      await addDoc(collection(firestoreDB, 'robot_settings'), speedData);
      
      toast({ 
        title: "Speed Settings Sent", 
        description: `Speed settings updated: ${speed} km/hr`,
        variant: "default"
      });

      console.log(`⚡ Sent speed settings:`, speedData);
    } catch (error) {
      console.error("Failed to send speed settings:", error);
      toast({ 
        title: "Speed Settings Failed", 
        description: "Failed to send speed settings. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSendingCommand(false);
    }
  }, [robotId, toast]);

  const sendDelaySettings = useCallback(async (globalDelayMs: number, tagDelays: Record<number, number> = {}) => {
    if (!firestoreDB) {
      toast({ 
        title: "Firebase Error", 
        description: "Firebase not configured. Cannot send delay settings.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSendingCommand(true);
    setLastCommand("SET_DELAY");

    try {
      const delayData = {
        robotId: robotId,
        global_delay_ms: globalDelayMs,
        tag_delays: tagDelays,
        timestamp: serverTimestamp(),
        status: 'pending'
      };

      await addDoc(collection(firestoreDB, 'robot_delays'), delayData);
      
      toast({ 
        title: "Delay Settings Sent", 
        description: `Global delay updated: ${globalDelayMs}ms`,
        variant: "default"
      });

      console.log(`⏱️ Sent delay settings:`, delayData);
    } catch (error) {
      console.error("Failed to send delay settings:", error);
      toast({ 
        title: "Delay Settings Failed", 
        description: "Failed to send delay settings. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSendingCommand(false);
    }
  }, [robotId, toast]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'following_trajectory':
      case 'navigating':
        return 'bg-green-500';
      case 'stopped':
      case 'idle':
        return 'bg-yellow-500';
      case 'emergency_stop':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg font-semibold">
          <Bot className="mr-3 h-6 w-6 text-primary" />
          Robot Control
          <Badge 
            variant="outline" 
            className={`ml-2 ${getStatusColor(currentStatus)} text-white`}
          >
            {currentStatus.replace('_', ' ')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm text-muted-foreground">
            {isConnected ? "Robot Connected" : "Robot Disconnected"}
          </span>
        </div>

        {/* Basic Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => sendCommand('START')}
            disabled={isSendingCommand || !isConnected}
            className="bg-green-600 hover:bg-green-700"
          >
            <Play className="mr-2 h-4 w-4" />
            Start
          </Button>
          
          <Button
            onClick={() => sendCommand('STOP')}
            disabled={isSendingCommand || !isConnected}
            variant="outline"
          >
            <Pause className="mr-2 h-4 w-4" />
            Stop
          </Button>
        </div>

        {/* Emergency Controls */}
        <div className="space-y-2">
          <Button
            onClick={() => sendCommand('EMERGENCY_STOP')}
            disabled={isSendingCommand || !isConnected}
            variant="destructive"
            className="w-full"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Emergency Stop
          </Button>
        </div>

        {/* Navigation Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => sendCommand('RETURN_TO_START')}
            disabled={isSendingCommand || !isConnected}
            variant="outline"
          >
            <Home className="mr-2 h-4 w-4" />
            Return Home
          </Button>
          
          <Button
            onClick={() => sendCommand('GO_TO_TAG', { targetTag: 5 })}
            disabled={isSendingCommand || !isConnected}
            variant="outline"
          >
            <Target className="mr-2 h-4 w-4" />
            Go to Tag 5
          </Button>
        </div>

        {/* Trajectory Control */}
        <div className="space-y-2">
          <Button
            onClick={() => sendTrajectoryCommand([
              { tagId: 1, delayOverrideMs: 1000 },
              { tagId: 5, delayOverrideMs: 2000 },
              { tagId: 10, delayOverrideMs: 1500 },
              { tagId: 1, delayOverrideMs: 500 }
            ])}
            disabled={isSendingCommand || !isConnected}
            className="w-full"
          >
            <Navigation className="mr-2 h-4 w-4" />
            Send Test Trajectory
          </Button>
        </div>

        {/* Settings Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => sendSpeedSettings(3.0, 0.4, 0.06)}
            disabled={isSendingCommand || !isConnected}
            variant="outline"
            size="sm"
          >
            <Send className="mr-2 h-3 w-3" />
            Speed: 3.0 km/hr
          </Button>
          
          <Button
            onClick={() => sendDelaySettings(1000)}
            disabled={isSendingCommand || !isConnected}
            variant="outline"
            size="sm"
          >
            <Send className="mr-2 h-3 w-3" />
            Delay: 1s
          </Button>
        </div>

        {/* Status Information */}
        {lastCommand && (
          <Alert>
            <AlertDescription>
              Last command sent: <strong>{lastCommand}</strong>
              {isSendingCommand && " (Sending...)"}
            </AlertDescription>
          </Alert>
        )}

        {/* Robot Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Robot ID: {robotId}</div>
          <div>Status: {currentStatus}</div>
          <div>Connection: {isConnected ? "Online" : "Offline"}</div>
        </div>
      </CardContent>
    </Card>
  );
} 