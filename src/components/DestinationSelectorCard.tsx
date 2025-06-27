
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import type { TagPosition } from '@/lib/tag-positions';
import type { TrajectoryWaypoint } from '@/app/page';


interface DestinationSelectorCardProps {
  onSetSingleDestination: (waypoint: TrajectoryWaypoint) => void;
  allTagPositions: TagPosition[];
  currentRobotTagId: number | null; 
}

export function DestinationSelectorCard({
  onSetSingleDestination,
  allTagPositions,
  currentRobotTagId,
}: DestinationSelectorCardProps) {
  
  const [selectedValue, setSelectedValue] = React.useState("");
  const availableTagsForSelection = allTagPositions.filter(tagPos => tagPos.id !== currentRobotTagId);

  const handleSelectionChange = (value: string) => {
    setSelectedValue(value);
    const selectedId = parseInt(value, 10);
    if (!isNaN(selectedId)) {
      onSetSingleDestination({ tagId: selectedId });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg font-semibold">
          <Target className="mr-3 h-6 w-6 text-primary" />
          Set Single Destination
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="destination-select" className="text-sm font-medium">Destination NFC Tag</Label>
        <Select
          value={selectedValue}
          onValueChange={handleSelectionChange}
          disabled={allTagPositions.length === 0}
        >
          <SelectTrigger id="destination-select" className="w-full">
            <SelectValue placeholder={allTagPositions.length === 0 ? "No tags in map" : "Select a destination tag..."} />
          </SelectTrigger>
          <SelectContent>
            {availableTagsForSelection.length > 0 ? (
              availableTagsForSelection.sort((a,b)=> a.id - b.id).map((tag) => (
                <SelectItem key={tag.id} value={tag.id.toString()}>
                  {tag.name} (Tag {tag.id})
                </SelectItem>
              ))
            ) : (
              allTagPositions.length > 0 ? 
              <SelectItem value="no-other-tags" disabled>
                No other tags available
              </SelectItem> :
              <SelectItem value="no-tags-total" disabled>
                Map is empty. Add tags in editor.
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Selecting a destination here will clear any existing trajectory and set this as the only target.
        </p>
      </CardContent>
    </Card>
  );
}
