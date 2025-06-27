"use client";

import type * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity } from "lucide-react";

interface MotorPwmDisplayCardProps {
  motorPwm: number;
}

export function MotorPwmDisplayCard({ motorPwm }: MotorPwmDisplayCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg font-semibold">
          <Activity className="mr-3 h-6 w-6 text-primary" />
          Motor PWM Level
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-3xl font-bold text-primary">{motorPwm}%</p>
        </div>
        <Progress value={motorPwm} className="w-full h-3" aria-label={`Motor PWM at ${motorPwm}%`} />
        <p className="text-sm text-muted-foreground">
          This value reflects the current power level being sent to the motors.
        </p>
      </CardContent>
    </Card>
  );
}
