"use client";

import type * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Nfc, Bot, ListChecks } from "lucide-react";

interface NfcTagMonitorCardProps {
  detectedNfcTags: Record<number, string>; // { 1: "UID_XYZ", ... }
  currentRobotTagId: number | null;
}

export function NfcTagMonitorCard({ detectedNfcTags, currentRobotTagId }: NfcTagMonitorCardProps) {
  const sortedDetectedTags = Object.entries(detectedNfcTags)
    .map(([id, uid]) => ({ id: parseInt(id, 10), uid }))
    .sort((a, b) => a.id - b.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg font-semibold">
          <ListChecks className="mr-3 h-6 w-6 text-primary" />
          NFC Tag Monitor
        </CardTitle>
        <CardDescription>
          {currentRobotTagId !== null ? (
            <span className="flex items-center mt-1">
              <Bot className="mr-2 h-4 w-4 text-accent" /> Robot currently at: Tag {currentRobotTagId}
            </span>
          ) : (
            "Robot position unknown."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sortedDetectedTags.length > 0 ? (
          <ScrollArea className="h-[200px] w-full rounded-md border p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Tag #</TableHead>
                  <TableHead>UID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDetectedTags.map((tag) => (
                  <TableRow key={tag.id} className={tag.id === currentRobotTagId ? "bg-accent/20" : ""}>
                    <TableCell className="font-medium">{tag.id}</TableCell>
                    <TableCell className="font-mono text-xs">{tag.uid}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] border rounded-md p-4 text-center">
            <Nfc className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No NFC tags detected yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Tags will appear here as the robot discovers them.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
