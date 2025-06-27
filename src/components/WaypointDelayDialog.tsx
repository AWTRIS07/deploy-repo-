
"use client";

import * as React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TrajectoryWaypoint } from '@/app/page';
import type { TagPosition } from '@/lib/tag-positions';

interface WaypointDelayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (delayMs: number) => void;
  waypoint: Omit<TrajectoryWaypoint, 'delayOverrideMs'> | null;
  allTags: TagPosition[];
}

export function WaypointDelayDialog({ open, onOpenChange, onConfirm, waypoint, allTags }: WaypointDelayDialogProps) {
  const [delay, setDelay] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setDelay(''); // Reset delay input when dialog opens
    }
  }, [open]);

  const handleConfirm = () => {
    const delayMs = parseInt(delay, 10);
    onConfirm(isNaN(delayMs) ? 0 : delayMs); // Pass 0 if input is invalid
    onOpenChange(false);
  };

  const tagName = waypoint ? allTags.find(t => t.id === waypoint.tagId)?.name : 'Unknown';

  if (!waypoint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Custom Delay for Waypoint</DialogTitle>
          <DialogDescription>
            Enter the time in milliseconds for the robot to wait after reaching{' '}
            <span className="font-semibold text-primary">{tagName || `Tag ${waypoint.tagId}`}</span>.
            Leave blank or enter 0 to use the global default delay.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="delay-ms" className="text-right">
              Delay (ms)
            </Label>
            <Input
              id="delay-ms"
              type="number"
              value={delay}
              onChange={(e) => setDelay(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 2000 for 2 seconds"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" onClick={handleConfirm}>Set Delay & Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
