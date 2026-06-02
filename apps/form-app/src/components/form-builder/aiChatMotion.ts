import type { Variants, Transition } from 'framer-motion';

/** Shared ease-out transition for message bubbles, chips, and tool cards. */
export const easeOut: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

/** Panel slide-in/out — used on the AnimatePresence wrapper in AIEditDrawer. */
export const panelTransition: Transition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
};

/** Panel slide-in/out variants — enters from the right, exits to the right. */
export const panelVariants: Variants = {
  hidden:  { x: 18, opacity: 0 },
  visible: { x: 0,  opacity: 1 },
  exit:    { x: 18, opacity: 0 },
};

/** Fade + slide-up for new message bubbles and tool-part cards. */
export const msgVariants: Variants = {
  hidden:  { y: 6, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/** Stagger container for the chips row. */
export const chipsContainerVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

/** Individual chip entry — used as children of chipsContainerVariants. */
export const chipVariants: Variants = {
  hidden:  { y: 4, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/** Send ↔ Cancel button AnimatePresence swap. */
export const buttonSwapVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.8 },
};

/** Timing for send ↔ cancel button swap — quick 150ms crossfade. */
export const buttonSwapTransition: Transition = {
  duration: 0.15,
  ease: [0.25, 0.1, 0.25, 1],
};

/** Token meter fill — animates width on mount. */
export const tokenMeterTransition: Transition = {
  duration: 0.5,
  ease: [0.25, 0.1, 0.25, 1],
  delay: 0.1,
};
