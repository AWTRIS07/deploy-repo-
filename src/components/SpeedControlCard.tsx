
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gauge } from "lucide-react";

interface SpeedControlCardProps {
  initialSpeed: number; // in km/hr
  onSpeedChange: (speed: number) => void;
}

const MAX_SPEED_KMH = 10;

export function SpeedControlCard({ initialSpeed, onSpeedChange }: SpeedControlCardProps) {
  const [currentSpeed, setCurrentSpeed] = useState(initialSpeed);

  useEffect(() => {
    setCurrentSpeed(initialSpeed);
  }, [initialSpeed]);

  const handleSliderChange = (value: number[]) => {
    const newSpeed = value[0];
    setCurrentSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newSpeed = parseFloat(event.target.value);
    if (isNaN(newSpeed)) {
      newSpeed = 0;
    }
    newSpeed = Math.max(0, Math.min(MAX_SPEED_KMH, newSpeed)); // Clamp between 0 and MAX
    setCurrentSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg font-semibold">
          <Gauge className="mr-3 h-6 w-6 text-primary" />
          Robot Speed Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <Slider
            value={[currentSpeed]}
            onValueChange={handleSliderChange}
            max={MAX_SPEED_KMH}
            step={0.1}
            className="w-full"
            aria-labelledby="speed-label"
          />
          <Input
            type="number"
            value={currentSpeed.toFixed(1)}
            onChange={handleInputChange}
            min={0}
            max={MAX_SPEED_KMH}
            step={0.1}
            className="w-24 text-center"
            aria-labelledby="speed-label"
          />
          <span className="text-sm text-muted-foreground">km/hr</span>
        </div>
        <p id="speed-label" className="text-sm text-muted-foreground">
          Adjust the robot's speed (0-{MAX_SPEED_KMH} km/hr). Current: {currentSpeed.toFixed(1)} km/hr
        </p>
      </CardContent>
    </Card>
  );
}
