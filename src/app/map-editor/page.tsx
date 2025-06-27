
"use client";

import type * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { NFC_TAG_POSITIONS as defaultTagPositions, type TagPosition } from '@/lib/tag-positions';
import { MapDisplay } from '@/components/MapDisplay';
import Link from 'next/link';
import { Trash2, Edit, Save, PlusCircle, ListRestart, RotateCcw, LocateFixed } from 'lucide-react';
import { SpeedControlCard } from '@/components/SpeedControlCard';

const LOCAL_STORAGE_KEY = 'customMapData';
const LOCAL_STORAGE_KEY_SPEED = 'robotSpeedKmHr'; // Changed key for clarity

const isValidTagPositionArray = (data: any): data is TagPosition[] => {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'number' &&
      typeof item.name === 'string' &&
      typeof item.x === 'number' &&
      item.x >= 0 && item.x <= 100 &&
      typeof item.y === 'number' &&
      item.y >= 0 && item.y <= 100 &&
      Array.isArray(item.connections) &&
      item.connections.every((c: any) => typeof c === 'number')
  );
};


export default function MapEditorPage() {
  const [tags, setTags] = useState<TagPosition[]>(() => {
    if (typeof window !== 'undefined') {
      const storedMap = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedMap) {
        try {
          const parsedMap = JSON.parse(storedMap);
          if (isValidTagPositionArray(parsedMap)) {
            return parsedMap;
          }
        } catch (e) {
          console.error("Failed to parse custom map from localStorage:", e);
        }
      }
    }
    return JSON.parse(JSON.stringify(defaultTagPositions));
  });

  const [editingTag, setEditingTag] = useState<TagPosition | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [isClickToPlaceMode, setIsClickToPlaceMode] = useState<boolean>(false);
  const { toast } = useToast();

  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window !== 'undefined') {
        const storedSpeed = localStorage.getItem(LOCAL_STORAGE_KEY_SPEED);
        if (storedSpeed) {
            const parsedSpeed = parseFloat(storedSpeed);
            if (!isNaN(parsedSpeed) && parsedSpeed >= 0 && parsedSpeed <= 10) {
                return parsedSpeed;
            }
        }
    }
    return 2.5; // Default speed in km/hr
  });

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_SPEED, newSpeed.toString());
        toast({ title: "Speed Saved", description: `Robot simulation speed set to ${newSpeed.toFixed(1)} km/hr.` });
    } catch (e) {
        toast({ title: "Save Error", description: "Could not save speed to browser storage.", variant: "destructive" });
        console.error("Failed to save speed to localStorage:", e);
    }
  }, [toast]);

  useEffect(() => {
    // Optional: auto-save on tags change
  }, [tags]);

  const saveMapToLocalStorage = useCallback(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tags));
      toast({ title: "Map Saved", description: "Custom map configuration saved to browser storage." });
    } catch (e) {
      toast({ title: "Save Error", description: "Could not save map to browser storage.", variant: "destructive" });
      console.error("Failed to save map to localStorage:", e);
    }
  }, [tags, toast]);

  const loadMapFromLocalStorage = useCallback(() => {
    const storedMap = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedMap) {
      try {
        const parsedMap = JSON.parse(storedMap);
        if (isValidTagPositionArray(parsedMap)) {
          setTags(parsedMap);
          toast({ title: "Map Loaded", description: "Custom map loaded from browser storage." });
        } else {
          toast({ title: "Load Error", description: "Invalid map data in browser storage.", variant: "destructive" });
        }
      } catch (e) {
        toast({ title: "Load Error", description: "Could not parse map data from browser storage.", variant: "destructive" });
        console.error("Failed to load/parse map from localStorage:", e);
      }
    } else {
      toast({ title: "Not Found", description: "No custom map found in browser storage." });
    }
  }, [toast]);

  const resetToDefaultMap = useCallback(() => {
    setTags(JSON.parse(JSON.stringify(defaultTagPositions)));
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    toast({ title: "Map Reset", description: "Map reset to default configuration." });
  }, [toast]);

  const handleStartAddNewTag = () => {
    const nextId = tags.length > 0 ? Math.max(...tags.map(t => t.id)) + 1 : 1;
    setEditingTag({ id: nextId, name: '', x: 50, y: 50, connections: [] });
    setIsAddingNew(true);
    setIsClickToPlaceMode(false);
  };

  const handleEditTag = (tag: TagPosition) => {
    setEditingTag(JSON.parse(JSON.stringify(tag)));
    setIsAddingNew(false);
    setIsClickToPlaceMode(false);
  };

  const handleSaveTag = () => {
    if (!editingTag) return;

    if (editingTag.name.trim() === '') {
      toast({ title: "Validation Error", description: "Tag name cannot be empty.", variant: "destructive" });
      return;
    }
    if (isNaN(editingTag.id) || editingTag.id <= 0) {
      toast({ title: "Validation Error", description: "Tag ID must be a positive number.", variant: "destructive" });
      return;
    }
    if (isNaN(editingTag.x) || editingTag.x < 0 || editingTag.x > 100 || isNaN(editingTag.y) || editingTag.y < 0 || editingTag.y > 100) {
      toast({ title: "Validation Error", description: "Coordinates (X, Y) must be between 0 and 100.", variant: "destructive" });
      return;
    }

    const validConnections = editingTag.connections.filter(cId => tags.some(t => t.id === cId && t.id !== editingTag.id));
    const updatedTag = { ...editingTag, connections: validConnections };

    if (isAddingNew) {
      if (tags.some(t => t.id === updatedTag.id)) {
        toast({ title: "Save Error", description: `Tag ID ${updatedTag.id} already exists.`, variant: "destructive" });
        return;
      }
      setTags(prevTags => [...prevTags, updatedTag]);
    } else {
      setTags(prevTags => prevTags.map(t => t.id === updatedTag.id ? updatedTag : t));
    }
    setEditingTag(null);
    setIsAddingNew(false);
    setIsClickToPlaceMode(false);
    toast({ title: "Tag Saved", description: `Tag ${updatedTag.name} (ID: ${updatedTag.id}) saved.` });
  };

  const handleDeleteTag = (tagId: number) => {
    setTags(prevTags => prevTags.filter(t => t.id !== tagId));
    setTags(prevTags => prevTags.map(t => ({
      ...t,
      connections: t.connections.filter(cId => cId !== tagId)
    })));
    setEditingTag(null);
    setIsClickToPlaceMode(false);
    toast({ title: "Tag Deleted", description: `Tag ID ${tagId} deleted.` });
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setIsAddingNew(false);
    setIsClickToPlaceMode(false);
  }

  const handleMapAreaClick = useCallback((coords: { xPercent: number, yPercent: number }) => {
    if (isClickToPlaceMode && editingTag) {
      setEditingTag(prev => prev ? { ...prev, x: Math.round(coords.xPercent), y: Math.round(coords.yPercent) } : null);
      setIsClickToPlaceMode(false); // Turn off placement mode after a successful click
      toast({ title: "Position Set", description: `Tag coordinates updated to X: ${Math.round(coords.xPercent)}%, Y: ${Math.round(coords.yPercent)}% via map click.` });
    }
  }, [isClickToPlaceMode, editingTag, toast]);


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="bg-card border-b border-border p-4 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Map Editor</h1>
          <div className="flex items-center space-x-2">
            <Button onClick={saveMapToLocalStorage} variant="outline"><Save className="mr-2 h-4 w-4" />Save Map</Button>
            <Button onClick={loadMapFromLocalStorage} variant="outline"><ListRestart className="mr-2 h-4 w-4" />Load Map</Button>
            <Button onClick={resetToDefaultMap} variant="destructive"><RotateCcw className="mr-2 h-4 w-4" />Reset Default</Button>
            <Button asChild variant="default">
              <Link href="/">Back to Simulation</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <SpeedControlCard initialSpeed={speed} onSpeedChange={handleSpeedChange} />
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Manage NFC tags and their connections.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleStartAddNewTag} className="w-full mb-4">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Tag
                </Button>
                <ScrollArea className="h-[calc(100vh-20rem)]">
                  {tags.length === 0 && <p className="text-muted-foreground text-center">No tags defined. Add one to start.</p>}
                  <ul className="space-y-2">
                    {tags.sort((a, b) => a.id - b.id).map(tag => (
                      <li key={tag.id} className="p-3 border rounded-md bg-card-foreground/5">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{tag.name} (ID: {tag.id})</span>
                          <div>
                            <Button variant="ghost" size="icon" onClick={() => handleEditTag(tag)} title="Edit Tag">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTag(tag.id)} title="Delete Tag" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Pos: ({tag.x}%, {tag.y}%)</p>
                        <p className="text-xs text-muted-foreground">Connects to: {tag.connections.join(', ') || 'None'}</p>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            {editingTag && (
              <Card>
                <CardHeader>
                  <CardTitle>{isAddingNew ? "Add New Tag" : `Editing Tag: ${editingTag.name || 'Unnamed'} (ID: ${editingTag.id})`}</CardTitle>
                  {isClickToPlaceMode && (
                    <CardDescription className="text-accent-foreground font-semibold flex items-center">
                      <LocateFixed className="mr-2 h-4 w-4 animate-pulse" /> Click on the map preview below to set coordinates for '{editingTag.name || 'this tag'}'.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="tag-id">Tag ID</Label>
                    <Input
                      id="tag-id"
                      type="number"
                      value={editingTag.id}
                      onChange={(e) => setEditingTag({ ...editingTag, id: parseInt(e.target.value, 10) || 0 })}
                      disabled={!isAddingNew || isClickToPlaceMode}
                      className={(!isAddingNew || isClickToPlaceMode) ? "bg-muted/50" : ""}
                    />
                    {!isAddingNew && <p className="text-xs text-muted-foreground mt-1">ID cannot be changed after creation.</p>}
                  </div>
                  <div>
                    <Label htmlFor="tag-name">Tag Name</Label>
                    <Input
                      id="tag-name"
                      value={editingTag.name}
                      onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                      disabled={isClickToPlaceMode}
                      className={isClickToPlaceMode ? "bg-muted/50" : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Position</Label>
                      <Button variant="outline" size="sm" onClick={() => setIsClickToPlaceMode(true)} disabled={isClickToPlaceMode}>
                        <LocateFixed className="mr-2 h-4 w-4" /> Set on Map
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="tag-x">X (%)</Label>
                        <Input
                          id="tag-x"
                          type="number"
                          min="0" max="100" step="1"
                          value={editingTag.x}
                          onChange={(e) => setEditingTag({ ...editingTag, x: parseFloat(e.target.value) || 0 })}
                          disabled={isClickToPlaceMode}
                          className={isClickToPlaceMode ? "bg-muted/50" : ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="tag-y">Y (%)</Label>
                        <Input
                          id="tag-y"
                          type="number"
                          min="0" max="100" step="1"
                          value={editingTag.y}
                          onChange={(e) => setEditingTag({ ...editingTag, y: parseFloat(e.target.value) || 0 })}
                          disabled={isClickToPlaceMode}
                          className={isClickToPlaceMode ? "bg-muted/50" : ""}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Connections</Label>
                    <CardDescription className="mb-2">Select tags this tag directly connects to. A tag cannot connect to itself.</CardDescription>
                    <ScrollArea className="h-40 border rounded-md p-2"> {/* Reduced height slightly */}
                      {tags.filter(t => t.id !== editingTag.id).length === 0 && <p className="text-muted-foreground text-sm">No other tags available to connect to.</p>}
                      {tags.filter(t => t.id !== editingTag.id).sort((a, b) => a.id - b.id).map(otherTag => (
                        <div key={otherTag.id} className="flex items-center space-x-2 mb-1">
                          <input
                            type="checkbox"
                            id={`conn-${otherTag.id}`}
                            checked={editingTag.connections.includes(otherTag.id)}
                            onChange={(e) => {
                              const newConnections = e.target.checked
                                ? [...editingTag.connections, otherTag.id]
                                : editingTag.connections.filter(id => id !== otherTag.id);
                              setEditingTag({ ...editingTag, connections: Array.from(new Set(newConnections)) });
                            }}
                            disabled={isClickToPlaceMode}
                          />
                          <Label htmlFor={`conn-${otherTag.id}`} className={isClickToPlaceMode ? "text-muted-foreground" : ""}>{otherTag.name} (ID: {otherTag.id})</Label>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                    <Button onClick={handleSaveTag} disabled={isClickToPlaceMode}><Save className="mr-2 h-4 w-4" />Save Tag</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Map Preview Card - Always visible */}
            <Card className={editingTag ? "min-h-[300px] md:min-h-[400px] lg:h-[50vh]" : "h-full"}>
              <CardHeader>
                <CardTitle>Map Preview</CardTitle>
                <CardDescription>
                  {isClickToPlaceMode && editingTag
                    ? `Click on the map area to set coordinates for '${editingTag.name || 'the current tag'}'.`
                    : editingTag
                      ? `Previewing map. Edit tag '${editingTag.name || 'Unnamed'}' in the form above. Click a different tag on the map to switch editing.`
                      : "This is a live preview of your current tag configuration. Click a tag on the map to edit it."}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[calc(100%-6rem)]"> {/* Adjust height to account for potentially taller header */}
                {tags.length > 0 || (isClickToPlaceMode && editingTag) ? (
                  <MapDisplay
                    allTags={tags}
                    detectedNfcTags={{}}
                    targetTagId={null}
                    currentRobotTagId={null}
                    currentPath={[]}
                    onTagClick={(tagId) => {
                      // If in placement mode for the current editingTag, clicks on tag icons are ignored by MapDisplay itself.
                      // This callback will only fire if not in placement mode, or if placement mode is for a *different* instance of MapDisplay.
                      // Since there's only one MapDisplay on this page, its internal check `isPlacementModeActive` (set by this page's `isClickToPlaceMode`) is sufficient.
                      // So, if this is called, it means it's safe to switch the tag being edited.
                      const tagToEdit = tags.find(t => t.id === tagId);
                      if (tagToEdit) {
                        handleEditTag(tagToEdit); // This also sets isClickToPlaceMode = false
                      }
                    }}
                    onMapAreaClick={handleMapAreaClick}
                    isPlacementModeActive={isClickToPlaceMode}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>
                      {isClickToPlaceMode && editingTag
                        ? "Map area active for placement. Click to set coordinates."
                        : "Add tags to see a preview."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
