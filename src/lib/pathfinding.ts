
import type { TagPosition } from './tag-positions';

export function findPath(startId: number, endId: number, tags: TagPosition[]): number[] | null {
  if (startId === endId) {
    return [startId];
  }

  const queue: Array<{ id: number; path: number[] }> = [{ id: startId, path: [startId] }];
  const visited: Set<number> = new Set([startId]);
  const tagMap: Map<number, TagPosition> = new Map(tags.map(tag => [tag.id, tag]));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const currentTag = tagMap.get(current.id);
    if (!currentTag) continue;

    for (const neighborId of currentTag.connections) {
      if (neighborId === endId) {
        return [...current.path, neighborId];
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, path: [...current.path, neighborId] });
      }
    }
  }
  return null; // No path found
}
