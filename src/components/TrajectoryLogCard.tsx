
"use client";

import type * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Waypoints, Trash2, Clock } from "lucide-react";
import type { TagPosition } from '@/lib/tag-positions';
import type { TrajectoryWaypoint } from '@/app/page';

interface TrajectoryLogCardProps {
  destinationQueue: TrajectoryWaypoint[];
  onClear: () => void;
  allTags: TagPosition[];
  currentTargetId: number | null;
  globalDelayMs: number;
}

export function TrajectoryLogCard({ destinationQueue, onClear, allTags, currentTargetId, globalDelayMs }: TrajectoryLogCardProps) {
  const tagMap = new Map(allTags.map(t => [t.id, t.name]));

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="flex items-center text-lg font-semibold">
                <Waypoints className="mr-3 h-6 w-6 text-primary" />
                Trajectory Log
                </CardTitle>
                <CardDescription className="mt-1">
                A queue of custom destinations for the robot.
                </CardDescription>
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={onClear}
                disabled={destinationQueue.length === 0}
                title="Clear Trajectory"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {destinationQueue.length > 0 ? (
          <ScrollArea className="h-[150px] w-full rounded-md border p-2">
            <ol className="space-y-2 list-decimal list-inside">
              {destinationQueue.map((waypoint, index) => (
                <li 
                  key={`${waypoint.tagId}-${index}`} 
                  className={`p-2 rounded-md text-sm ${waypoint.tagId === currentTargetId ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted/50'}`}
                >
                  <span className="font-semibold">{tagMap.get(waypoint.tagId) || `Tag ${waypoint.tagId}`}</span>
                  <div className="text-xs text-muted-foreground flex items-center mt-1">
                    <Clock className="h-3 w-3 mr-1.5" />
                    Delay: {waypoint.delayOverrideMs ? `${waypoint.delayOverrideMs}ms (Custom)` : `${globalDelayMs}ms (Default)`}
                  </div>
                </li>
              ))}
            </ol>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-[150px] border rounded-md p-4 text-center">
            <Waypoints className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No custom trajectory.</p>
            <p className="text-xs text-muted-foreground mt-1">Right-click a tag on the map to add a destination.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
