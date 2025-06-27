
"use client";

import type * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Timer } from "lucide-react";
import { Label } from '@/components/ui/label';

interface DelayControlCardProps {
  initialDelay: number; // in milliseconds
  onDelayChange: (delay: number) => void;
}

const msToHMS = (totalMs: number) => {
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return { h, m, s };
};

const hmsToMs = (h: number, m: number, s: number) => {
  return (h * 3600 + m * 60 + s) * 1000;
};

export function DelayControlCard({ initialDelay, onDelayChange }: DelayControlCardProps) {
  const [hours, setHours] = useState(() => String(msToHMS(initialDelay).h));
  const [minutes, setMinutes] = useState(() => String(msToHMS(initialDelay).m));
  const [seconds, setSeconds] = useState(() => String(msToHMS(initialDelay).s));

  useEffect(() => {
    const { h, m, s } = msToHMS(initialDelay);
    setHours(String(h));
    setMinutes(String(m));
    setSeconds(String(s));
  }, [initialDelay]);

  const handleTimeChange = useCallback((part: 'h' | 'm' | 's', value: string) => {
    let numericValue = parseInt(value, 10);
    if (isNaN(numericValue)) {
      numericValue = 0;
    }

    let newH = parseInt(hours, 10) || 0;
    let newM = parseInt(minutes, 10) || 0;
    let newS = parseInt(seconds, 10) || 0;

    if (part === 'h') {
      newH = Math.max(0, Math.min(99, numericValue));
      setHours(String(newH));
    } else if (part === 'm') {
      newM = Math.max(0, Math.min(59, numericValue));
      setMinutes(String(newM));
    } else if (part === 's') {
      newS = Math.max(0, Math.min(59, numericValue));
      setSeconds(String(newS));
    }

    onDelayChange(hmsToMs(newH, newM, newS));
  }, [hours, minutes, seconds, onDelayChange]);


  const currentHours = parseInt(hours, 10) || 0;
  const currentMinutes = parseInt(minutes, 10) || 0;
  const currentSeconds = parseInt(seconds, 10) || 0;
  
  const displayTime = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}:${String(currentSeconds).padStart(2, '0')}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg font-semibold">
          <Timer className="mr-3 h-6 w-6 text-primary" />
          Global Tag Visit Delay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end space-x-2">
          <div>
            <Label htmlFor="delay-hours" className="text-xs">Hours</Label>
            <Input
              id="delay-hours"
              type="number"
              value={hours}
              onChange={(e) => handleTimeChange('h', e.target.value)}
              min={0}
              max={99}
              className="w-20 text-center"
            />
          </div>
          <span className="pb-2">:</span>
          <div>
            <Label htmlFor="delay-minutes" className="text-xs">Minutes</Label>
            <Input
              id="delay-minutes"
              type="number"
              value={minutes}
              onChange={(e) => handleTimeChange('m', e.target.value)}
              min={0}
              max={59}
              className="w-20 text-center"
            />
          </div>
          <span className="pb-2">:</span>
          <div>
            <Label htmlFor="delay-seconds" className="text-xs">Seconds</Label>
            <Input
              id="delay-seconds"
              type="number"
              value={seconds}
              onChange={(e) => handleTimeChange('s', e.target.value)}
              min={0}
              max={59}
              className="w-20 text-center"
            />
          </div>
        </div>
        <p id="delay-label" className="text-sm text-muted-foreground">
          Default wait time at each tag: {displayTime}
        </p>
      </CardContent>
    </Card>
  );
}
