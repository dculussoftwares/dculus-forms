import { useCallback } from 'react';
import { closestCenter, pointerWithin } from '@dnd-kit/core';

export const useCollisionDetection = () => {
  return useCallback((args: any) => {
    const pointerCollisions = pointerWithin(args);
    
    if (pointerCollisions.length > 0) {
      // For field type drops, prioritize page droppables over field droppables
      if (args.active?.data?.current?.type === 'field-type') {
        const pageCollisions = pointerCollisions.filter((collision: any) => 
          collision.data?.current?.type === 'page'
        );
        if (pageCollisions.length > 0) {
          return pageCollisions;
        }
      }
      return pointerCollisions;
    }
    
    // If there are no pointer collisions, fall back to closest center
    return closestCenter(args);
  }, []);
};