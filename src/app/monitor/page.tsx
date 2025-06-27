"use client";

import { useAppContext } from '@/components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Camera, 
  Battery, 
  MapPin, 
  Navigation, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Play,
  Pause,
  Home,
  Target,
  Route,
  Moon,
  Sun
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MonitorPage() {
  const {
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
    isConnected,
    isLoading
  } = useAppContext();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Apply dark mode to body
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // Calculate trajectory path from discovered tags
  const trajectoryPath = discoveredTags
    .sort((a, b) => {
      const timeA = a.timestamp?.toDate?.()?.getTime() || 0;
      const timeB = b.timestamp?.toDate?.()?.getTime() || 0;
      return timeA - timeB;
    })
    .map(tag => tag.tagId);

  // Get current exploration session
  const currentSession = explorationSessions[0];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Connecting to robot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Robot Monitor</h1>
            <p className="text-muted-foreground">Real-time monitoring dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Current Time</p>
              <p className="font-mono text-lg">{currentTime.toLocaleTimeString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="default" className="bg-green-500">
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={toggleDarkMode} aria-label="Toggle dark mode">
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dual Camera Feeds */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Live Camera Feeds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Camera */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Primary Camera</span>
                    <Badge variant={cameraStatus?.primary_available ? "default" : "secondary"}>
                      {cameraStatus?.primary_available ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                    {latestPrimaryCameraFrame ? (
                      <img 
                        src={latestPrimaryCameraFrame.imageUrl} 
                        alt="Primary camera feed"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${latestPrimaryCameraFrame ? 'hidden' : ''}`}>
                      <div className="text-center text-muted-foreground">
                        <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No primary feed</p>
                      </div>
                    </div>
                  </div>
                  {latestPrimaryCameraFrame && (
                    <div className="text-xs text-muted-foreground">
                      <p>Frame: {latestPrimaryCameraFrame.frameId}</p>
                      <p>Size: {(latestPrimaryCameraFrame.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                </div>

                {/* Secondary Camera */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Secondary Camera</span>
                    <Badge variant={cameraStatus?.secondary_available ? "default" : "secondary"}>
                      {cameraStatus?.secondary_available ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                    {latestSecondaryCameraFrame ? (
                      <img 
                        src={latestSecondaryCameraFrame.imageUrl} 
                        alt="Secondary camera feed"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${latestSecondaryCameraFrame ? 'hidden' : ''}`}>
                      <div className="text-center text-muted-foreground">
                        <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No secondary feed</p>
                      </div>
                    </div>
                  </div>
                  {latestSecondaryCameraFrame && (
                    <div className="text-xs text-muted-foreground">
                      <p>Frame: {latestSecondaryCameraFrame.frameId}</p>
                      <p>Size: {(latestSecondaryCameraFrame.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Camera Status Information */}
              {cameraStatus && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Camera System Status</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Primary Available</p>
                      <p className="font-mono">{cameraStatus.primary_available ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Secondary Available</p>
                      <p className="font-mono">{cameraStatus.secondary_available ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Resolution</p>
                      <p className="font-mono">{cameraStatus.frame_width}x{cameraStatus.frame_height}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">FPS</p>
                      <p className="font-mono">{cameraStatus.fps}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Battery Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Battery className="h-5 w-5" />
                Battery Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">
                  {batteryLevel?.toFixed(1) || '--'}%
                </div>
                <Progress 
                  value={batteryLevel || 0} 
                  className="w-full h-3"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge 
                    variant={
                      batteryLevel 
                        ? batteryLevel > 50 
                          ? 'default' 
                          : batteryLevel > 20 
                            ? 'secondary'
                            : 'destructive'
                        : 'secondary'
                    }
                  >
                    {batteryLevel 
                      ? batteryLevel > 50 
                        ? 'Good' 
                        : batteryLevel > 20 
                          ? 'Low'
                          : 'Critical'
                      : 'Unknown'
                    }
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Robot Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Robot Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge variant="outline">
                    {robotStatus?.status || 'Unknown'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Current Tag:</span>
                  <span className="font-mono font-bold">#{currentTag || '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Previous Tag:</span>
                  <span className="font-mono">#{previousTag || '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Discovered Tags:</span>
                  <span className="font-mono">{discoveredTags.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Trajectory */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Current Trajectory
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trajectoryPath.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground mb-3">
                    Path: {trajectoryPath.join(' → ')}
                  </div>
                  <div className="space-y-1">
                    {trajectoryPath.map((tagId, index) => (
                      <div 
                        key={tagId} 
                        className={`flex items-center gap-2 p-2 rounded ${
                          tagId === currentTag 
                            ? 'bg-primary/10 border border-primary/20' 
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {tagId === currentTag ? (
                            <Target className="h-4 w-4 text-primary" />
                          ) : (
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-mono">#{tagId}</span>
                        </div>
                        {tagId === currentTag && (
                          <Badge variant="default" className="ml-auto text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trajectory data available</p>
                  <p className="text-sm">Start exploration to see trajectory</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Track Map Visualization */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Track Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[16/9] bg-muted rounded-lg border relative overflow-hidden">
                {discoveredTags.length > 0 ? (
                  <div className="w-full h-full relative">
                    {/* Track visualization */}
                    <svg className="w-full h-full absolute inset-0">
                      {/* Draw connections between discovered tags */}
                      {trajectoryPath.slice(0, -1).map((tagId, index) => {
                        const nextTagId = trajectoryPath[index + 1];
                        const currentTag = discoveredTags.find(t => t.tagId === tagId);
                        const nextTag = discoveredTags.find(t => t.tagId === nextTagId);
                        
                        if (currentTag && nextTag) {
                          // Calculate positions (simplified - in real implementation, use actual coordinates)
                          const x1 = 50 + (index * 20) % 80;
                          const y1 = 30 + Math.floor(index / 4) * 40;
                          const x2 = 50 + ((index + 1) * 20) % 80;
                          const y2 = 30 + Math.floor((index + 1) / 4) * 40;
                          
                          return (
                            <line
                              key={`${tagId}-${nextTagId}`}
                              x1={`${x1}%`}
                              y1={`${y1}%`}
                              x2={`${x2}%`}
                              y2={`${y2}%`}
                              stroke="#3b82f6"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                          );
                        }
                        return null;
                      })}
                    </svg>
                    
                    {/* Tag positions */}
                    {trajectoryPath.map((tagId, index) => {
                      const tag = discoveredTags.find(t => t.tagId === tagId);
                      const x = 50 + (index * 20) % 80;
                      const y = 30 + Math.floor(index / 4) * 40;
                      const isCurrent = tagId === currentTag;
                      
                      return (
                        <div
                          key={tagId}
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                            isCurrent ? 'z-10' : 'z-5'
                          }`}
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                            ${isCurrent 
                              ? 'bg-primary text-primary-foreground shadow-lg' 
                              : 'bg-muted border-2 border-border'
                            }
                          `}>
                            {tagId}
                          </div>
                          {isCurrent && (
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                              <Badge variant="default" className="text-xs">
                                Current
                              </Badge>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">No track data available</p>
                      <p className="text-sm">Start exploration to see track map</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Track statistics */}
              {currentSession && (
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-medium">Session ID</p>
                    <p className="font-mono text-xs">{currentSession.sessionId.slice(0, 8)}...</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Tags Discovered</p>
                    <p className="font-mono">{currentSession.tagCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Status</p>
                    <Badge variant="outline" className="text-xs">
                      {currentSession.status}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer with additional info */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
              <div>
                <p className="font-medium">Robot ID</p>
                <p className="font-mono">line_follower_robot_001</p>
              </div>
              <div>
                <p className="font-medium">Last Update</p>
                <p className="font-mono">{robotStatus?.lastUpdate?.toDate?.()?.toLocaleTimeString() || 'Unknown'}</p>
              </div>
              <div>
                <p className="font-medium">Exploration Sessions</p>
                <p className="font-mono">{explorationSessions.length}</p>
              </div>
              <div>
                <p className="font-medium">Connection Status</p>
                <p className="font-mono">{isConnected ? 'Online' : 'Offline'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 