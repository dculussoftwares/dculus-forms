import { useCallback } from 'react';
import { closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';

/**
 * Custom collision detection strategy optimized for:
 * - Field type drops from sidebar (prioritizes page droppables)
 * - Field-to-field reordering with compact cards (uses closest center)
 * - Cross-page field moves (uses pointer within)
 */
export const useCollisionDetection = (): CollisionDetection => {
  return useCallback((args) => {
    const activeType = args.active?.data?.current?.type;

    // For field-to-field reordering, use closestCenter for better accuracy with compact cards
    if (activeType === 'field') {
      // First try pointer within for immediate overlap detection
      const pointerCollisions = pointerWithin(args);

      if (pointerCollisions.length > 0) {
        // Filter to get field collisions
        const fieldCollisions = pointerCollisions.filter((collision) =>
          collision.data?.droppableContainer?.data?.current?.type === 'field'
        );

        if (fieldCollisions.length > 0) {
          return fieldCollisions;
        }

        // If no field collisions, return page collisions for cross-page drops
        return pointerCollisions;
      }

      // Fallback to closest center for better field reordering with uniform compact cards
      return closestCenter(args);
    }

    // For field type drops from sidebar, prioritize page droppables
    if (activeType === 'field-type') {
      const pointerCollisions = pointerWithin(args);

      if (pointerCollisions.length > 0) {
        // Prioritize page droppables over field droppables
        const pageCollisions = pointerCollisions.filter((collision) =>
          collision.data?.droppableContainer?.data?.current?.type === 'page'
        );

        if (pageCollisions.length > 0) {
          return pageCollisions;
        }

        return pointerCollisions;
      }

      // Fallback to rect intersection for better sidebar-to-page detection
      return rectIntersection(args);
    }

    // For page reordering, use pointer within
    if (activeType === 'page-item') {
      const collisions = pointerWithin(args);
      return collisions.length > 0 ? collisions : closestCenter(args);
    }

    // Default: try pointer within, fallback to closest center
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
  }, []);
};