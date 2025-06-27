
export interface TagPosition {
  id: number;
  name: string;
  x: number; // percentage
  y: number; // percentage
  connections: number[]; // IDs of directly connected tags
}

// Base definitions of tags with their names and coordinates from the image.
// Connections will be dynamically generated to form a circular sequence.
const BASE_TAG_DEFINITIONS: Omit<TagPosition, 'connections'>[] = [
  { id: 1,  name: "Tag 1",  x: 95, y: 40 },
  { id: 2,  name: "Tag 2",  x: 90, y: 40 },
  { id: 3,  name: "Tag 3",  x: 85, y: 40 },
  { id: 4,  name: "Tag 4",  x: 85, y: 20 },
  { id: 5,  name: "Tag 5",  x: 70, y: 20 },
  { id: 6,  name: "Tag 6",  x: 70, y: 40 },
  { id: 7,  name: "Tag 7",  x: 55, y: 40 },
  { id: 8,  name: "Tag 8",  x: 55, y: 20 },
  { id: 9,  name: "Tag 9",  x: 40, y: 20 },
  { id: 10, name: "Tag 10", x: 40, y: 40 },
  { id: 11, name: "Tag 11", x: 25, y: 40 },
  { id: 12, name: "Tag 12", x: 25, y: 20 },
  { id: 13, name: "Tag 13", x: 10, y: 20 },
  { id: 14, name: "Tag 14", x: 10, y: 40 },
  // Tag 15 is intentionally omitted as per image interpretation
  { id: 16, name: "Tag 16", x: 10, y: 60 },
  { id: 17, name: "Tag 17", x: 10, y: 80 },
  { id: 18, name: "Tag 18", x: 25, y: 80 },
  { id: 19, name: "Tag 19", x: 25, y: 60 },
  { id: 20, name: "Tag 20", x: 40, y: 60 },
  { id: 21, name: "Tag 21", x: 40, y: 80 },
  { id: 22, name: "Tag 22", x: 55, y: 80 },
  { id: 23, name: "Tag 23", x: 55, y: 60 },
  { id: 24, name: "Tag 24", x: 70, y: 60 },
  { id: 25, name: "Tag 25", x: 70, y: 80 },
  { id: 26, name: "Tag 26", x: 85, y: 80 },
  { id: 27, name: "Tag 27", x: 85, y: 60 },
];

// Sort tag IDs to establish a clear sequential order for connections
const sortedTagIds = BASE_TAG_DEFINITIONS.map(t => t.id).sort((a, b) => a - b);
const listLength = sortedTagIds.length;

// Generate NFC_TAG_POSITIONS with circular sequential connections
export const NFC_TAG_POSITIONS: TagPosition[] = BASE_TAG_DEFINITIONS.map(baseTag => {
  const currentIndex = sortedTagIds.indexOf(baseTag.id);
  
  // Determine previous and next tag IDs in the circular sequence
  const prevIndex = (currentIndex - 1 + listLength) % listLength;
  const nextIndex = (currentIndex + 1) % listLength;
  
  const prevTagIdInSequence = sortedTagIds[prevIndex];
  const nextTagIdInSequence = sortedTagIds[nextIndex];
  
  let newConnections: number[];

  if (listLength === 0) {
    newConnections = [];
  } else if (listLength === 1) {
    // A single tag connects to nothing in a sequence, or to itself if we allow self-loops (generally not for pathfinding)
    newConnections = []; 
  } else {
    newConnections = Array.from(new Set([prevTagIdInSequence, nextTagIdInSequence]));
  }

  return {
    ...baseTag,
    connections: newConnections.sort((a,b) => a-b) // Store connections sorted for consistency and easier debugging
  };
});
