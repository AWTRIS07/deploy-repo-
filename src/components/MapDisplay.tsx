
"use client";

import type * as React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, Bot, Nfc, Target as TargetIcon, Clock, Waypoints, Plus } from "lucide-react";
import type { TagPosition } from '@/lib/tag-positions';
import type { TrajectoryWaypoint } from '@/app/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MapDisplayProps {
  detectedNfcTags: Record<number, string>;
  destinationQueue: TrajectoryWaypoint[];
  currentRobotTagId: number | null;
  mapImageUrl?: string;
  routeSourceTagId?: number; 
  currentPath: number[]; 
  allTags: TagPosition[]; 
  onAddWaypoint?: (waypoint: TrajectoryWaypoint) => void;
  onAddWaypointWithDelay?: (tagId: number) => void;
  onSetSingleDestination?: (waypoint: TrajectoryWaypoint) => void;
  onTagClick?: (tagId: number) => void;
  onMapAreaClick?: (coords: { xPercent: number, yPercent: number }) => void;
  isPlacementModeActive?: boolean;
}

export function MapDisplay({
  detectedNfcTags,
  destinationQueue = [],
  currentRobotTagId,
  mapImageUrl,
  routeSourceTagId,
  currentPath = [],
  allTags,
  onAddWaypoint,
  onAddWaypointWithDelay,
  onSetSingleDestination,
  onTagClick,
  onMapAreaClick,
  isPlacementModeActive,
}: MapDisplayProps) {

  const getTagById = (id: number): TagPosition | undefined => {
    return allTags.find(t => t.id === id);
  };
  
  const immediateTargetId = destinationQueue.length > 0 ? destinationQueue[0].tagId : null;

  const trajectoryPathSegments: Array<{ from: TagPosition; to: TagPosition }> = [];
  if (destinationQueue.length > 1) {
    for (let i = 0; i < destinationQueue.length - 1; i++) {
      const fromTag = getTagById(destinationQueue[i].tagId);
      const toTag = getTagById(destinationQueue[i+1].tagId);
      if (fromTag && toTag) {
        trajectoryPathSegments.push({ from, to });
      }
    }
  }

  const robotPathSegments: Array<{ from: TagPosition; to: TagPosition }> = [];
  if (currentRobotTagId !== null && currentPath.length > 0) {
    let lastPathTag = getTagById(currentRobotTagId);
    for (const nextPathTagId of currentPath) {
      const nextPathTag = getTagById(nextPathTagId);
      if (lastPathTag && nextPathTag) {
        robotPathSegments.push({ from: lastPathTag, to: nextPathTag });
        lastPathTag = nextPathTag;
      } else {
        break; 
      }
    }
  }

  const handleMapBackgroundClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isPlacementModeActive && onMapAreaClick) {
      if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));
        
        onMapAreaClick({ xPercent, yPercent });
      }
    }
  };

  const isEditorContext = !!onMapAreaClick;
  const isSimulationContext = !isEditorContext;
  
  const tagIdsInQueue = new Set(destinationQueue.map(wp => wp.tagId));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-semibold">
          <MapPin className="mr-3 h-7 w-7 text-primary" />
          Robot Environment Map
        </CardTitle>
        <CardDescription>
          {isPlacementModeActive 
            ? "Click on the map area to set tag coordinates." 
            : isSimulationContext
              ? "Right-click a tag for options. Robot position, target, and path are shown."
              : "Visual representation of tag locations. Click a tag to edit it."
          }
        </CardDescription>
        <div className="border-t border-border pt-4 mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 text-xs items-center">
            <div className="flex items-center whitespace-nowrap"><span className="w-3 h-3 rounded-full bg-muted/70 border border-muted-foreground/50 mr-2 shrink-0"></span>Not Detected</div>
            <div className="flex items-center whitespace-nowrap"><span className="w-3 h-3 rounded-full bg-primary/80 border border-primary-foreground/50 mr-2 shrink-0"></span>Detected</div>
            <div className="flex items-center whitespace-nowrap"><span className="w-3 h-3 rounded-full bg-accent/90 border border-accent-foreground/50 mr-2 shrink-0"></span><TargetIcon className="w-3 h-3 mr-1 inline"/>Target</div>
            <div className="flex items-center whitespace-nowrap"><span className="w-3 h-3 rounded-full bg-green-500/90 border border-white/50 mr-2 shrink-0"></span><Bot className="w-3 h-3 mr-1 inline"/>Robot</div>
            <div className="flex items-center whitespace-nowrap">
              <svg width="16" height="16" viewBox="0 0 16 16" className="mr-2 shrink-0">
                <line x1="2" y1="8" x2="14" y2="8" stroke="hsl(var(--accent))" strokeWidth="2" strokeDasharray="2,2"/>
              </svg>
              Full Trajectory
            </div>
            <div className="flex items-center whitespace-nowrap">
              <svg width="16" height="16" viewBox="0 0 16 16" className="mr-2 shrink-0">
                <line x1="2" y1="8" x2="14" y2="8" stroke="hsl(var(--primary))" strokeWidth="2"/>
              </svg>
              Current Path
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow relative overflow-hidden rounded-b-lg pt-2">
        <div 
          className={`aspect-[900/600] w-full h-full bg-background rounded-md shadow-inner ${isPlacementModeActive ? 'cursor-crosshair' : ''}`}
          onClick={handleMapBackgroundClick}
          role={isPlacementModeActive ? "button" : undefined}
          tabIndex={isPlacementModeActive ? 0 : undefined}
          aria-label={isPlacementModeActive ? "Map area for tag placement" : "Map display"}
        >
        {mapImageUrl ? (
            <Image
                src={mapImageUrl}
                alt="Robot Map Layout"
                layout="fill"
                objectFit="contain"
                className="rounded-md pointer-events-none"
                data-ai-hint="warehouse shelves aisles"
                unoptimized={mapImageUrl.startsWith('https://placehold.co') || mapImageUrl.includes('user-images.githubusercontent.com')}
            />
        ) : null}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 5, 
            }}
          >
             {trajectoryPathSegments.map((segment, index) => (
              <line
                key={`trajectory-path-segment-${index}`}
                x1={`${segment.from.x}%`}
                y1={`${segment.from.y}%`}
                x2={`${segment.to.x}%`}
                y2={`${segment.to.y}%`}
                stroke="hsl(var(--accent))" 
                strokeWidth="3"
                strokeDasharray="5,5" 
              />
            ))}
            {robotPathSegments.map((segment, index) => (
              <line
                key={`robot-path-segment-${index}`}
                x1={`${segment.from.x}%`}
                y1={`${segment.from.y}%`}
                x2={`${segment.to.x}%`}
                y2={`${segment.to.y}%`}
                stroke="hsl(var(--primary))" 
                strokeWidth="4" 
              />
            ))}
          </svg>

          {allTags.map((tag) => {
            const isDetected = detectedNfcTags.hasOwnProperty(tag.id);
            const isImmediateTarget = tag.id === immediateTargetId;
            const isQueued = tagIdsInQueue.has(tag.id);
            const isRobotAtTag = tag.id === currentRobotTagId;
            
            const canInteractInEditor = isEditorContext && !isPlacementModeActive && !isRobotAtTag;
            const canInteractInSimulation = isSimulationContext && !isPlacementModeActive;

            let bgColor = "bg-muted/70 backdrop-blur-sm";
            let textColor = "text-muted-foreground";
            let borderColor = "border-muted-foreground/50";
            let size = "w-8 h-8";
            let zIndex = 10;
            let icon = <Nfc className="w-3 h-3" />;
            let baseTitle = `${tag.name || 'Unnamed Tag'} (ID: ${tag.id})`;
            if(isDetected) baseTitle += ` (UID: ${detectedNfcTags[tag.id]})`;
            
            if (isQueued) {
                bgColor = "bg-accent/70 backdrop-blur-sm";
                textColor = "text-accent-foreground";
                borderColor = "border-accent-foreground/50";
                icon = <Waypoints className="w-4 h-4" />;
                baseTitle += ' - In Trajectory';
            }

            if (isDetected) {
              bgColor = "bg-primary/80 backdrop-blur-sm";
              textColor = "text-primary-foreground";
              borderColor = "border-primary-foreground/50";
            }
            if (isRobotAtTag) {
              bgColor = "bg-green-500/90 backdrop-blur-sm"; 
              textColor = "text-white";
              borderColor = "border-white/50";
              size = "w-10 h-10";
              zIndex = 20; 
              icon = <Bot className="w-5 h-5" />;
              baseTitle = `${tag.name} (ID: ${tag.id}) - Robot Here`;
            }
            if (isImmediateTarget) {
               if (!isRobotAtTag) { 
                bgColor = "bg-accent/90 backdrop-blur-sm";
                textColor = "text-accent-foreground";
                borderColor = "border-accent-foreground/50";
                size = "w-10 h-10";
                icon = <TargetIcon className="w-4 h-4" />;
               }
               zIndex = Math.max(zIndex, 15); 
               baseTitle += ' - Current Target';
            }
            
            let finalTitle = baseTitle;
            if (canInteractInEditor) finalTitle = `${baseTitle} (Click to edit)`;
            if (canInteractInSimulation) finalTitle = `${baseTitle} (Right-click for options)`;
            if (isPlacementModeActive) finalTitle = `${baseTitle} (Map placement mode active)`;
            
            const tagElement = (
                <div
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center rounded-full shadow-lg transition-all duration-300 ${size} ${bgColor} ${borderColor} border-2 
                                ${(canInteractInEditor || canInteractInSimulation) ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}
                              `}
                    style={{ left: `${tag.x}%`, top: `${tag.y}%`, zIndex }}
                    title={finalTitle}
                    onClick={(e) => {
                    if (isPlacementModeActive) {
                        e.stopPropagation();
                        return;
                    }
                    if (canInteractInEditor && onTagClick) { 
                        e.stopPropagation();
                        onTagClick(tag.id)
                    }
                    }}
                    onContextMenu={(e) => {
                        if (isPlacementModeActive || isEditorContext) {
                            e.preventDefault();
                            return;
                        }
                    }}
                    role={ (canInteractInEditor || canInteractInSimulation) ? "button" : undefined}
                    aria-label={finalTitle}
                >
                    <span className={`text-xs font-bold ${textColor}`}>{tag.id}</span>
                    {(isRobotAtTag || isImmediateTarget || isQueued) ? <div className={`mt-0.5 ${textColor}`}>{icon}</div> : null}
                </div>
            );

            return (
              <DropdownMenu key={tag.id}>
                <DropdownMenuTrigger asChild disabled={isPlacementModeActive || !canInteractInSimulation}>
                  {tagElement}
                </DropdownMenuTrigger>
                {canInteractInSimulation && (
                  <DropdownMenuContent>
                    {onSetSingleDestination && (
                        <DropdownMenuItem onSelect={() => onSetSingleDestination({ tagId: tag.id })}>
                            <TargetIcon className="mr-2 h-4 w-4" /> Go there
                        </DropdownMenuItem>
                    )}
                    {onAddWaypoint && (
                      <DropdownMenuItem onSelect={() => onAddWaypoint({ tagId: tag.id })}>
                        <Plus className="mr-2 h-4 w-4" /> Add to Trajectory
                      </DropdownMenuItem>
                    )}
                    {onAddWaypointWithDelay && (
                     <DropdownMenuItem onSelect={() => onAddWaypointWithDelay(tag.id)}>
                      <Clock className="mr-2 h-4 w-4" /> Add with Custom Delay...
                    </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
